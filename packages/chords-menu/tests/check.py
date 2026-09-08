"""Run with a Chord binary that services MainActor on its CLI main thread."""
from pathlib import Path
import os
import plistlib
import subprocess
import sys
import tempfile
import time

root = Path(__file__).resolve().parent
chord = str(Path(sys.argv[1]).resolve())
with tempfile.TemporaryDirectory(prefix="chord-menu-test-") as directory:
    contents = Path(directory) / "MenuFixture.app/Contents"
    binary = contents / "MacOS/MenuFixture"
    binary.parent.mkdir(parents=True)
    (contents / "Info.plist").write_bytes(plistlib.dumps({
        "CFBundleIdentifier": "dev.keychord.menu-fixture",
        "CFBundleName": "MenuFixture",
        "CFBundleExecutable": "MenuFixture",
        "CFBundlePackageType": "APPL",
    }))
    subprocess.run(["swiftc", "-parse-as-library", str(root / "MenuFixture.swift"), "-o", str(binary)], check=True)
    output = str(Path(directory) / "result.txt")
    env = {**os.environ, "MENU_FIXTURE_OUTPUT": output}
    app = subprocess.Popen(["open", "-W", "-n", "--env", "MENU_FIXTURE_OUTPUT=" + output, str(contents.parent)], env=env)
    try:
        for _ in range(100):
            if Path(output).exists():
                break
            if app.poll() is not None:
                raise RuntimeError("fixture exited before becoming ready")
            time.sleep(0.05)
        subprocess.run([chord, "bun", str(root / "menu.integration.ts")], env=env, timeout=30, check=True)
    finally:
        pid_file = Path(output + ".pid")
        if pid_file.exists():
            os.kill(int(pid_file.read_text()), 15)
        app.wait(timeout=5)
