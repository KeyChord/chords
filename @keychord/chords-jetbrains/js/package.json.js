//#region package.json
var name = "@keychord/chords-jetbrains";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-jetbrains",
};
var type = "module";
var dependencies = {
  "nano-spawn-compat": "latest",
  outdent: "latest",
};
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "^1.4.3",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "base.toml": {
    name: "JetBrains Base Chords",
    meta: { $execPath: "" },
    on: {
      command: {
        file: "jetbrains.js",
        args: ["$execPath"],
      },
    },
    chords: {
      "?e": { name: "Editor" },
      ea: {
        name: "Editor: Actions",
        "@input:command": ["QuickActions"],
      },
      es: {
        name: "Editor: Solutions",
        "@input:command": ["QuickFixes"],
      },
      ef: {
        name: "Editor: Focus",
        shortcut: "esc",
      },
      ep: {
        name: "Editor: Pin",
        "@input:command": ["PinActiveEditorTab"],
      },
      eu: {
        name: "Editor: Unpin",
        "@input:command": ["PinActiveTabToggle"],
      },
      eq: {
        name: "Editor: Quit",
        "@input:command": ["CloseEditor"],
      },
      eqa: {
        name: "Editor: Quit All",
        "@input:command": ["CloseAllEditors"],
      },
      eqo: {
        name: "Editor: Quit Others",
        "@input:command": ["CloseAllEditorsButActive"],
      },
      eql: {
        name: "Editor: Quit to the Left",
        "@input:command": ["CloseEditorsToTheLeft"],
      },
      eqr: {
        name: "Editor: Quit to the Right",
        "@input:command": ["CloseEditorsToTheRight"],
      },
      equ: {
        name: "Editor: Quit Unmodified",
        "@input:command": ["CloseUnmodifiedEditors"],
      },
      eqp: {
        name: "Editor: Quit Pinless",
        "@input:command": ["CloseUnpinnedEditors"],
      },
      "?t": { name: "Tab" },
      ta: {
        name: "Tab: All",
        command: "action('TabList')",
      },
      tv: {
        name: "Tab: Previous",
        command: "action('PreviousTab')",
      },
      tx: {
        name: "Tab: Next",
        command: "action('NextTab')",
      },
      tb: {
        name: "Tab: Back",
        command: "action('GoToLastTab')",
      },
      to: {
        name: "Tab: Open Recently Closed",
        command: "action('ReopenClosedTab')",
      },
      t1: {
        name: "Tab 1",
        "@input:command": ["GoToTab1"],
      },
      t2: {
        name: "Tab 2",
        "@input:command": ["GoToTab2"],
      },
      t3: {
        name: "Tab 3",
        "@input:command": ["GoToTab3"],
      },
      t4: {
        name: "Tab 4",
        "@input:command": ["GoToTab4"],
      },
      t5: {
        name: "Tab 5",
        "@input:command": ["GoToTab5"],
      },
      t6: {
        name: "Tab 6",
        "@input:command": ["GoToTab6"],
      },
      t7: {
        name: "Tab 7",
        "@input:command": ["GoToTab7"],
      },
      t8: {
        name: "Tab 8",
        "@input:command": ["GoToTab8"],
      },
      t9: {
        name: "Tab 9",
        "@input:command": ["GoToTab9"],
      },
      td: {
        name: "Tab: Move Down",
        "@input:command": ["MoveTabDown"],
      },
      tr: {
        name: "Tab: Move Right",
        "@input:command": ["MoveTabRight"],
      },
      "?f": { name: "Find/File" },
      fr: {
        name: "Find and Replace",
        command: "Replace...",
        shortcut: "cmd+r",
      },
      "f]": {
        name: "Find: Next",
        command: "Find Next / Move to Next Occurrence",
        shortcut: "cmd+g",
      },
      "f[": {
        name: "Find: Previous",
        command: "Find Previous / Move to Previous Occurrence",
        shortcut: "cmd+shift+g",
      },
      fg: {
        name: "Find Globally",
        command: "Find in Files...",
        shortcut: "cmd+shift+f",
      },
      frg: {
        name: "Find and Replace Globally",
        command: "Replace in Files...",
        shortcut: "cmd+shift+r",
      },
      fa: {
        name: "Find Action",
        command: "Find Action...",
        shortcut: "cmd+shift+a",
      },
      fp: {
        name: "File: Path",
        shortcut: "cmd+shift+c",
      },
      fb: {
        name: "File: Back",
        command: "Recent Files",
        shortcut: "cmd+e",
      },
      fn: {
        name: "File: New",
        command: "New in This Directory",
        shortcut: "ctrl+option+n",
      },
      fnn: {
        name: "File: New Name",
        "@input:command": ["RenameFile"],
      },
      fns: {
        name: "File: New Scratch",
        shortcut: "cmd+shift+n",
      },
      fh: {
        name: "File: Here",
        "@input:command": ["NewFile"],
      },
      fd: {
        name: "File: Directory",
        "@input:command": ["NewDir"],
      },
      ft: {
        name: "File: Trash",
        shortcut: "cmd+delete",
      },
      fvs: {
        name: "File: View Structure",
        command: "File Structure",
        shortcut: "cmd+f12",
      },
      fs: {
        name: "File: Show",
        "@input:command": ["SelectInProjectView"],
      },
      "?b": { name: "Build" },
      bp: {
        name: "Build Project",
        command: "Build Project",
        shortcut: "cmd+f9",
      },
      br: {
        name: "Build: Rebuild",
        command: "Rebuild",
        shortcut: "cmd+shift+f9",
      },
      "?s": { name: "Split/Search" },
      sr: {
        name: "Split: Right",
        "@input:command": ["SplitHorizontally"],
      },
      sd: {
        name: "Split: Down",
        "@input:command": ["SplitVertically"],
      },
      so: {
        name: "Split: Orientation",
        "@input:command": ["ChangeSplitOrientation"],
      },
      sx: {
        name: "Split: Next",
        shortcut: "opt+right",
      },
      sv: {
        name: "Split: Previous",
        shortcut: "opt+shift+right",
      },
      sq: {
        name: "Split: Quit",
        "@input:command": ["Unsplit"],
      },
      sqa: {
        name: "Split: Quit All",
        "@input:command": ["UnsplitAll"],
      },
      sg: {
        name: "Search: Globally",
        command: "Search Everywhere",
        shortcut: "shift shift",
      },
      st: {
        name: "Search: Types",
        shortcut: "cmd+o",
      },
      sf: {
        name: "Search: Files",
        shortcut: "cmd+shift+o",
      },
      sy: {
        name: "Search: Symbols",
        shortcut: "cmd+option+o",
      },
      sa: {
        name: "Search: All",
        shortcut: "cmd+shift+a",
      },
      sc: {
        name: "Search: Content Text",
        shortcut: "cmd+shift+option+e",
      },
      ph: {
        name: "Paste from History...",
        command: "Paste from History...",
        shortcut: "cmd+shift+v",
      },
      cpp: {
        name: "Copy Paths",
        command: "Copy Paths",
        shortcut: "cmd+shift+c",
      },
      cpr: {
        name: "Copy Reference",
        command: "Copy Reference",
        shortcut: "cmd+option+shift+c",
      },
      sva: {
        name: "Save All",
        command: "Save All",
        shortcut: "cmd+s",
      },
      ud: {
        name: "Undo",
        command: "Undo",
        shortcut: "cmd+z",
      },
      rd: {
        name: "Redo",
        command: "Redo",
        shortcut: "cmd+shift+z",
      },
      is: {
        name: "Indent Selection",
        command: "Indent Selection",
        shortcut: "tab",
      },
      uis: {
        name: "Unindent Selection",
        command: "Unindent Line or Selection",
        shortcut: "shift+tab",
      },
      ail: {
        name: "Auto-Indent Lines",
        command: "Auto-Indent Lines",
        shortcut: "ctrl+option+i",
      },
      ln: {
        name: "Line: New",
        command: "Start New Line",
        shortcut: "shift+enter",
      },
      lb: {
        name: "Line: Before New",
        command: "Start New Line Before Current",
        shortcut: "cmd+option+enter",
      },
      ld: {
        name: "Line: Delete",
        command: "Delete Line",
        shortcut: "cmd+backspace",
      },
      lj: {
        name: "Line: Join",
        command: "Join Lines",
        shortcut: "ctrl+shift+j",
      },
      lc: {
        name: "Line: Clone",
        command: "Duplicate Line or Selection",
        shortcut: "cmd+d",
      },
      tgc: {
        name: "Toggle Case",
        command: "Toggle Case",
        shortcut: "cmd+shift+u",
      },
      os: {
        name: "Open Source",
        command: "Open Source in New Window",
        shortcut: "shift+f4",
      },
      fsi: {
        name: "Font Size: Increase",
        command: "Increase Font Size in All Editors",
        shortcut: "ctrl+shift+.",
      },
      fsd: {
        name: "Font Size: Decrease",
        command: "Decrease Font Size in All Editors",
        shortcut: "ctrl+shift+,",
      },
      "?ff": { name: "Folding" },
      ff: {
        name: "Folding: Fold",
        command: "Collapse",
        shortcut: "cmd+NumpadSubtract",
      },
      ffs: {
        name: "Folding: Fold Selection",
        command: "Fold Selection",
        shortcut: "cmd+.",
      },
      ffa: {
        name: "Folding: Fold All",
        command: "Expand All",
        shortcut: "cmd+shift+NumpadAdd",
      },
      ffc: {
        name: "Folding: Fold Comments",
        "@input:command": ["CollapseDocComments"],
      },
      ffr: {
        name: "Folding: Fold Recursively",
        command: "Collapse Recursively",
        shortcut: "cmd+option+NumpadSubtract",
      },
      "?fu": { name: "Folding Unfold" },
      fu: {
        name: "Folding: Unfold",
        command: "Expand",
        shortcut: "cmd+NumpadAdd",
      },
      fua: {
        name: "Folding: Unfold All",
        command: "Collapse All",
        shortcut: "cmd+shift+NumpadSubtract",
      },
      fuc: {
        name: "Folding: Unfold Comments",
        "@input:command": ["ExpandDocComments"],
      },
      fur: {
        name: "Folding: Unfold Recursively",
        command: "Expand Recursively",
        shortcut: "cmd+option+NumpadAdd",
      },
      '?f"1-5"': { name: "Folding Level" },
      "?fl": { name: "Folding Level" },
      fl: {
        name: "Folding: Level",
        "@input:command": ["ExpandToLevel"],
      },
      f1: {
        name: "Folding: Level 1",
        "@input:command": ["ExpandToLevel1"],
      },
      f2: {
        name: "Folding: Level 2",
        "@input:command": ["ExpandToLevel2"],
      },
      f3: {
        name: "Folding: Level 3",
        "@input:command": ["ExpandToLevel3"],
      },
      f4: {
        name: "Folding: Level 4",
        "@input:command": ["ExpandToLevel4"],
      },
      f5: {
        name: "Folding: Level 5",
        "@input:command": ["ExpandToLevel5"],
      },
      '?fa"1-5"': { name: "Folding All Level" },
      "?fal": { name: "Folding All Level" },
      fal: {
        name: "Folding: All Level",
        "@input:command": ["ExpandAllToLevel"],
      },
      fa1: {
        name: "Folding: All Level 1",
        "@input:command": ["ExpandAllToLevel1"],
      },
      fa2: {
        name: "Folding: All Level 2",
        "@input:command": ["ExpandAllToLevel2"],
      },
      fa3: {
        name: "Folding: All Level 3",
        "@input:command": ["ExpandAllToLevel3"],
      },
      fa4: {
        name: "Folding: All Level 4",
        "@input:command": ["ExpandAllToLevel4"],
      },
      fa5: {
        name: "Folding: All Level 5",
        "@input:command": ["ExpandAllToLevel5"],
      },
      "?c": { name: "Completion / Code / Context" },
      cb: {
        name: "Completion: Basic",
        shortcut: "ctrl+space",
      },
      ct: {
        name: "Completion: Type-Matching",
        shortcut: "ctrl+shift+space",
      },
      cs: {
        name: "Completion: Second Basic",
        shortcut: "ctrl+option+space",
      },
      ca: {
        name: "Completion: AI",
        shortcut: "option+backslash",
      },
      cag: {
        name: "Completion: AI Generate",
        shortcut: "cmd+backslash",
      },
      ccs: {
        name: "Completion: Current Statement",
        shortcut: "cmd+shift+enter",
      },
      cf: {
        name: "Code: Format",
        shortcut: "cmd+option+l",
      },
      cd: {
        name: "Code: Documentation",
        command: "Quick Documentation",
        shortcut: "f1",
      },
      cp: {
        name: "Code: Parameter Info",
        command: "Parameter Info",
        shortcut: "cmd+p",
      },
      cc: {
        name: "Code: Comment",
        command: "Comment with Line Comment",
        shortcut: "cmd+/",
      },
      ccb: {
        name: "Code: Comment Block",
        command: "Comment with Block Comment",
        shortcut: "cmd+option+/",
      },
      cg: {
        name: "Code: Generate",
        shortcut: "cmd+n",
      },
      csw: {
        name: "Code: Surround With",
        shortcut: "cmd+option+t",
      },
      csu: {
        name: "Code: Statement Up",
        shortcut: "cmd+shift+up",
      },
      csd: {
        name: "Code: Statement Down",
        shortcut: "cmd+shift+down",
      },
      cel: {
        name: "Code: Element Left",
        shortcut: "cmd+option+shift+left",
      },
      cer: {
        name: "Code: Element Right",
        shortcut: "cmd+option+shift+right",
      },
      clu: {
        name: "Code: Line Up",
        shortcut: "option+shift+up",
      },
      cld: {
        name: "Code: Line Down",
        shortcut: "option+shift+down",
      },
      ci: {
        name: "Code: Intention Actions",
        command: "Show Intention Actions",
        shortcut: "option+enter",
      },
      ce: {
        name: "Code: Error Description",
        command: "Error Description",
        shortcut: "cmd+f1",
      },
      "c]": {
        name: "Context: Next",
        command: "Forward",
        shortcut: "cmd+]",
      },
      "c[": {
        name: "Context: Previous",
        command: "Back",
        shortcut: "cmd+[",
      },
      "?g": { name: "Goto / Git" },
      gl: {
        name: "Go to Line/Column...",
        command: "Go to Line/Column...",
        shortcut: "cmd+l",
      },
      gk: {
        name: "Goto Class",
        "@input:command": ["GotoClass"],
      },
      gpx: {
        name: "Goto Problem: Next",
        command: "Next Highlighted Error",
        shortcut: "f2",
      },
      gpv: {
        name: "Goto Problem: Previous",
        command: "Previous Highlighted Error",
        shortcut: "shift+f2",
      },
      gd: {
        name: "Goto Declaration or Usages",
        command: "Go to Declaration or Usages",
        shortcut: "cmd+b",
      },
      gy: {
        name: "Goto Type Declaration",
        command: "Go to Type Declaration",
        shortcut: "cmd+shift+b",
      },
      gsm: {
        name: "Goto Super Method",
        command: "Go to Super Method",
        shortcut: "cmd+u",
      },
      gm: {
        name: "Goto Menu",
        "@input:command": ["GoToMenu"],
      },
      gi: {
        name: "Goto Implementation(s)",
        command: "Go to Implementation(s)",
        shortcut: "cmd+option+b",
      },
      gs: {
        name: "Goto Symbol",
        command: "Go to Symbol...",
        shortcut: "cmd+option+o",
      },
      gt: {
        name: "Goto Test",
        command: "Go to Test",
        shortcut: "cmd+shift+t",
      },
      gcv: {
        name: "Goto Change: Previous",
        command: "Previous Change",
        shortcut: "ctrl+option+shift+up",
      },
      gcx: {
        name: "Goto Change: Next",
        command: "Next Change",
        shortcut: "ctrl+option+shift+down",
      },
      "gb`": {
        name: "Go to Bookmark with Digit",
        command: "Go to Bookmark with Digit",
        shortcut: "ctrl",
      },
      "?gb": { name: "Goto Bookmark" },
      gb0: {
        name: "Goto Bookmark: 0",
        "@input:command": ["GotoBookmark0"],
      },
      gb1: {
        name: "Goto Bookmark: 1",
        "@input:command": ["GotoBookmark1"],
      },
      gb2: {
        name: "Goto Bookmark: 2",
        "@input:command": ["GotoBookmark2"],
      },
      gb3: {
        name: "Goto Bookmark: 3",
        "@input:command": ["GotoBookmark3"],
      },
      gb4: {
        name: "Goto Bookmark: 4",
        "@input:command": ["GotoBookmark4"],
      },
      gb5: {
        name: "Goto Bookmark: 5",
        "@input:command": ["GotoBookmark5"],
      },
      gb6: {
        name: "Goto Bookmark: 6",
        "@input:command": ["GotoBookmark6"],
      },
      gb7: {
        name: "Goto Bookmark: 7",
        "@input:command": ["GotoBookmark7"],
      },
      gb8: {
        name: "Goto Bookmark: 8",
        "@input:command": ["GotoBookmark8"],
      },
      gb9: {
        name: "Goto Bookmark: 9",
        "@input:command": ["GotoBookmark9"],
      },
      gba: {
        name: "Goto Bookmark: A",
        "@input:command": ["GotoBookmarkA"],
      },
      gbb: {
        name: "Goto Bookmark: B",
        "@input:command": ["GotoBookmarkB"],
      },
      gbc: {
        name: "Goto Bookmark: C",
        "@input:command": ["GotoBookmarkC"],
      },
      gbd: {
        name: "Goto Bookmark: D",
        "@input:command": ["GotoBookmarkD"],
      },
      gbe: {
        name: "Goto Bookmark: E",
        "@input:command": ["GotoBookmarkE"],
      },
      gbf: {
        name: "Goto Bookmark: F",
        "@input:command": ["GotoBookmarkF"],
      },
      gbg: {
        name: "Goto Bookmark: G",
        "@input:command": ["GotoBookmarkG"],
      },
      gbh: {
        name: "Goto Bookmark: H",
        "@input:command": ["GotoBookmarkH"],
      },
      gbi: {
        name: "Goto Bookmark: I",
        "@input:command": ["GotoBookmarkI"],
      },
      gbj: {
        name: "Goto Bookmark: J",
        "@input:command": ["GotoBookmarkJ"],
      },
      gbk: {
        name: "Goto Bookmark: K",
        "@input:command": ["GotoBookmarkK"],
      },
      gbl: {
        name: "Goto Bookmark: L",
        "@input:command": ["GotoBookmarkL"],
      },
      gbm: {
        name: "Goto Bookmark: M",
        "@input:command": ["GotoBookmarkM"],
      },
      gbn: {
        name: "Goto Bookmark: N",
        "@input:command": ["GotoBookmarkN"],
      },
      gbo: {
        name: "Goto Bookmark: O",
        "@input:command": ["GotoBookmarkO"],
      },
      gbp: {
        name: "Goto Bookmark: P",
        "@input:command": ["GotoBookmarkP"],
      },
      gbq: {
        name: "Goto Bookmark: Q",
        "@input:command": ["GotoBookmarkQ"],
      },
      gbr: {
        name: "Goto Bookmark: R",
        "@input:command": ["GotoBookmarkR"],
      },
      gbs: {
        name: "Goto Bookmark: S",
        "@input:command": ["GotoBookmarkS"],
      },
      gbt: {
        name: "Goto Bookmark: T",
        "@input:command": ["GotoBookmarkT"],
      },
      gbu: {
        name: "Goto Bookmark: U",
        "@input:command": ["GotoBookmarkU"],
      },
      gbv: {
        name: "Goto Bookmark: V",
        "@input:command": ["GotoBookmarkV"],
      },
      gbw: {
        name: "Goto Bookmark: W",
        "@input:command": ["GotoBookmarkW"],
      },
      gbx: {
        name: "Goto Bookmark: X",
        "@input:command": ["GotoBookmarkX"],
      },
      gby: {
        name: "Goto Bookmark: Y",
        "@input:command": ["GotoBookmarkY"],
      },
      gbz: {
        name: "Goto Bookmark: Z",
        "@input:command": ["GotoBookmarkZ"],
      },
      go: {
        name: "Git: Operations",
        command: "VCS Operations Popup...",
        shortcut: "ctrl+v",
      },
      gc: {
        name: "Git: Commit...",
        command: "Commit...",
        shortcut: "cmd+k",
      },
      gu: {
        name: "Git: Update Project",
        command: "Update Project",
        shortcut: "cmd+t",
      },
      gr: {
        name: "Git: Rollback",
        command: "Rollback",
        shortcut: "cmd+option+z",
      },
      gp: {
        name: "Git: Push...",
        command: "Push...",
        shortcut: "cmd+shift+k",
      },
      "?u": { name: "Usages" },
      uh: {
        name: "Usages: Highlight in File",
        command: "Highlight Usages in File",
        shortcut: "cmd+shift+f7",
      },
      uf: {
        name: "Usages: Find",
        command: "Find Usages",
        shortcut: "option+f7",
      },
      us: {
        name: "Usages: Show",
        command: "Show Usages",
        shortcut: "cmd+option+f7",
      },
      "?r": { name: "Run" },
      ru: {
        name: "Run...",
        command: "Run...",
        shortcut: "ctrl+option+r",
      },
      ra: {
        name: "Run Anything",
        command: "Run Anything",
        shortcut: "ctrl+ctrl",
      },
      rcc: {
        name: "Run context configuration",
        command: "Run context configuration",
        shortcut: "ctrl+r",
      },
      rs: {
        name: "Run: Stop",
        command: "Stop",
        shortcut: "cmd+f2",
      },
      rr: {
        name: "Run: Resume Program",
        command: "Resume Program",
        shortcut: "cmd+option+r",
      },
      ri: {
        name: "Run Inspection by Name...",
        command: "Run Inspection by Name...",
        shortcut: "cmd+option+shift+i",
      },
      "?d": { name: "Diff" },
      dc: {
        name: "Diff: Compare Files",
        command: "Compare Files",
        shortcut: "cmd+d",
      },
      ds: {
        name: "Diff: Show",
        command: "Show Diff",
        shortcut: "cmd+d",
      },
      dx: {
        name: "Diff: Next",
        command: "Next Difference",
        shortcut: "f7",
      },
      dv: {
        name: "Diff: Previous",
        command: "Previous Difference",
        shortcut: "shift+f7",
      },
      do: {
        name: "Diff: Opposite Pane",
        command: "Select Opposite Diff Pane",
        shortcut: "ctrl+shift+tab",
      },
      dl: {
        name: "Diff: Left Accept",
        command: "Accept Left Side",
        shortcut: "cmd+ctrl+right",
      },
      dr: {
        name: "Diff: Right Accept",
        command: "Accept Right Side",
        shortcut: "cmd+ctrl+left",
      },
      dss: {
        name: "Diff: Show Settings",
        command: "Show Diff Settings Popup...",
        shortcut: "cmd+shift+d",
      },
      "?p": { name: "Panel" },
      "?ph": { name: "Panel: Hide" },
      phc: {
        name: "Panel: Hide Current",
        command: "Hide Active Tool Window",
        shortcut: "shift+esc",
      },
      pha: {
        name: "Panel: Hide All",
        command: "Hide All Tool Windows",
        shortcut: "cmd+shift+f12",
      },
      "?pr": { name: "Panel: Run / Resize" },
      pr: {
        name: "Panel: Run",
        command: "Show Run window",
        shortcut: "cmd+4",
      },
      prl: {
        name: "Panel: Stretch Left",
        "@input:command": "ResizeToolWindowLeft",
        shortcut: "ctrl+option+left",
      },
      prr: {
        name: "Panel: Resize Right",
        command: "ResizeToolWindowRight",
        shortcut: "ctrl+option+right",
      },
      pru: {
        name: "Panel: Resize Top",
        command: "ResizeToolWindowUp",
        shortcut: "ctrl+option+up",
      },
      prd: {
        name: "Panel: Resize Down",
        command: "ResizeToolWindowDown",
        shortcut: "ctrl+option+down",
      },
      "p[": {
        name: "Panel: Back",
        command: "Jump to Last Tool Window",
        shortcut: "f12",
      },
      pb: {
        name: "Panel: Build",
        "@input:command": "ActivateBuildToolWindow",
      },
      ptc: {
        name: "Panel: Test Coverage",
        "@input:command": "ActivateCoverageToolWindow",
      },
      pp: {
        name: "Panel: Project",
        command: "Show Project window",
        shortcut: "cmd+1",
      },
      pm: {
        name: "Panel: Marks",
        command: "Show Bookmarks window",
        shortcut: "cmd+2",
      },
      pf: {
        name: "Panel: Find",
        command: "Show Find window",
        shortcut: "cmd+3",
      },
      pd: {
        name: "Panel: Debug",
        command: "Show Debug window",
        shortcut: "cmd+5",
      },
      pi: {
        name: "Panel: Issues",
        command: "Show Problems window",
        shortcut: "cmd+6",
      },
      ps: {
        name: "Panel: Structure",
        command: "Show Structure window",
        shortcut: "cmd+7",
      },
      pv: {
        name: "Panel: Services",
        command: "Show Services window",
        shortcut: "cmd+9",
      },
      pg: {
        name: "Panel: Git",
        command: "Show Version Control window",
        shortcut: "cmd+9",
      },
      pc: {
        name: "Panel: Commit",
        command: "Show Commit window",
        shortcut: "cmd+0",
      },
      pt: {
        name: "Panel: Terminal",
        command: "Show Terminal window",
        shortcut: "opt+f12",
      },
      "?z": { name: "Zoom / Zen" },
      zo: {
        name: "Zoom Out",
        "@input:command": ["ZoomOutIdeAction"],
      },
      zi: {
        name: "Zoom In",
        "@input:command": ["ZoomInIdeAction"],
      },
      zm: {
        name: "Zen Mode",
        "@input:command": ["ToggleZenMode"],
      },
    },
  },
  com: {
    jetbrains: {
      CLion: {
        "macos.toml": {
          name: "CLion",
          import: [
            {
              file: "base.toml",
              override: { meta: { $execPath: "/Applications/CLion.app/Contents/MacOS/clion" } },
            },
          ],
        },
      },
      PhpStorm: {
        "macos.toml": {
          name: "PhpStorm",
          import: [
            {
              file: "base.toml",
              override: {
                meta: { $execPath: "/Applications/PhpStorm.app/Contents/MacOS/phpstorm" },
              },
            },
          ],
        },
      },
      WebStorm: {
        "macos.toml": {
          name: "WebStorm",
          import: [
            {
              file: "base.toml",
              override: {
                meta: { $execPath: "/Applications/WebStorm.app/Contents/MacOS/webstorm" },
              },
            },
          ],
        },
      },
      datagrip: {
        "macos.toml": {
          name: "DataGrip",
          import: [
            {
              file: "base.toml",
              override: {
                meta: { $execPath: "/Applications/DataGrip.app/Contents/MacOS/datagrip" },
              },
            },
          ],
        },
      },
      goland: {
        "macos.toml": {
          name: "GoLand",
          import: [
            {
              file: "base.toml",
              override: { meta: { $execPath: "/Applications/GoLand.app/Contents/MacOS/goland" } },
            },
          ],
        },
      },
      intellij: {
        "macos.toml": {
          name: "IntelliJ IDEA",
          import: [
            {
              file: "base.toml",
              override: {
                meta: { $execPath: "/Applications/IntelliJ IDEA.app/Contents/MacOS/idea" },
              },
            },
          ],
        },
      },
      pycharm: {
        "macos.toml": {
          name: "PyCharm",
          import: [
            {
              file: "base.toml",
              override: { meta: { $execPath: "/Applications/PyCharm.app/Contents/MacOS/pycharm" } },
            },
          ],
        },
      },
      rider: {
        "macos.toml": {
          name: "Rider",
          import: [
            {
              file: "base.toml",
              override: { meta: { $execPath: "/Applications/Rider.app/Contents/MacOS/rider" } },
            },
          ],
        },
      },
      rubymine: {
        "macos.toml": {
          name: "RubyMine",
          import: [
            {
              file: "base.toml",
              override: {
                meta: { $execPath: "/Applications/RubyMine.app/Contents/MacOS/rubymine" },
              },
            },
          ],
        },
      },
      rustrover: {
        "macos.toml": {
          name: "RustRover",
          import: [
            {
              file: "base.toml",
              override: {
                meta: { $execPath: "/Applications/RustRover.app/Contents/MacOS/rustrover" },
              },
            },
          ],
        },
      },
    },
  },
};
var package_default = {
  name,
  repository,
  type,
  dependencies,
  devDependencies,
  packageManager,
  chords,
};
//#endregion
export {
  chords,
  package_default as default,
  dependencies,
  devDependencies,
  name,
  packageManager,
  repository,
  type,
};
