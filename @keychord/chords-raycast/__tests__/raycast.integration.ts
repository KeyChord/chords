import { launchMacOSFixture, waitFor, runCommand } from "@keychord/chordtest/macos";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { searchRaycast } from "../js/raycast.js";

requireMacOSVM();
console.log("raycast-fixture-compiling");
const fixture = await launchMacOSFixture(
  new URL("./RaycastFixture.swift", import.meta.url),
  "com.raycast.macos",
);
try {
  console.log("raycast-fixture-ready");
  // Launch the disposable app by path: LaunchServices deliberately does not
  // resolve its temporary, non-installed bundle through `open -b`.
  const queries = ["calculator", "calculator", "calendar", "foo/bar.(baz)'café🧮"];
  for (const query of queries) {
    console.log("raycast-query-start", query);
    await runCommand(["/usr/bin/open", `${fixture.directory}/RaycastFixture.app`]);
    await searchRaycast(query);
    console.log("raycast-query-activated", query);
  }
  const observed = await waitFor(async () => {
    const file = Bun.file(fixture.output);
    if (!(await file.exists())) return;
    const value = (await file.json()) as { activations: string[] };
    return value.activations.length === queries.length ? value.activations : undefined;
  });
  if (JSON.stringify(observed) !== JSON.stringify(queries))
    throw new Error(`Incorrect activations: ${JSON.stringify(observed)}`);
  console.log("raycast-atomic-search-and-activation-ok");
} catch (error) {
  console.error("raycast-search-failed", error);
  const root = Bun.fileURLToPath(new URL("../js/", import.meta.url));
  const binary = [...new Bun.Glob("native/**/*.node").scanSync({ cwd: root })][0];
  if (binary) console.error("Raycast state:", await require(`${root}/${binary}`).readState());
  if (await Bun.file(fixture.output).exists())
    console.error("Fixture events:", await Bun.file(fixture.output).text());
  throw error;
} finally {
  await fixture.close();
}
