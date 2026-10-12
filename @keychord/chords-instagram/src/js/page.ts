export type InstagramAction =
  | "home"
  | "reels"
  | "messages"
  | "search"
  | "create"
  | "profile"
  | "story"
  | "avatar"
  | "note"
  | "close-note";

// Serialized into Instagram's page. Keep every DOM helper inside this function.
async function runInPage(action: InstagramAction, storyNumber?: number): Promise<string> {
  try {
    if (location.hostname !== "instagram.com" && !location.hostname.endsWith(".instagram.com")) {
      throw new Error("The selected page is not Instagram.");
    }

    const clickable = "a[href], button, [role=button]";
    const visible = (element: Element): boolean => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]')
      );
    };
    const enabled = (element: Element): boolean =>
      visible(element) && !element.matches('[disabled], [aria-disabled="true"]');
    const text = (element: Element): string => element.textContent?.trim() ?? "";
    const byLabel = (root: Document | Element, labels: string[]): HTMLElement | undefined => {
      for (const element of root.querySelectorAll("[aria-label], [title], img[alt]")) {
        if (
          !labels.some((label) =>
            ["aria-label", "title", "alt"].some(
              (attribute) => element.getAttribute(attribute) === label,
            ),
          )
        )
          continue;
        const target = element.closest<HTMLElement>(clickable);
        if (target && root.contains(target) && enabled(target)) return target;
      }
      return [...root.querySelectorAll<HTMLElement>(clickable)].find(
        (element) => enabled(element) && labels.includes(text(element)),
      );
    };
    const waitFor = async <T>(find: () => T | undefined, message: string): Promise<T> => {
      const deadline = Date.now() + 4000;
      do {
        const result = find();
        if (result) return result;
        await new Promise((resolve) => setTimeout(resolve, 80));
      } while (Date.now() < deadline);
      throw new Error(message);
    };
    const dialogs = (): HTMLElement[] =>
      [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(visible);
    const noteEditor = (): HTMLElement | undefined =>
      dialogs().find(
        (dialog) =>
          !!dialog.querySelector(
            '[contenteditable="true"][aria-label="Share a thought..."], textarea[placeholder="Share a thought..."]',
          ) || /\b(New note|Your note)\b/i.test(text(dialog)),
      );
    const searchInput = (): HTMLInputElement | undefined =>
      [
        ...document.querySelectorAll<HTMLInputElement>(
          'input[aria-label="Search input"], input[placeholder="Search"]',
        ),
      ].find(enabled);
    const click = (element: HTMLElement): void => {
      element.click();
    };

    if (action === "story") {
      if (dialogs().length) throw new Error("Close the current dialog before opening a story.");
      if (location.pathname !== "/") throw new Error("Open Home before using the story chord.");
      const stories = await waitFor(() => {
        const tray = document.querySelector('main [data-pagelet="story_tray"]');
        if (!tray || !visible(tray)) return undefined;
        const buttons = [
          ...tray.querySelectorAll<HTMLElement>('[role="button"][aria-label^="Story by "]'),
        ].filter(enabled);
        return buttons.length ? buttons : undefined;
      }, "Instagram's Home story tray is unavailable.");
      const story = stories[storyNumber! - 1];
      if (!story)
        throw new Error(
          `Story #${storyNumber} is unavailable; the tray has ${stories.length} stories.`,
        );
      click(story);
      await waitFor(
        () => location.pathname.startsWith("/stories/") || undefined,
        `Instagram did not open story #${storyNumber}.`,
      );
    } else if (action === "close-note") {
      const editor = noteEditor();
      if (!editor) {
        if (dialogs().length) throw new Error("The open dialog is not an Instagram note editor.");
        return JSON.stringify({ ok: true });
      }
      const close = byLabel(editor, ["Close", "Cancel"]);
      if (!close) throw new Error("The note editor's Close control is unavailable.");
      // Use Instagram's own Close action, retaining any unsaved-draft confirmation.
      click(close);
      await waitFor(
        () => !visible(editor) || !editor.isConnected || undefined,
        "The note editor did not close.",
      );
    } else if (action === "note") {
      if (noteEditor()) return JSON.stringify({ ok: true });
      if (dialogs().length) throw new Error("Close the current dialog before opening a note.");
      const header = document.querySelector("main header");
      const avatar = header?.querySelector('img[alt="Change profile photo"]');
      const section = avatar?.closest("section");
      const note =
        section &&
        (byLabel(section, ["Note...", "Your note", "Leave a note", "Share a note"]) ??
          [...section.querySelectorAll<HTMLElement>(clickable)].find(
            (element) => enabled(element) && !element.contains(avatar!) && !!text(element),
          ));
      if (!note)
        throw new Error(
          "Open your own profile to use Notes. Notes must be available on your account.",
        );
      click(note);
      const editor = await waitFor(
        () => noteEditor() ?? dialogs().find((dialog) => byLabel(dialog, ["Leave a new note"])),
        "Instagram did not open the note editor.",
      );
      if (!noteEditor()) {
        click(byLabel(editor, ["Leave a new note"])!);
        await waitFor(noteEditor, "Instagram did not open the new note editor.");
      }
    } else if (action === "avatar") {
      if (dialogs().length)
        throw new Error("Close the current dialog before opening the profile avatar.");
      const header = document.querySelector("main header");
      const avatar =
        header &&
        (byLabel(header, ["Change profile photo"]) ??
          [...header.querySelectorAll<HTMLImageElement>('img[alt$="profile picture"]')]
            .map((image) => image.closest<HTMLElement>(clickable))
            .find((element) => element && enabled(element)));
      if (!avatar) throw new Error("Open a profile before using the avatar chord.");
      click(avatar);
    } else {
      if (dialogs().length)
        throw new Error("Close the current dialog before navigating Instagram.");
      const labels = {
        home: ["Home"],
        reels: ["Reels"],
        messages: ["Messages", "Messenger"],
        search: ["Search"],
        create: ["New post", "Create"],
        profile: ["Profile"],
      };
      const navigation = byLabel(document, labels[action]);
      if (!navigation) throw new Error(`Instagram's ${action} navigation control is unavailable.`);
      const destination =
        navigation instanceof HTMLAnchorElement ? new URL(navigation.href).pathname : undefined;
      // Repeating Search keeps its field open instead of toggling the old sidebar closed.
      if (
        !(
          action === "search" &&
          searchInput() &&
          (location.pathname.startsWith("/explore/") ||
            searchInput()?.getAttribute("aria-label") === "Search input")
        )
      )
        click(navigation);

      if (action === "search") {
        const input = await waitFor(searchInput, "Instagram's Search input is unavailable.");
        input.click();
        input.focus();
        input.select();
      } else if (action === "create") {
        const post = await waitFor(
          () =>
            dialogs().find((dialog) => /Create new post/i.test(text(dialog))) ??
            byLabel(document, ["Post"]),
          "Instagram's Create post control is unavailable.",
        );
        if (post.getAttribute("role") !== "dialog") click(post);
        await waitFor(
          () => dialogs().find((dialog) => /Create new post/i.test(text(dialog))),
          "Instagram did not open the post composer.",
        );
      } else if (destination && destination !== "#") {
        await waitFor(
          () => location.pathname === destination || undefined,
          `Instagram did not open ${action}.`,
        );
        if (action === "profile") {
          await waitFor(
            () =>
              document.querySelector('main header img[alt="Change profile photo"]') ?? undefined,
            "Instagram did not finish loading your profile.",
          );
        }
      }
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({ ok: false, error: (error as Error).message });
  }
}

export function buildInstagramJavaScript(
  action: InstagramAction,
  storyNumber?: string | number,
): string {
  if (
    ![
      "home",
      "reels",
      "messages",
      "search",
      "create",
      "profile",
      "story",
      "avatar",
      "note",
      "close-note",
    ].includes(action)
  ) {
    throw new Error(`Unknown Instagram action: ${action}`);
  }
  if (action === "story") {
    if (
      (typeof storyNumber !== "number" &&
        (typeof storyNumber !== "string" || !/^\d+$/.test(storyNumber))) ||
      !Number.isSafeInteger(Number(storyNumber)) ||
      Number(storyNumber) < 1
    ) {
      throw new Error("Story number must be a positive safe integer (1-based).");
    }
    return `(${runInPage.toString()})(${JSON.stringify(action)},${Number(storyNumber)})`;
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)})`;
}
