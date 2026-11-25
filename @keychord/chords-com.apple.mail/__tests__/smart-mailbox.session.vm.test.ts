import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
  type MacOSProbe,
} from "@keychord/chordtest";

const mail = "com.apple.mail";
const settings = "com.apple.systempreferences";
const profileName = "Chordtest Local IMAP";

function matching(node: AXNode, label: string) {
  return [node.title, node.description, node.value].includes(label);
}

async function click(probe: MacOSProbe, node: AXNode, twice = false) {
  const [x, y] = node.position!;
  const [width, height] = node.size!;
  if (twice) await probe.doubleClickPoint(x + width / 2, y + height / 2);
  else await probe.clickPoint(x + width / 2, y + height / 2);
}

function localMailbox(commands: Set<string>) {
  return Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    data: "",
    socket: {
      open(socket) {
        socket.write("* PREAUTH [CAPABILITY IMAP4rev1 NAMESPACE] Chordtest local mailbox\r\n");
      },
      data(socket, bytes) {
        const lines = (socket.data + new TextDecoder().decode(bytes)).split("\r\n");
        socket.data = lines.pop()!;
        for (const line of lines) {
          const [tag, rawVerb] = line.split(" ", 3);
          if (!tag || !rawVerb) continue;
          const verb = rawVerb.toUpperCase();
          commands.add(verb);
          switch (verb) {
            case "CAPABILITY":
              socket.write("* CAPABILITY IMAP4rev1 NAMESPACE\r\n");
              break;
            case "NAMESPACE":
              socket.write('* NAMESPACE (("" "/")) NIL NIL\r\n');
              break;
            case "LIST":
            case "LSUB":
              socket.write("* " + verb + ' () "/" "INBOX"\r\n');
              break;
            case "SELECT":
            case "EXAMINE":
              socket.write(
                "* FLAGS (\\Seen)\r\n* 0 EXISTS\r\n* 0 RECENT\r\n* OK [UIDVALIDITY 1]\r\n* OK [UIDNEXT 1]\r\n",
              );
              break;
            case "STATUS":
              socket.write(
                "* STATUS INBOX (MESSAGES 0 RECENT 0 UIDNEXT 1 UIDVALIDITY 1 UNSEEN 0)\r\n",
              );
              break;
            case "LOGOUT":
              socket.write("* BYE Local fixture closing\r\n");
              socket.end(tag + " OK LOGOUT completed\r\n");
              continue;
            case "NOOP":
            case "CLOSE":
            case "UID":
              break;
            default:
              socket.write(tag + " BAD Unsupported fixture command\r\n");
              continue;
          }
          socket.write(tag + " OK " + verb + " completed\r\n");
        }
      },
      error() {},
    },
  });
}

test.skipIf(!macOSUITestsEnabled)(
  "Mail opens the Smart Mailbox composer with a local account",
  async () => {
    await withMacOSProbe(async (probe) => {
      const scratch = await mkdtemp(join(tmpdir(), "chordtest-mail-profile-"));
      const commands = new Set<string>();
      const server = localMailbox(commands);
      const identifier = "dev.keychord.chordtest.loopback-mail." + crypto.randomUUID();
      const path = join(scratch, "chordtest-loopback.mobileconfig");
      const json = join(scratch, "profile.json");

      const profileNodes = async () => flattenAX(await probe.windows(settings, 14).catch(() => []));
      const installed = async () =>
        (
          await runCommand(["/usr/bin/profiles", "show", "-type", "configuration"], {
            timeout: 5_000,
          }).catch(() => ({ stdout: "" }))
        ).stdout.includes(identifier);
      try {
        await Bun.write(
          json,
          JSON.stringify({
            PayloadType: "Configuration",
            PayloadVersion: 1,
            PayloadIdentifier: identifier,
            PayloadUUID: crypto.randomUUID(),
            PayloadDisplayName: profileName,
            PayloadScope: "User",
            PayloadContent: [
              {
                PayloadType: "com.apple.mail.managed",
                PayloadVersion: 1,
                PayloadIdentifier: identifier + ".account",
                PayloadUUID: crypto.randomUUID(),
                PayloadDisplayName: profileName,
                EmailAccountDescription: profileName,
                EmailAccountName: "Chordtest",
                EmailAccountType: "EmailTypeIMAP",
                EmailAddress: "fixture@chordtest.test",
                IncomingMailServerHostName: "127.0.0.1",
                IncomingMailServerPortNumber: server.port,
                IncomingMailServerUseSSL: false,
                IncomingMailServerUsername: "fixture",
                IncomingMailServerAuthentication: "EmailAuthNone",
                OutgoingMailServerHostName: "127.0.0.1",
                OutgoingMailServerPortNumber: 1587,
                OutgoingMailServerUseSSL: false,
                OutgoingMailServerAuthentication: "EmailAuthNone",
              },
            ],
          }),
        );
        await runCommand(["/usr/bin/plutil", "-convert", "xml1", "-o", path, json]);
        await runCommand(["/usr/bin/plutil", "-lint", path]);
        await runCommand(["/usr/bin/open", path]);
        await runCommand([
          "/usr/bin/open",
          "x-apple.systempreferences:com.apple.Profiles-Settings.extension",
        ]);
        const noticeOwner = "com.apple.UserNotificationCenter";
        const knownControl = (node: AXNode) =>
          Boolean(node.position && node.size?.every((value) => value > 0));
        let focusedAt = 0;
        let checkedAt = 0;
        let checkedInstalled = false;
        let openedReview = false;
        await waitFor(async () => {
          if (Date.now() - checkedAt >= 750) {
            checkedAt = Date.now();
            checkedInstalled = await installed();
          }
          if (checkedInstalled) return true;
          const front = await probe.front();
          if (front === noticeOwner) {
            const notices = flattenAX(await probe.windows(noticeOwner, 10).catch(() => []));
            const description = notices
              .flatMap(({ title, description, value }) => [title, description, value])
              .filter((value): value is string => typeof value === "string")
              .join(" ");
            if (/profile downloaded|review the profile.*settings/i.test(description)) {
              const acknowledge = notices.find(
                (node) =>
                  node.role === "AXButton" &&
                  node.enabled &&
                  matching(node, "OK") &&
                  knownControl(node),
              );
              if (acknowledge) {
                await click(probe, acknowledge);
                await Bun.sleep(400);
                return;
              }
            }
          }
          if (front !== settings) {
            if (Date.now() - focusedAt > 2_000) {
              focusedAt = Date.now();
              await runCommand(["/usr/bin/open", "-b", settings]);
            }
            return;
          }
          const nodes = await profileNodes();
          const install = nodes.find(
            (node) =>
              node.role === "AXButton" &&
              node.enabled &&
              knownControl(node) &&
              ["Install", "Install…"].some((label) => matching(node, label)),
          );
          const staged = nodes.find((node) => matching(node, profileName) && knownControl(node));
          const pendingReview = nodes.some((node) =>
            matching(node, "Profile not installed. Double-click to review."),
          );
          if ((await probe.front()) !== settings) return;
          if (install && openedReview) {
            await click(probe, install);
            await Bun.sleep(500);
          } else if (staged && pendingReview) {
            await click(probe, staged, true);
            openedReview = true;
            await Bun.sleep(500);
          }
        }, 34_000);
        console.log("Mail loopback profile installed", identifier);
        await withChordPackage(import.meta.url, async (app) => {
          await probe.activate(mail);
          let privacyChoiceSelected = false;
          const item = await waitFor(async () => {
            const windows = await probe.windows(mail, 10).catch(() => []);
            const controls = flattenAX(windows);
            if (controls.some((node) => matching(node, "Mail Privacy Protection"))) {
              const namedProtect = controls.find(
                (node) =>
                  typeof (node.title ?? node.description ?? node.value) === "string" &&
                  /^Protect Mail activity$/i.test(
                    String(node.title ?? node.description ?? node.value),
                  ) &&
                  knownControl(node),
              );
              // In this first-run window, AppKit exposes the two illustrated choices as
              // unnamed AXButtons. The displayed Protect choice is the upper card.
              const cards = controls
                .filter(
                  (node) =>
                    node.role === "AXButton" &&
                    !node.title &&
                    !node.description &&
                    knownControl(node) &&
                    node.size![0] >= 300 &&
                    node.size![1] >= 60,
                )
                .sort((left, right) => left.position![1] - right.position![1]);
              const protect = namedProtect ?? (cards.length === 2 ? cards[0] : undefined);
              if (
                !privacyChoiceSelected &&
                protect &&
                !protect.selected &&
                protect.value !== true &&
                protect.value !== 1
              ) {
                if ((await probe.front()) !== mail) return;
                const [x, y] = protect.position!;
                const [width, height] = protect.size!;
                await probe.clickPoint(x + width * 0.925, y + height / 2);
                privacyChoiceSelected = true;
                await Bun.sleep(500);
                return;
              }
              const button = controls.find(
                (node) =>
                  node.role === "AXButton" &&
                  node.enabled !== false &&
                  matching(node, "Continue") &&
                  knownControl(node),
              );
              if (button) {
                await click(probe, button);
                await Bun.sleep(500);
              }
              return;
            }
            const entry = await probe
              .menu(mail, "Mailbox", "New Smart Mailbox…")
              .catch(() => undefined);
            const scene = await probe.window(mail).catch(() => undefined);
            return scene?.subrole === "AXStandardWindow" && entry?.enabled ? entry : undefined;
          }, 25_000);
          expect(item.enabled).toBe(true);
          const composer = async () =>
            flattenAX(await probe.windows(mail, 12)).find(
              (node) =>
                matching(node, "Smart Mailbox Name:") ||
                (node.role === "AXWindow" && matching(node, "New Smart Mailbox")),
            );
          expect(await composer()).toBeUndefined();
          try {
            await app.runChecked("ns");
            await waitFor(composer, 12_000);
            await waitFor(async () => commands.has("LIST") || undefined, 12_000);
            console.log("Mail Smart Mailbox composer opened with the loopback account");
          } finally {
            if (await composer()) {
              await probe.key(53);
              await waitFor(async () => !(await composer()) || undefined);
            }
          }
        });
      } catch (cause) {
        throw new Error(
          "Mail did not open Smart Mailbox with its local account: " +
            JSON.stringify({
              front: await probe.front(),
              profileInstalled: await installed(),
              viewer: await probe.window(mail).catch(() => undefined),
              imapCommands: [...commands],
            }),
          { cause },
        );
      } finally {
        server.stop(true);
        console.log("Mail loopback IMAP commands", [...commands]);
        await rm(scratch, { recursive: true, force: true });
      }
    });
  },
  150_000,
);
