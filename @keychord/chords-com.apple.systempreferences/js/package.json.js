//#region package.json
var name = "@keychord/chords-com.apple.systempreferences";
var displayName = "System Preferences Chords";
var version = "0.0.1";
var description = "Open system settings panels on macOS, GNOME on Linux, and Windows.";
var categories = ["macOS"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-com.apple.systempreferences",
};
var type = "module";
var scripts = { test: "bun test --isolate" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "latest",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    apple: {
      systempreferences: {
        "macos.toml": {
          name: "System Preferences",
          on: { appearance: { file: "systempreferences.js" } },
          chords: {
            "?g": { name: "Goto" },
            gaa: {
              name: "Goto: Apple Account",
              shell: "open 'x-apple.systempreferences:com.apple.systempreferences.AppleIDSettings'",
            },
            gwi: {
              name: "Goto: Wi-fi",
              shell: "open 'x-apple.systempreferences:com.apple.wifi-settings-extension'",
            },
            gbl: {
              name: "Goto: Bluetooth",
              shell: "open 'x-apple.systempreferences:com.apple.BluetoothSettings'",
            },
            gne: {
              name: "Goto: Network",
              shell: "open 'x-apple.systempreferences:com.apple.Network-Settings.extension'",
            },
            gvp: {
              name: "Goto: VPN",
              shell:
                "open 'x-apple.systempreferences:com.apple.NetworkExtensionSettingsUI.NESettingsUIExtension'",
            },
            gba: {
              name: "Goto: Battery",
              shell: "open 'x-apple.systempreferences:com.apple.Battery-Settings.extension'",
            },
            gge: {
              name: "Goto: General",
              shell: "open 'x-apple.systempreferences:com.apple.systempreferences.GeneralSettings'",
            },
            gac: {
              name: "Goto: Accessibility",
              shell: "open 'x-apple.systempreferences:com.apple.Accessibility-Settings.extension'",
            },
            gap: {
              name: "Goto: Appearance",
              shell: "open 'x-apple.systempreferences:com.apple.Appearance-Settings.extension'",
            },
            gai: {
              name: "Goto: Apple Intelligence",
              shell: "open 'x-apple.systempreferences:com.apple.Siri-Settings.extension'",
            },
            gdd: {
              name: "Goto: Desktop & Dock",
              shell: "open 'x-apple.systempreferences:com.apple.Desktop-Settings.extension'",
            },
            gdi: {
              name: "Goto: Displays",
              shell: "open 'x-apple.systempreferences:com.apple.Displays-Settings.extension'",
            },
            gmb: {
              name: "Goto: Menu Bar",
              shell: "open 'x-apple.systempreferences:com.apple.ControlCenter-Settings.extension'",
            },
            gsp: {
              name: "Goto: Spotlight",
              shell: "open 'x-apple.systempreferences:com.apple.Spotlight-Settings.extension'",
            },
            gwa: {
              name: "Goto: Wallpaper",
              shell: "open 'x-apple.systempreferences:com.apple.Wallpaper-Settings.extension'",
            },
            gno: {
              name: "Goto: Notifications",
              shell: "open 'x-apple.systempreferences:com.apple.Notifications-Settings.extension'",
            },
            gso: {
              name: "Goto: Sound",
              shell: "open 'x-apple.systempreferences:com.apple.Sound-Settings.extension'",
            },
            gfo: {
              name: "Goto: Focus",
              shell: "open 'x-apple.systempreferences:com.apple.Focus-Settings.extension'",
            },
            gst: {
              name: "Goto: Screen Time",
              shell: "open 'x-apple.systempreferences:com.apple.Screen-Time-Settings.extension'",
            },
            gls: {
              name: "Goto: Lock Screen",
              shell: "open 'x-apple.systempreferences:com.apple.Lock-Screen-Settings.extension'",
            },
            gps: {
              name: "Goto: Privacy & Security",
              shell:
                "open 'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension'",
            },
            gtp: {
              name: "Goto: Touch ID & Password",
              shell: "open 'x-apple.systempreferences:com.apple.Touch-ID-Settings.extension'",
            },
            gup: {
              name: "Goto: Users & Groups",
              shell: "open 'x-apple.systempreferences:com.apple.Users-Groups-Settings.extension'",
            },
            gia: {
              name: "Goto: Internet Accounts",
              shell:
                "open 'x-apple.systempreferences:com.apple.Internet-Accounts-Settings.extension'",
            },
            ggc: {
              name: "Goto: Game Center",
              shell: "open 'x-apple.systempreferences:com.apple.Game-Center-Settings.extension'",
            },
            gic: {
              name: "Goto: iCloud",
              shell:
                "open 'x-apple.systempreferences:com.apple.systempreferences.AppleIDSettings:icloud'",
            },
            gwp: {
              name: "Goto: Wallet & (Apple) Pay",
              shell: "open 'x-apple.systempreferences:com.apple.WalletSettingsExtension'",
            },
            gke: {
              name: "Goto: Keyboard",
              shell: "open 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension'",
            },
            gtr: {
              name: "Goto: Trackpad",
              shell: "open 'x-apple.systempreferences:com.apple.Trackpad-Settings.extension'",
            },
            gpr: {
              name: "Goto: Printers",
              shell: "open 'x-apple.systempreferences:com.apple.Print-Scan-Settings.extension'",
            },
            "?ap": { name: "Appearance" },
            apa: {
              name: "Appearance: Auto",
              "@input:appearance": ["AUTO"],
            },
            apd: {
              name: "Appearance: Dark",
              "@input:appearance": ["DARK"],
            },
            apl: {
              name: "Appearance: Light",
              "@input:appearance": ["LIGHT"],
            },
          },
        },
      },
    },
    microsoft: {
      WindowsSettings: {
        "windows.toml": {
          name: "Windows Settings",
          executables: ["SystemSettings.exe"],
          meta: { chord: ">=0.3.4" },
          chords: {
            "?g": { name: "Go to Settings Page" },
            gaa: {
              name: "Go to Your Info",
              shell: 'start "" "ms-settings:yourinfo"',
            },
            gwi: {
              name: "Go to Wi-Fi",
              shell: 'start "" "ms-settings:network-wifi"',
            },
            gbl: {
              name: "Go to Bluetooth",
              shell: 'start "" "ms-settings:bluetooth"',
            },
            gne: {
              name: "Go to Network & Internet",
              shell: 'start "" "ms-settings:network-status"',
            },
            gvp: {
              name: "Go to VPN",
              shell: 'start "" "ms-settings:network-vpn"',
            },
            gba: {
              name: "Go to Power & Battery",
              shell: 'start "" "ms-settings:powersleep"',
            },
            gge: {
              name: "Go to About",
              shell: 'start "" "ms-settings:about"',
            },
            gac: {
              name: "Go to Accessibility Display",
              shell: 'start "" "ms-settings:easeofaccess-display"',
            },
            gap: {
              name: "Go to Personalization",
              shell: 'start "" "ms-settings:personalization"',
            },
            gdd: {
              name: "Go to Taskbar",
              shell: 'start "" "ms-settings:taskbar"',
            },
            gdi: {
              name: "Go to Display",
              shell: 'start "" "ms-settings:display"',
            },
            gwa: {
              name: "Go to Background",
              shell: 'start "" "ms-settings:personalization-background"',
            },
            gno: {
              name: "Go to Notifications",
              shell: 'start "" "ms-settings:notifications"',
            },
            gso: {
              name: "Go to Sound",
              shell: 'start "" "ms-settings:sound"',
            },
            gls: {
              name: "Go to Lock Screen",
              shell: 'start "" "ms-settings:lockscreen"',
            },
            gps: {
              name: "Go to Privacy",
              shell: 'start "" "ms-settings:privacy"',
            },
            gtp: {
              name: "Go to Sign-in Options",
              shell: 'start "" "ms-settings:signinoptions"',
            },
            gia: {
              name: "Go to Email & Accounts",
              shell: 'start "" "ms-settings:emailandaccounts"',
            },
            gke: {
              name: "Go to Typing",
              shell: 'start "" "ms-settings:typing"',
            },
            gtr: {
              name: "Go to Mouse & Touchpad",
              shell: 'start "" "ms-settings:mousetouchpad"',
            },
            gpr: {
              name: "Go to Printers & Scanners",
              shell: 'start "" "ms-settings:printers"',
            },
          },
        },
      },
    },
  },
  "linux.toml": {
    name: "GNOME Settings",
    meta: { chord: ">=0.3.4" },
    placeholders: {
      "<>": {
        name: "System Settings prefix",
        default: "/",
      },
    },
    chords: {
      "<>,": {
        name: "GNOME Settings",
        shell:
          "command -v gnome-control-center >/dev/null && { gnome-control-center </dev/null >/dev/null 2>&1 & }",
      },
    },
  },
  "macos.toml": {
    name: "System Preferences",
    meta: { chord: ">=0.3.0" },
    placeholders: {
      "<>": {
        name: "System Settings prefix",
        default: "/",
      },
    },
    chords: {
      "<>,": {
        name: "System Preferences",
        shell: "open -b com.apple.systempreferences",
      },
    },
  },
  org: {
    gnome: {
      Settings: {
        "linux.toml": {
          name: "GNOME Settings",
          executables: ["gnome-control-center"],
          meta: { chord: ">=0.3.4" },
          chords: {
            "?g": { name: "Go to Settings Page" },
            gwi: {
              name: "Go to Wi-Fi",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center wifi </dev/null >/dev/null 2>&1 & }",
            },
            gbl: {
              name: "Go to Bluetooth",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center bluetooth </dev/null >/dev/null 2>&1 & }",
            },
            gne: {
              name: "Go to Network",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center network </dev/null >/dev/null 2>&1 & }",
            },
            gba: {
              name: "Go to Power",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center power </dev/null >/dev/null 2>&1 & }",
            },
            gac: {
              name: "Go to Accessibility",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center universal-access </dev/null >/dev/null 2>&1 & }",
            },
            gdd: {
              name: "Go to Multitasking",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center multitasking </dev/null >/dev/null 2>&1 & }",
            },
            gdi: {
              name: "Go to Displays",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center display </dev/null >/dev/null 2>&1 & }",
            },
            gsp: {
              name: "Go to Search",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center search </dev/null >/dev/null 2>&1 & }",
            },
            gwa: {
              name: "Go to Background",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center background </dev/null >/dev/null 2>&1 & }",
            },
            gno: {
              name: "Go to Notifications",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center notifications </dev/null >/dev/null 2>&1 & }",
            },
            gso: {
              name: "Go to Sound",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center sound </dev/null >/dev/null 2>&1 & }",
            },
            gps: {
              name: "Go to Privacy",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center privacy </dev/null >/dev/null 2>&1 & }",
            },
            gia: {
              name: "Go to Online Accounts",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center online-accounts </dev/null >/dev/null 2>&1 & }",
            },
            gke: {
              name: "Go to Keyboard",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center keyboard </dev/null >/dev/null 2>&1 & }",
            },
            gtr: {
              name: "Go to Mouse & Touchpad",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center mouse </dev/null >/dev/null 2>&1 & }",
            },
            gpr: {
              name: "Go to Printers",
              shell:
                "command -v gnome-control-center >/dev/null && { gnome-control-center printers </dev/null >/dev/null 2>&1 & }",
            },
          },
        },
      },
    },
  },
  "windows.toml": {
    name: "Windows Settings",
    meta: { chord: ">=0.3.4" },
    placeholders: {
      "<>": {
        name: "System Settings prefix",
        default: "/",
      },
    },
    chords: {
      "<>,": {
        name: "Windows Settings",
        shell: 'start "" "ms-settings:"',
      },
    },
  },
};
var package_default = {
  name,
  displayName,
  version,
  description,
  categories,
  repository,
  type,
  scripts,
  devDependencies,
  packageManager,
  chords,
};
//#endregion
export {
  categories,
  chords,
  package_default as default,
  description,
  devDependencies,
  displayName,
  name,
  packageManager,
  repository,
  scripts,
  type,
  version,
};
