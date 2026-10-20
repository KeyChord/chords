//#region package.json
var name = "@keychord/chords-com.apple.ActivityMonitor";
var displayName = "Activity Monitor Chords";
var version = "0.0.0";
var description = "Chords for Activity Monitor (com.apple.ActivityMonitor).";
var categories = ["macOS"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-com.apple.ActivityMonitor",
};
var type = "module";
var scripts = { test: "bun test --isolate" };
var dependencies = { "@keychord/chords-menu": "workspace:*" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "@keychord": {
    "chords-menu": {
      chords: {
        "macos.toml": {
          name: "macOS Menu Bar",
          on: {
            menu: {
              file: "menu.js",
              args: [],
            },
            tray: { file: "tray.js" },
            select: { file: "selection.js" },
            visibility: { file: "visibility.js" },
          },
          chords: {
            "?=": { name: "Menu/Tray" },
            "?=[": { name: "Menu Bar: Menus By Index" },
            "?=/": { name: "Menu Bar: Search" },
            "=[([a-z]+(?:-[a-z]+)*[0-9]*).": {
              name: "Menu Bar: by letter",
              "@input:menu": ["BY_LETTERS", "$1"],
            },
            "=/(.+)": {
              name: "Menu Bar: Search $1",
              "@input:menu": ["SEARCH", "$1"],
            },
            "?=0": { name: "Menu Bar: Apple Logo" },
            '?="1-9"': { name: "Tray: Select Icon" },
            "?=-": { name: "Menu Bar: Notch / Tray From Right" },
            '?=-"1-9"': { name: "Tray: Select From Right" },
            "?=]": { name: "Menu Bar: Tray Icons" },
            "=([\\[\\]]?-?(?:0|[1-9][0-9]*)[lr]?[\\[\\]]*[.,]?)": {
              name: "Menu Bar: Select / Click Item",
              "@keydown:select": ["KEYDOWN", "$1"],
              "@input:select": ["INPUT", "$1"],
            },
            "=-": {
              name: "Menu Bar: Click Notch",
              "@input:tray": ["NOTCH"],
            },
            "=p": {
              name: "Tray: Power / Battery",
              "@input:tray": ["BATTERY"],
            },
            "=c": {
              name: "Tray: Control Center",
              "@input:tray": ["CONTROL_CENTER"],
            },
            "=cd": {
              name: "Tray: Control Center > Display",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY"],
            },
            "=cd-": {
              name: "Tray: Control Center > Display > Decrease",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY", "DECREASE"],
            },
            "=cd=": {
              name: "Tray: Control Center > Display > Increase",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY", "INCREASE"],
            },
            "=cd.": {
              name: "Tray: Control Center > Display > Click",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY", "CLICK"],
            },
            "=cdd": {
              name: "Tray: Control Center > Display > Dark Mode",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY", "DARK_MODE"],
            },
            "=cdn": {
              name: "Tray: Control Center > Display > Night Shift",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY", "NIGHT_SHIFT"],
            },
            "=cdt": {
              name: "Tray: Control Center > Display > True Tone",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY", "TRUE_TONE"],
            },
            "=cds": {
              name: "Tray: Control Center > Display > Settings",
              "@input:tray": ["CONTROL_CENTER", "DISPLAY", "SETTINGS"],
            },
            "=cs": {
              name: "Tray: Control Center > Sound",
              "@input:tray": ["CONTROL_CENTER", "SOUND"],
            },
            "=cs-": {
              name: "Tray: Control Center > Sound > Decrease",
              "@input:tray": ["CONTROL_CENTER", "SOUND", "DECREASE"],
            },
            "=cs=": {
              name: "Tray: Control Center > Sound > Increase",
              "@input:tray": ["CONTROL_CENTER", "SOUND", "INCREASE"],
            },
            "=cs.": {
              name: "Tray: Control Center > Sound > Click",
              "@input:tray": ["CONTROL_CENTER", "SOUND", "CLICK"],
            },
            "=s": {
              name: "Tray: Spotlight",
              shortcut: "cmd+space",
            },
            "=t": {
              name: "Tray: Time & Date",
              "@input:tray": ["DATE_TIME"],
            },
            "?=wi": { name: "Tray Wi-Fi" },
            "=wi": {
              name: "Tray: Wi-Fi",
              "@input:tray": ["WIFI"],
            },
            "=wiv": {
              name: "Tray Wi-Fi: Vary On/Off",
              "@input:tray": ["WIFI", "TOGGLE"],
            },
            "=q": {
              name: "Force Quit",
              shortcut: "opt+cmd+esc",
            },
            "=ls": {
              name: "Lock Screen",
              shortcut: "opt+cmd+esc",
            },
            "=lo": {
              name: "Log Out",
              shortcut: "ctrl+cmd+q",
            },
            "=lq": {
              name: "Log Quit",
              shortcut: "opt+shift+cmd+q",
            },
            "?=b": { name: "Brightness" },
            "=bu": {
              name: "Brightness Up",
              shortcut: "BrightnessUp",
            },
            "=bd": {
              name: "Brightness Down",
              shortcut: "BrightnessDown",
            },
            "=v": {
              name: "Menu Bar: Show / Hide",
              "@input:visibility": [],
            },
            "?=v": { name: "Menu Bar Visibility / Volume" },
            "=vu": {
              name: "Volume Up",
              shortcut: "AudioVolumeUp",
            },
            "=vd": {
              name: "Volume Down",
              shortcut: "AudioVolumeDown",
            },
            "=vm": {
              name: "Volume Mute",
              shortcut: "AudioVolumeMute",
            },
            "?=w": { name: "Window Menu" },
            "=w": {
              name: "Window Menu",
              "@input:menu": ["BY_PATH", ["Window"]],
            },
            "=wl": {
              name: "Window Menu: Left",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Left"]],
            },
            "=wr": {
              name: "Window Menu: Right",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Right"]],
            },
            "=wt": {
              name: "Window Menu: Top",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Top"]],
            },
            "=wb": {
              name: "Window Menu: Bottom",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Bottom"]],
            },
            "=wtl": {
              name: "Window Menu: Top Left",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Top Left"]],
            },
            "=wtr": {
              name: "Window Menu: Top Right",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Top Right"]],
            },
            "=wbl": {
              name: "Window Menu: Bottom Left",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Bottom Left"]],
            },
            "=wbr": {
              name: "Window Menu: Bottom Right",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Bottom Right"]],
            },
            "=wlr": {
              name: "Window Menu: Left & Right",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Left & Right"]],
            },
            "=wrl": {
              name: "Window Menu: Right & Left",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Right & Left"]],
            },
            "=wtb": {
              name: "Window Menu: Top & Bottom",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Top & Bottom"]],
            },
            "=wbt": {
              name: "Window Menu: Bottom & Top",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Bottom & Top"]],
            },
            "=wq": {
              name: "Window Menu: Quarters",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Quarters"]],
            },
            "=ws[": {
              name: "Window Menu: Return to Previous Size",
              "@input:menu": ["BY_PATH", ["Window", "Move & Resize", "Return to Previous Size"]],
            },
            "=wz": {
              name: "Window Menu: Zoom",
              "@input:menu": ["BY_PATH", ["Window", "Zoom"]],
            },
            "=wf": {
              name: "Window Menu: Fill",
              "@input:menu": ["BY_PATH", ["Window", "Fill"]],
            },
            "=wc": {
              name: "Window Menu: Center",
              "@input:menu": ["BY_PATH", ["Window", "Center"]],
            },
            "=wfl": {
              name: "Window Menu: Left of Screen",
              "@input:menu": ["BY_PATH", ["Window", "Full Screen Tile", "Left of Screen"]],
            },
            "=wfr": {
              name: "Window Menu: Right of Screen",
              "@input:menu": ["BY_PATH", ["Window", "Full Screen Tile", "Right of Screen"]],
            },
            "=waf": {
              name: "Window Menu: Bring All to Front",
              "@input:menu": ["BY_PATH", ["Window", "Bring All to Front"]],
            },
          },
        },
      },
    },
  },
  com: {
    apple: {
      ActivityMonitor: {
        "macos.toml": {
          name: "Activity Monitor",
          handler: { menu: { file: "@keychord/chords-menu/js/menu.js" } },
          chords: {
            "?v": { name: "View" },
            va: {
              name: "View: All Processes",
              "@input:menu": ["BY_PATH", ["View", "All Processes"]],
            },
            vh: {
              name: "View: Hierarchially, All Processes",
              "@input:menu": ["BY_PATH", ["View", "All Processes, Hierarchically"]],
            },
            vm: {
              name: "View: My Processes",
              "@input:menu": ["BY_PATH", ["View", "My Processes"]],
            },
            vs: {
              name: "View: Selected Processes",
              "@input:menu": ["BY_PATH", ["View", "Selected Processes"]],
            },
            vy: {
              name: "View: System Processes",
              "@input:menu": ["BY_PATH", ["View", "System Processes"]],
            },
            vo: {
              name: "View: Other Users' Processes",
              "@input:menu": ["BY_PATH", ["View", "Other Users’ Processes"]],
            },
            vc: {
              name: "View: Current (Active) Processes",
              "@input:menu": ["BY_PATH", ["View", "Active Processes"]],
            },
            vi: {
              name: "View: Inactive Processes",
              "@input:menu": ["BY_PATH", ["View", "Inactive Processes"]],
            },
            vg: {
              name: "View: GPU Processes",
              "@input:menu": ["BY_PATH", ["View", "GPU Processes"]],
            },
            vw: {
              name: "View: Windowed Processes",
              "@input:menu": ["BY_PATH", ["View", "Windowed Processes"]],
            },
            vl: {
              name: "View: Last 12 Hour Applications",
              "@input:menu": ["BY_PATH", ["View", "Applications in last 12 hours"]],
            },
            vp: {
              name: "View: Processes, by GPU",
              "@input:menu": ["BY_PATH", ["View", "Processes, by GPU"]],
            },
            "?p": { name: "Process" },
            pf: {
              name: "Process: Filter",
              "@input:menu": ["BY_PATH", ["View", "Filter Processes"]],
            },
            pi: {
              name: "Process: Inspect",
              "@input:menu": ["BY_PATH", ["View", "Inspect Process"]],
            },
            ps: {
              name: "Process: Sample",
              "@input:menu": ["BY_PATH", ["View", "Sample Process"]],
            },
            pq: {
              name: "Process: Quit",
              "@input:menu": ["BY_PATH", ["View", "Quit Process"]],
            },
            pss: {
              name: "Process: Send Signal",
              "@input:menu": ["BY_PATH", ["View", "Send Signal to Process..."]],
            },
            psd: {
              name: "Process: Show Deltas",
              "@input:menu": ["BY_PATH", ["View", "Show Deltas for Process"]],
            },
            "?r": { name: "Run" },
            rs: {
              name: "Run: Spindump",
              "@input:menu": ["BY_PATH", ["View", "Run Spindump"]],
            },
            rd: {
              name: "Run: Diagonstics for System",
              "@input:menu": ["BY_PATH", ["View", "Run System Diagnostics..."]],
            },
            "?c": { name: "Columns" },
            cpi: {
              name: "Columns: Process ID",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Process ID"]],
            },
            cu: {
              name: "Columns: User",
              "@input:menu": ["BY_PATH", ["View", "Columns", "User"]],
            },
            cpc: {
              name: "Columns: % CPU",
              "@input:menu": ["BY_PATH", ["View", "Columns", "% CPU"]],
            },
            cct: {
              name: "Columns: CPU Time",
              "@input:menu": ["BY_PATH", ["View", "Columns", "CPU Time"]],
            },
            cpg: {
              name: "Columns: % GPU",
              "@input:menu": ["BY_PATH", ["View", "Columns", "% GPU"]],
            },
            cgt: {
              name: "Columns: GPU Time",
              "@input:menu": ["BY_PATH", ["View", "Columns", "GPU Time"]],
            },
            cnt: {
              name: "Columns: # Threads",
              "@input:menu": ["BY_PATH", ["View", "Columns", "# Threads"]],
            },
            cnp: {
              name: "Columns: # Ports",
              "@input:menu": ["BY_PATH", ["View", "Columns", "# Ports"]],
            },
            crm: {
              name: "Columns: Real Memory",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Real Memory"]],
            },
            crpm: {
              name: "Columns: Real Private Memory",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Real Private Memory"]],
            },
            crsm: {
              name: "Columns: Real Shared Memory",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Real Shared Memory"]],
            },
            ck: {
              name: "Columns: Kind",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Kind"]],
            },
            cst: {
              name: "Columns: Sudden Termination",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Sudden Termination"]],
            },
            cs: {
              name: "Columns: Sandbox",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Sandbox"]],
            },
            cr: {
              name: "Columns: Restricted",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Restricted"]],
            },
            ciwu: {
              name: "Columns: Idle Wake Ups",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Idle Wake Ups"]],
            },
            cei: {
              name: "Columns: Energy Impact",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Energy Impact"]],
            },
            can: {
              name: "Columns: App Nap",
              "@input:menu": ["BY_PATH", ["View", "Columns", "App Nap"]],
            },
            csb: {
              name: "Columns: Sent Bytes",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Sent Bytes"]],
            },
            csp: {
              name: "Columns: Sent Packets",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Sent Packets"]],
            },
            crb: {
              name: "Columns: Received Bytes",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Received Bytes"]],
            },
            crp: {
              name: "Columns: Received Packets",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Received Packets"]],
            },
            cpm: {
              name: "Columns: Purgeable Memory",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Purgeable Memory"]],
            },
            cm: {
              name: "Columns: Memory",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Memory"]],
            },
            ccm: {
              name: "Columns: Compressed Memory",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Compressed Memory"]],
            },
            cbw: {
              name: "Columns: Bytes Written",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Bytes Written"]],
            },
            cbr: {
              name: "Columns: Bytes Read",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Bytes Read"]],
            },
            cps: {
              name: "Columns: Preventing Sleep",
              "@input:menu": ["BY_PATH", ["View", "Columns", "Preventing Sleep"]],
            },
          },
        },
      },
    },
  },
  "macos.toml": {
    name: "Activity Monitor",
    chords: {
      "/am": {
        name: "Activity Monitor",
        shell: "open -a 'Activity Monitor'",
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
  dependencies,
  devDependencies,
  packageManager,
  chords,
};
//#endregion
export {
  categories,
  chords,
  package_default as default,
  dependencies,
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
