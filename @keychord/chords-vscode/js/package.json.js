//#region package.json
var name = "@keychord/chords-vscode";
var version = "0.0.0";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-vscode",
};
var type = "module";
var dependencies = { "nano-spawn-compat": "latest" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    microsoft: {
      VSCode: {
        "macos.toml": {
          name: "VSCode",
          on: {
            command: {
              file: "vscode.js",
              args: ["/Applications/Visual Studio Code.app"],
            },
          },
          chords: {
            "?f": { name: "Find / File" },
            "f[": [
              {
                name: "Find Previous",
                "@input:command": ["workbench.action.browser.findPrevious"],
                shortcut: "shift+cmd+g",
              },
              {
                name: "workbench.action.terminal.findPrevious",
                "@input:command": ["workbench.action.terminal.findPrevious"],
                shortcut: "shift+f3",
              },
            ],
            "f]": [
              {
                name: "Find Next",
                "@input:command": ["workbench.action.browser.findNext"],
                shortcut: "cmd+g",
              },
              {
                name: "workbench.action.terminal.findNext",
                "@input:command": ["workbench.action.terminal.findNext"],
                shortcut: "f3",
              },
            ],
            fr: {
              name: "Find and Replace",
              "@input:command": ["editor.action.startFindReplaceAction"],
              shortcut: "alt+cmd+f",
            },
            fg: {
              name: "Find Globally",
              "@input:command": ["workbench.action.findInFiles"],
              shortcut: "shift+cmd+f",
            },
            frg: {
              name: "Find Replace Globally",
              "@input:command": ["workbench.action.replaceInFiles"],
              shortcut: "shift+cmd+h",
            },
            fpa: {
              name: "File Path: Absolute (copy to clipboard)",
              "@input:command": ["copyFilePath"],
            },
            fpr: {
              name: "File: Path: Relative (copy to clipboard)",
              "@input:command": ["workbench.action.files.copyPathOfActiveFile"],
            },
            frp: {
              name: "File: Relative Path",
              "@input:command": ["copyRelativeFilePath"],
              shortcut: "shift+alt+cmd+c",
            },
            fn: {
              name: "File: New",
              shortcut: "ctrl+opt+cmd+n",
            },
            fnn: {
              name: "File: New Name",
              "@input:command": ["renameFile"],
            },
            fh: {
              name: "File: Here",
              "@input:command": ["explorer.newFile"],
            },
            fd: {
              name: "File: Directory",
              "@input:command": ["explorer.newFolder"],
            },
            fc: {
              name: "File: Close Directory",
              "@input:command": ["workbench.action.closeFolder"],
              shortcut: "cmd+k f",
            },
            fnu: {
              name: "File: New Untitled File",
              "@input:command": ["workbench.action.files.newUntitledFile"],
              shortcut: "cmd+n",
            },
            ft: {
              name: "File: Trash",
              "@input:command": ["deleteFile"],
              shortcut: "alt+cmd+backspace",
            },
            fm: {
              name: "File: Format",
              "@input:command": ["editor.action.formatDocument"],
              shortcut: "shift+alt+f",
            },
            fs: {
              name: "File: Show",
              "@input:command": ["revealInExplorer"],
            },
            fra: {
              name: "search.action.replaceAllInFile",
              "@input:command": ["search.action.replaceAllInFile"],
              shortcut: "shift+cmd+enter",
            },
            fo: {
              name: "File: Open",
              "@input:command": ["workbench.action.files.openFile"],
              shortcut: "cmd+o",
            },
            for: {
              name: "File: Open Recent",
              "@input:command": ["workbench.action.openRecent"],
              shortcut: "ctrl+r",
            },
            "?ff": { name: "Folding: Fold" },
            ff: {
              name: "Folding: Fold",
              "@input:command": ["editor.fold"],
              shortcut: "alt+cmd+[",
            },
            ffa: {
              name: "Folding: Fold All",
              "@input:command": ["editor.foldAll"],
              shortcut: "cmd+k cmd+0",
            },
            ffc: {
              name: "Folding: Fold Comments",
              "@input:command": ["editor.foldAllBlockComments"],
              shortcut: "cmd+k cmd+/",
            },
            ffr: {
              name: "Folding: Fold Recursively",
              "@input:command": ["editor.foldRecursively"],
              shortcut: "cmd+k cmd+[",
            },
            ffe: {
              name: "Folding: Fold All Except",
              "@input:command": ["editor.foldAllExcept"],
              shortcut: "cmd+k cmd+-",
            },
            ffm: {
              name: "Folding: Fold All Marker Regions",
              "@input:command": ["editor.foldAllMarkerRegions"],
              shortcut: "cmd+k cmd+8",
            },
            "?fu": { name: "Folding: Unfold" },
            fu: {
              name: "Folding: Unfold",
              "@input:command": ["editor.unfold"],
              shortcut: "alt+cmd+]",
            },
            fua: {
              name: "Folding: Unfold All",
              "@input:command": ["editor.unfoldAll"],
              shortcut: "cmd+k cmd+j",
            },
            fuc: {
              name: "Folding: Unfold Comments",
              "@input:command": ["editor.unfoldAllBlockComments"],
            },
            fur: {
              name: "Folding: Unfold Recursively",
              "@input:command": ["editor.unfoldRecursively"],
              shortcut: "cmd+k cmd+]",
            },
            fue: {
              name: "Folding: Unfold All Except",
              "@input:command": ["editor.unfoldAllExcept"],
              shortcut: "cmd+k cmd+=",
            },
            fum: {
              name: "Folding: Unfold All Marker Regions",
              "@input:command": ["editor.unfoldAllMarkerRegions"],
              shortcut: "cmd+k cmd+9",
            },
            ffs: {
              name: "Folding: From Selection",
              "@input:command": ["editor.createFoldingRangeFromSelection"],
              shortcut: "cmd+k cmd+,",
            },
            frm: {
              name: "Folding: Remove Manual",
              "@input:command": ["editor.removeManualFoldingRanges"],
              shortcut: "cmd+k cmd+.",
            },
            ftr: {
              name: "Folding: Toggle Recursively",
              "@input:command": ["editor.toggleFoldRecursively"],
              shortcut: "cmd+k shift+cmd+l",
            },
            '?f"1-7"': { name: "Folding: Level" },
            f1: {
              name: "editor.foldLevel1",
              "@input:command": ["editor.foldLevel1"],
              shortcut: "cmd+k cmd+1",
            },
            f2: {
              name: "editor.foldLevel2",
              "@input:command": ["editor.foldLevel2"],
              shortcut: "cmd+k cmd+2",
            },
            f3: {
              name: "editor.foldLevel3",
              "@input:command": ["editor.foldLevel3"],
              shortcut: "cmd+k cmd+3",
            },
            f4: {
              name: "editor.foldLevel4",
              "@input:command": ["editor.foldLevel4"],
              shortcut: "cmd+k cmd+4",
            },
            f5: {
              name: "editor.foldLevel5",
              "@input:command": ["editor.foldLevel5"],
              shortcut: "cmd+k cmd+5",
            },
            f6: {
              name: "editor.foldLevel6",
              "@input:command": ["editor.foldLevel6"],
              shortcut: "cmd+k cmd+6",
            },
            f7: {
              name: "editor.foldLevel7",
              "@input:command": ["editor.foldLevel7"],
              shortcut: "cmd+k cmd+7",
            },
            hb: {
              name: "History: Back",
              "@input:command": ["workbench.action.navigateBack"],
              shortcut: "BrowserBack",
            },
            hf: {
              name: "History: Forward",
              "@input:command": ["workbench.action.navigateForward"],
              shortcut: "BrowserForward",
            },
            "?p": { name: "Panel" },
            pa: {
              name: "Panel: AI",
              "@input:command": ["workbench.panel.chat"],
              shortcut: "ctrl+cmd+i",
            },
            pd: {
              name: "Panel: Debug",
              "@input:command": ["workbench.view.debug"],
              shortcut: "shift+cmd+d",
            },
            pe: {
              name: "Panel: Explorer",
              "@input:command": ["workbench.view.explorer"],
              shortcut: "shift+cmd+e",
            },
            pg: {
              name: "Panel: Git",
              "@input:command": ["workbench.view.scm"],
              shortcut: "ctrl+shift+g",
            },
            pmd: {
              name: "Panel: Move Down",
              "@input:command": ["views.moveViewDown"],
              shortcut: "cmd+k down",
            },
            pml: {
              name: "Panel: Move Left",
              "@input:command": ["views.moveViewLeft"],
              shortcut: "cmd+k left",
            },
            pmr: {
              name: "Panel: Move Right",
              "@input:command": ["views.moveViewRight"],
              shortcut: "cmd+k right",
            },
            pmu: {
              name: "Panel: Move Up",
              "@input:command": ["views.moveViewUp"],
              shortcut: "cmd+k up",
            },
            pp: {
              name: "Panel: Problems",
              "@input:command": ["workbench.actions.view.problems"],
              shortcut: "shift+cmd+m",
            },
            ps: {
              name: "Panel: Search",
              "@input:command": ["workbench.view.search"],
              shortcut: "shift+cmd+f",
            },
            psb: {
              name: "Panel: Side Bar",
              "@input:command": ["workbench.action.toggleSidebarVisibility"],
              shortcut: "cmd+b",
            },
            pm: {
              name: "Panel: Marketplace",
              "@input:command": ["workbench.view.extensions"],
              shortcut: "shift+cmd+x",
            },
            po: {
              name: "Panel: Open",
              "@input:command": ["workbench.action.quickOpenView"],
              shortcut: "cmd+shift+p v i e w space",
            },
            pf: {
              name: "Panel: Forward",
              "@input:command": ["workbench.action.quickOpenNavigateNextInViewPicker"],
              shortcut: "ctrl+q",
            },
            pb: {
              name: "Panel: Back",
              "@input:command": ["workbench.action.quickOpenNavigatePreviousInViewPicker"],
              shortcut: "ctrl+shift+q",
            },
            pi: {
              name: "Panel: Info",
              "@input:command": ["workbench.action.togglePanel"],
              shortcut: "cmd+j",
            },
            px: {
              name: "Panel: Next",
              "@input:command": ["workbench.action.focusNextPart"],
              shortcut: "f6",
            },
            pv: {
              name: "Panel: Forward",
              "@input:command": ["workbench.action.focusPreviousPart"],
              shortcut: "shift+f6",
            },
            pgk: {
              name: "Page: Keybindings",
              "@input:command": ["workbench.action.openGlobalKeybindings"],
              shortcut: "cmd+k cmd+s",
            },
            pgs: {
              name: "Page: Settings",
              "@input:command": ["workbench.action.openSettings"],
              shortcut: "cmd+,",
            },
            "?e": { name: "Editor" },
            ea: {
              name: "Editor: Actions",
              "@input:command": ["editor.action.quickFix"],
              shortcut: "cmd+.",
            },
            ek: {
              name: "Editor: Kwik Fix",
              "@input:command": ["editor.action.quickFix"],
              shortcut: "cmd+.",
            },
            es: {
              name: "Editor: Focus",
              "@input:command": ["workbench.action.focusActiveEditorGroup"],
            },
            ep: {
              name: "Editor: Pin",
              "@input:command": ["workbench.action.pinEditor"],
              shortcut: "cmd+k shift+enter",
            },
            eu: {
              name: "Editor: Unpin",
              "@input:command": ["workbench.action.unpinEditor"],
              shortcut: "cmd+k shift+enter",
            },
            esa: {
              name: "Editor: Show All",
              "@input:command": ["workbench.action.showAllEditors"],
              shortcut: "alt+cmd+tab",
            },
            eo: {
              name: "Editor: Open Recently Closed",
              "@input:command": ["workbench.action.reopenClosedEditor"],
              shortcut: "shift+cmd+t",
            },
            "e[": {
              name: "Editor: Previous",
              "@input:command": ["workbench.action.previousEditorInGroup"],
              shortcut: "cmd+k alt+cmd+left",
            },
            "e]": {
              name: "Editor: Next",
              "@input:command": ["workbench.action.nextEditor"],
              shortcut: "shift+cmd+]",
            },
            "e]g": {
              name: "Editor: Next in Group",
              "@input:command": ["workbench.action.nextEditorInGroup"],
              shortcut: "cmd+k alt+cmd+right",
            },
            ef: {
              name: "Editor: Forward",
              "@input:command": ["workbench.action.quickOpenLeastRecentlyUsedEditorInGroup"],
              shortcut: "ctrl+shift+tab",
            },
            eb: {
              name: "Editor: Back",
              "@input:command": ["workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup"],
              shortcut: "ctrl+tab",
            },
            "?eq": { name: "Editor: Quit" },
            eq: {
              name: "Editor: Quit",
              "@input:command": ["workbench.action.closeActiveEditor"],
              shortcut: "cmd+w",
            },
            eqa: {
              name: "Editor: Quit All",
              "@input:command": ["workbench.action.closeAllEditors"],
              shortcut: "cmd+k cmd+w",
            },
            eqo: {
              name: "Editor: Quit Others",
              "@input:command": ["workbench.action.closeOtherEditors"],
              shortcut: "alt+cmd+t",
            },
            equ: {
              name: "Split: Quit Unmodified",
              "@input:command": ["workbench.action.closeUnmodifiedEditors"],
              shortcut: "cmd+k u",
            },
            "?eg": { name: "Editor Group" },
            egd: {
              name: "workbench.action.moveActiveEditorGroupDown",
              "@input:command": ["workbench.action.moveActiveEditorGroupDown"],
              shortcut: "cmd+k down",
            },
            egl: {
              name: "workbench.action.moveActiveEditorGroupLeft",
              "@input:command": ["workbench.action.moveActiveEditorGroupLeft"],
              shortcut: "cmd+k left",
            },
            egr: {
              name: "workbench.action.moveActiveEditorGroupRight",
              "@input:command": ["workbench.action.moveActiveEditorGroupRight"],
              shortcut: "cmd+k right",
            },
            egu: {
              name: "workbench.action.moveActiveEditorGroupUp",
              "@input:command": ["workbench.action.moveActiveEditorGroupUp"],
              shortcut: "cmd+k up",
            },
            "?t": { name: "Tab / Terminal" },
            t1: {
              name: "Tab 1",
              "@input:command": ["workbench.action.openEditorAtIndex1"],
              shortcut: "ctrl+1",
            },
            t2: {
              name: "Tab 2",
              "@input:command": ["workbench.action.openEditorAtIndex2"],
              shortcut: "ctrl+2",
            },
            t3: {
              name: "Tab 3",
              "@input:command": ["workbench.action.openEditorAtIndex3"],
              shortcut: "ctrl+3",
            },
            t4: {
              name: "Tab 4",
              "@input:command": ["workbench.action.openEditorAtIndex4"],
              shortcut: "ctrl+4",
            },
            t5: {
              name: "Tab 5",
              "@input:command": ["workbench.action.openEditorAtIndex5"],
              shortcut: "ctrl+5",
            },
            t6: {
              name: "Tab 6",
              "@input:command": ["workbench.action.openEditorAtIndex6"],
              shortcut: "ctrl+6",
            },
            t7: {
              name: "Tab 7",
              "@input:command": ["workbench.action.openEditorAtIndex7"],
              shortcut: "ctrl+7",
            },
            t8: {
              name: "Tab 8",
              "@input:command": ["workbench.action.openEditorAtIndex8"],
              shortcut: "ctrl+8",
            },
            t9: {
              name: "Tab 9",
              "@input:command": ["workbench.action.openEditorAtIndex9"],
              shortcut: "ctrl+9",
            },
            ta: {
              name: "Terminal: Actions",
              "@input:command": ["workbench.action.terminal.showQuickFixes"],
              shortcut: "cmd+.",
            },
            tc: {
              name: "Terminal: Clear",
              "@input:command": ["workbench.action.terminal.clear"],
              shortcut: "cmd+k",
            },
            ti: {
              name: "Terminal: Input Chat",
              "@input:command": ["workbench.action.terminal.chat.start"],
              shortcut: "cmd+i",
            },
            tn: {
              name: "workbench.action.terminal.new",
              "@input:command": ['workbench.action.terminal.new", shortcut = "ctrl+shift+`'],
            },
            tt: {
              name: "Terminal: Toggle",
              "@input:command": ['workbench.action.terminal.toggleTerminal`", shortcut = "ctrl+'],
            },
            tl: {
              name: "Terminal: Link Open",
              "@input:command": ["workbench.action.terminal.openDetectedLink"],
              shortcut: "shift+cmd+o",
            },
            ts: {
              name: "Terminal: Split",
              "@input:command": ["workbench.action.terminal.splitActiveTab"],
              shortcut: "ctrl+shift+5",
            },
            ton: {
              name: "Terminal: Open Native",
              "@input:command": ["workbench.action.terminal.openNativeConsole"],
              shortcut: "shift+cmd+c",
            },
            "?s": { name: "Search / Split" },
            sg: {
              name: "Search Globally",
              "@input:command": ["workbench.action.quickOpen"],
              shortcut: "cmd+p",
            },
            sf: {
              name: "Search Files",
              "@input:command": ["workbench.action.quickOpen"],
              shortcut: "cmd+p",
            },
            sa: {
              name: "Split: Auto",
              "@input:command": ["workbench.action.splitEditor"],
              shortcut: "cmd+backslash",
            },
            sl: {
              name: "Split: Left",
              "@input:command": ["workbench.action.splitEditorLeft"],
              shortcut: "cmd+k cmd+backslash",
            },
            sr: {
              name: "Split: Right",
              "@input:command": ["workbench.action.splitEditorRight"],
              shortcut: "cmd+k cmd+backslash",
            },
            su: {
              name: "Split Up",
              "@input:command": ["workbench.action.splitEditorUp"],
              shortcut: "cmd+k cmd+backslash",
            },
            sd: {
              name: "Split: Down",
              "@input:command": ["workbench.action.splitEditorDown"],
              shortcut: "cmd+k cmd+backslash",
            },
            so: {
              name: "Split: Orthogonal",
              "@input:command": ["workbench.action.splitEditorOrthogonal"],
              shortcut: "cmd+k cmd+backslash",
            },
            si: {
              name: "Split: Inner",
              "@input:command": ["workbench.action.splitEditorInGroup"],
              shortcut: "cmd+k shift+cmd+backslash",
            },
            sn: {
              name: "Split: North",
              "@input:command": ["workbench.action.focusAboveGroup"],
              shortcut: "cmd+k cmd+up",
            },
            ss: {
              name: "Split: South",
              "@input:command": ["workbench.action.focusBelowGroup"],
              shortcut: "cmd+k cmd+down",
            },
            sw: {
              name: "Split: West",
              "@input:command": ["workbench.action.focusLeftGroup"],
              shortcut: "cmd+k cmd+left",
            },
            se: {
              name: "Split: East",
              "@input:command": ["workbench.action.focusRightGroup"],
              shortcut: "cmd+k cmd+right",
            },
            s1: {
              name: "Split: 1st",
              "@input:command": ["workbench.action.focusFirstEditorGroup"],
              shortcut: "cmd+1",
            },
            s2: {
              name: "Split: 2nd",
              "@input:command": ["workbench.action.focusSecondEditorGroup"],
              shortcut: "cmd+2",
            },
            s3: {
              name: "Split: 3rd",
              "@input:command": ["workbench.action.focusThirdEditorGroup"],
              shortcut: "cmd+3",
            },
            s4: {
              name: "Split: 4th",
              "@input:command": ["workbench.action.focusFourthEditorGroup"],
              shortcut: "cmd+4",
            },
            s5: {
              name: "Split: 5th",
              "@input:command": ["workbench.action.focusFifthEditorGroup"],
              shortcut: "cmd+5",
            },
            s6: {
              name: "Split: 6th",
              "@input:command": ["workbench.action.focusSixthEditorGroup"],
              shortcut: "cmd+6",
            },
            s7: {
              name: "Split: 7th",
              "@input:command": ["workbench.action.focusSeventhEditorGroup"],
              shortcut: "cmd+7",
            },
            s8: {
              name: "Split: 8th",
              "@input:command": ["workbench.action.focusEighthEditorGroup"],
              shortcut: "cmd+8",
            },
            sq: {
              name: "Split: Quit",
              "@input:command": ["workbench.action.closeGroup"],
              shortcut: "cmd+w",
            },
            sqe: {
              name: "Split: Quit Editors",
              "@input:command": ["workbench.action.closeEditorsInGroup"],
              shortcut: "cmd+k w",
            },
            sqa: {
              name: "Split: Quit All",
              "@input:command": ["workbench.action.closeAllGroups"],
              shortcut: "cmd+k shift+cmd+w",
            },
            "?g": { name: "Goto" },
            gb: {
              name: "Goto Bracket",
              "@input:command": ["editor.action.jumpToBracket"],
              shortcut: "shift+cmd+backslash",
            },
            gpx: {
              name: "Goto Problem: Next",
              shortcut: "f8",
            },
            gpv: {
              name: "Goto Problem: Previous",
              shortcut: "shift+f8",
            },
            gcx: {
              name: "Goto Change: Next",
              shortcut: "opt+f3",
            },
            gcv: {
              name: "Goto Change: Previous",
              shortcut: "shift+opt+f3",
            },
            gd: {
              name: "Goto Declaration",
              "@input:command": ["editor.action.goToDeclaration"],
            },
            gy: {
              name: "Goto Type Definition",
              "@input:command": ["editor.action.goToTypeDefinition"],
            },
            gi: {
              name: "Goto Implementation",
              "@input:command": ["editor.action.goToImplementation"],
              shortcut: "cmd+f12",
            },
            gip: {
              name: "Goto Implementation Peek",
              "@input:command": ["editor.action.peekImplementation"],
              shortcut: "shift+cmd+f12",
            },
            gl: {
              name: "Goto Line",
              "@input:command": ["workbench.action.gotoLine"],
              shortcut: "ctrl+g",
            },
            gr: {
              name: "Goto References",
              "@input:command": ["editor.action.goToReferences"],
              shortcut: "shift+f12",
            },
            grv: {
              name: "Goto Reference: Previous",
              "@input:command": ["goToPreviousReference"],
              shortcut: "shift+f12",
            },
            grx: {
              name: "Goto Reference: Next",
              "@input:command": ["goToNextReference"],
              shortcut: "f12",
            },
            gs: {
              name: "Goto Symbol",
              "@input:command": ["workbench.action.gotoSymbol"],
              shortcut: "shift+cmd+o",
            },
            "?w": { name: "Window" },
            woe: {
              name: "Window: Open Editor",
              "@input:command": ["workbench.action.copyEditorToNewWindow"],
              shortcut: "cmd+k o",
            },
            wq: {
              name: "Window: Quit",
              "@input:command": ["workbench.action.closeWindow"],
              shortcut: "shift+cmd+w",
            },
            wqo: {
              name: "Window: Quit Others",
              "@input:command": ["workbench.action.closeOtherWindows"],
            },
            wn: {
              name: "Window: New",
              "@input:command": ["workbench.action.newWindow"],
              shortcut: "shift+cmd+n",
            },
            wr: {
              name: "Window: Reload",
              "@input:command": ["workbench.action.reloadWindow"],
              shortcut: "cmd+r",
            },
            ws: {
              name: "Window: Switch",
              "@input:command": ["workbench.action.switchWindow"],
              shortcut: "ctrl+w",
            },
            wt: {
              name: "Window: Terminal",
              "@input:command": [
                'workbench.action.terminal.newInNewWindow`", shortcut = "ctrl+shift+alt+',
              ],
            },
            "?z": { name: "Zoom / Zen" },
            zf: {
              name: "Zoom: Full Screen",
              "@input:command": ["workbench.action.toggleFullScreen"],
              shortcut: "ctrl+cmd+f",
            },
            zi: {
              name: "Zoom In",
              "@input:command": ["workbench.action.zoomIn"],
              shortcut: "cmd+NumpadAdd",
            },
            zo: {
              name: "Zoom Out",
              "@input:command": ["workbench.action.zoomOut"],
              shortcut: "cmd+NumpadSubtract",
            },
            zr: {
              name: "Zoom Reset",
              "@input:command": ["workbench.action.zoomReset"],
              shortcut: "cmd+Numpad0",
            },
            zm: {
              name: "Zen Mode",
              "@input:command": ["workbench.action.toggleZenMode"],
              shortcut: "cmd+k z",
            },
            zq: {
              name: "Zen: Quit",
              "@input:command": ["workbench.action.exitZenMode"],
              shortcut: "escape escape",
            },
            "?d": { name: "Debug" },
            da: {
              name: "Debug: All",
              "@input:command": ["testing.debugAll"],
              shortcut: "cmd+; cmd+a",
            },
            dc: {
              name: "Debug: Cursor",
              "@input:command": ["testing.debugAtCursor"],
              shortcut: "cmd+; cmd+c",
            },
            df: {
              name: "Debug: File",
              "@input:command": ["testing.debugCurrentFile"],
              shortcut: "cmd+; cmd+f",
            },
            dft: {
              name: "Debug: Failed Tests",
              "@input:command": ["testing.debugFailTests"],
              shortcut: "cmd+; cmd+e",
            },
            dl: {
              name: "Debug: Last",
              "@input:command": ["testing.debugLastRun"],
              shortcut: "cmd+; cmd+l",
            },
            dd: {
              name: "Debug: Debug",
              "@input:command": ["Debug"],
            },
            ds: {
              name: "Debug: Start",
              "@input:command": ["workbench.action.debug.start"],
              shortcut: "f5",
            },
            db: {
              name: "Debug: Breakpoint",
              "@input:command": ["editor.debug.action.toggleBreakpoint"],
              shortcut: "f9",
            },
            do: {
              name: "Debug: Stop",
              "@input:command": ["workbench.action.debug.stop"],
              shortcut: "shift+f5",
            },
            du: {
              name: "Debug: Pause",
              "@input:command": ["workbench.action.debug.pause"],
              shortcut: "f6",
            },
            dr: {
              name: "Debug: Run",
              "@input:command": ["workbench.action.debug.run"],
              shortcut: "ctrl+f5",
            },
            dv: {
              name: "Debug: View",
              "@input:command": ["debug.openView"],
              shortcut: "cmd+f5",
            },
            dcw: {
              name: "Debug: Copy Watch Expression",
              "@input:command": ["debug.copyWatchExpression"],
              shortcut: "alt+cmd+c",
            },
            drs: {
              name: "Debug: Restart",
              "@input:command": ["workbench.action.debug.restart"],
              shortcut: "shift+cmd+f5",
            },
            dh: {
              name: "Debug: Hover",
              "@input:command": ["editor.debug.action.showDebugHover"],
              shortcut: "cmd+k cmd+i",
            },
            dit: {
              name: "Debug: Into Target",
              "@input:command": ["workbench.action.debug.stepIntoTarget"],
              shortcut: "cmd+f11",
            },
            "?ds": { name: "Debug: Step" },
            dsi: {
              name: "Debug: Step Into",
              "@input:command": ["workbench.action.debug.stepInto"],
              shortcut: "f11",
            },
            dso: {
              name: "Debug: Step Out",
              "@input:command": ["workbench.action.debug.stepOut"],
              shortcut: "shift+f11",
            },
            dsv: {
              name: "Debug: Step Over",
              "@input:command": ["workbench.action.debug.stepOver"],
              shortcut: "f10",
            },
            "?dc": { name: "Debug Console" },
            "dc]": {
              name: "workbench.action.debug.nextConsole",
              "@input:command": ["workbench.action.debug.nextConsole"],
              shortcut: "shift+cmd+]",
            },
            "dc[": {
              name: "workbench.action.debug.prevConsole",
              "@input:command": ["workbench.action.debug.prevConsole"],
              shortcut: "shift+cmd+[",
            },
            "?c": { name: "Code" },
            ci: {
              name: "Code: Imports",
              "@input:command": ["editor.action.organizeImports"],
              shortcut: "shift+alt+o",
            },
            cd: {
              name: "Code: Definition",
              "@input:command": ["editor.action.revealDefinition"],
              shortcut: "f12",
            },
            "c[": {
              name: "Code: Previous",
              "@input:command": ["editor.action.inlineSuggest.showPrevious"],
              shortcut: "alt+[",
            },
            "c]": {
              name: "Code: Next",
              "@input:command": ["editor.action.inlineSuggest.showNext"],
              shortcut: "alt+]",
            },
            cdp: {
              name: "Code: Definition Peek",
              "@input:command": ["editor.action.peekDefinition"],
              shortcut: "alt+f12",
            },
            ch: {
              name: "Code: Hover",
              "@input:command": ["workbench.action.showHover"],
              shortcut: "cmd+k cmd+i",
            },
            cr: {
              name: "Code: Refactor",
              "@input:command": ["editor.action.refactor"],
              shortcut: "ctrl+shift+r",
            },
            crn: {
              name: "Code: Re Name",
              "@input:command": ["editor.action.rename"],
              shortcut: "f2",
            },
            cs: {
              name: "Code: Suggest",
              "@input:command": ["workbench.action.terminal.triggerSuggest"],
              shortcut: "ctrl+space",
            },
            "?cc": { name: "Code Comment" },
            cc: {
              name: "Code: Comment",
              "@input:command": ["editor.action.commentLine"],
              shortcut: "cmd+/",
            },
            cca: {
              name: "Code: Comment Add",
              "@input:command": ["workbench.action.addComment"],
              shortcut: "cmd+k alt+cmd+c",
            },
            ccb: {
              name: "Code: Comment Block",
              "@input:command": ["editor.action.blockComment"],
              shortcut: "shift+alt+a",
            },
            ccl: {
              name: "Code: Comment Line",
              "@input:command": ["editor.action.addCommentLine"],
              shortcut: "cmd+k cmd+c",
            },
            ccr: {
              name: "Code Comment: Remove",
              "@input:command": ["editor.action.removeCommentLine"],
              shortcut: "cmd+k cmd+u",
            },
            cch: {
              name: "Code Comment: Hide",
              "@input:command": ["workbench.action.hideComment"],
              shortcut: "shift+escape",
            },
            "?n": { name: "Notebook" },
            "?nb": { name: "Notebook" },
            "nb[": {
              name: "Notebook: Previous",
              "@input:command": ["notebook.findPrevious.fromWidget"],
              shortcut: "shift+f3",
            },
            "nb]": {
              name: "Notebook: Next",
              "@input:command": ["notebook.findNext.fromWidget"],
              shortcut: "f3",
            },
            nba: {
              name: "Notebook: Add",
              "@input:command": ["notebook.addFindMatchToSelection"],
              shortcut: "cmd+d",
            },
            "?nbl": { name: "Notebook Language" },
            nbld: {
              name: "Notebook Language: Detect",
              "@input:command": ["notebook.cell.detectLanguage"],
              shortcut: "shift+alt+d",
            },
            nblc: {
              name: "Notebook Language: Change",
              "@input:command": ["notebook.cell.changeLanguage"],
              shortcut: "cmd+k m",
            },
            "?nc": { name: "Notebook Cell" },
            nci: {
              name: "Notebook Cell: Input Collapse",
              "@input:command": ["notebook.cell.collapseCellInput"],
              shortcut: "cmd+k cmd+c",
            },
            "nc/": {
              name: "Notebook Cell: Comment",
              "@input:command": ["notebook.cell.comment"],
              shortcut: "cmd+/",
            },
            nco: {
              name: "Notebook Cell: Output Collapse",
              "@input:command": ["notebook.cell.collapseCellOutput"],
              shortcut: "cmd+k t",
            },
            nca: {
              name: "Notebook Cell: AI",
              "@input:command": ["notebook.cell.chat.start"],
              shortcut: "cmd+k i",
            },
            ncc: {
              name: "Notebook Cell: Center",
              "@input:command": ["notebook.centerActiveCell"],
              shortcut: "ctrl+l",
            },
            ncei: {
              name: "Notebook Cell: Expand Input",
              "@input:command": ["notebook.cell.expandCellInput"],
              shortcut: "cmd+k cmd+c",
            },
            nceo: {
              name: "Notebook Cell: Expand Output",
              "@input:command": ["notebook.cell.expandCellOutput"],
              shortcut: "cmd+k t",
            },
            ncf: {
              name: "Notebook Cell: Format",
              "@input:command": ["notebook.formatCell"],
              shortcut: "shift+alt+f",
            },
            ncfa: {
              name: "Notebook Cell: Failure Actions",
              "@input:command": ["notebook.cell.openFailureActions"],
              shortcut: "cmd+.",
            },
            ncs: {
              name: "Notebook Cell: Split",
              "@input:command": ["notebook.cell.split"],
              shortcut: "cmd+k shift+cmd+backslash",
            },
            ncja: {
              name: "Notebook Cell: Join Above",
              "@input:command": ["notebook.cell.joinAbove"],
              shortcut: "ctrl+shift+alt+j",
            },
            ncjb: {
              name: "Notebook Cell: Join Below",
              "@input:command": ["notebook.cell.joinBelow"],
              shortcut: "ctrl+alt+j",
            },
            ncp: {
              name: "Notebook Cell: Paste Above",
              "@input:command": ["notebook.cell.pasteAbove"],
              shortcut: "shift+cmd+v",
            },
            nct: {
              name: "Notebook Cell: Toggle Output Scrolling",
              "@input:command": ["notebook.cell.toggleOutputScrolling"],
              shortcut: "cmd+k y",
            },
            "?m": { name: "Marker" },
            "m]": {
              name: "editor.action.marker.next",
              "@input:command": ["editor.action.marker.next"],
              shortcut: "alt+f8",
            },
            "m]f": {
              name: "editor.action.marker.nextInFiles",
              "@input:command": ["editor.action.marker.nextInFiles"],
              shortcut: "f8",
            },
            "m[": {
              name: "editor.action.marker.prev",
              "@input:command": ["editor.action.marker.prev"],
              shortcut: "shift+alt+f8",
            },
            "m[f": {
              name: "editor.action.marker.prevInFiles",
              "@input:command": ["editor.action.marker.prevInFiles"],
              shortcut: "shift+f8",
            },
            "?i": { name: "Input (Chat)" },
            ia: {
              name: "Input: Accept All",
              "@input:command": ["chatEditor.action.acceptAllEdits"],
              shortcut: "alt+cmd+y",
            },
            iy: {
              name: "Input: Yes",
              "@input:command": ["chatEditor.action.accept"],
              shortcut: "shift+cmd+y",
            },
            ir: {
              name: "Input: Reject",
              "@input:command": ["chatEditor.action.reject"],
              shortcut: "shift+cmd+n",
            },
            in: {
              name: "Input: New",
              "@input:command": ["workbench.action.chat.newChat"],
              shortcut: "ctrl+l",
            },
            iad: {
              name: "Input: Accessible Diff",
              "@input:command": ["chatEditor.action.showAccessibleDiffView"],
              shortcut: "f7",
            },
            id: {
              name: "Input: Diff",
              "@input:command": ["chatEditor.action.toggleDiff"],
              shortcut: "shift+alt+f7",
            },
            ii: {
              name: "Input: Inline",
              "@input:command": ["inlineChat.askInChat"],
              shortcut: "cmd+i",
            },
            is: {
              name: "Input: Start",
              "@input:command": ["inlineChat.start"],
              shortcut: "cmd+i",
            },
            io: {
              name: "Input: Open",
              "@input:command": ["workbench.action.chat.open"],
              shortcut: "ctrl+cmd+i",
            },
            ic: {
              name: "Input: Context",
              "@input:command": ["workbench.action.chat.attachContext"],
              shortcut: "cmd+/",
            },
            iq: {
              name: "Input: Quick",
              "@input:command": ["workbench.action.quickchat.toggle"],
              shortcut: "shift+alt+cmd+l",
            },
            "i]": {
              name: "Input: Next",
              "@input:command": ["chatEditor.action.navigateNext"],
              shortcut: "alt+f5",
            },
            "i[": {
              name: "Input: Previous",
              "@input:command": ["chatEditor.action.navigatePrevious"],
              shortcut: "shift+alt+f5",
            },
            "?h": { name: "Hunk" },
            ha: {
              name: "Hunk: Accept",
              "@input:command": ["chatEditor.action.acceptHunk"],
              shortcut: "cmd+y",
            },
            hu: {
              name: "Hunk: Undo",
              "@input:command": ["chatEditor.action.undoHunk"],
              shortcut: "cmd+n",
            },
            "?ac": { name: "Accessibility" },
            ach: {
              name: "Accessibility: Help",
              "@input:command": ["editor.action.accessibilityHelp"],
              shortcut: "alt+f1",
            },
            ahca: {
              name: "Accessibility: Configure Assigned Keybindings",
              "@input:command": ["editor.action.accessibilityHelpConfigureAssignedKeybindings"],
              shortcut: "alt+a",
            },
            ahck: {
              name: "Accessibility: Configure Keybindings",
              "@input:command": ["editor.action.accessibilityHelpConfigureKeybindings"],
              shortcut: "alt+k",
            },
            aco: {
              name: "Accessibility: Open Help Link",
              "@input:command": ["editor.action.accessibilityHelpOpenHelpLink"],
              shortcut: "alt+h",
            },
            "?av": { name: "Accessibility View" },
            av: {
              name: "Accessibility View",
              "@input:command": ["editor.action.accessibleView"],
              shortcut: "alt+f2",
            },
            avg: {
              name: "Accessibility View: Goto Symbol",
              "@input:command": ["editor.action.accessibleViewGoToSymbol"],
              shortcut: "shift+cmd+.",
            },
            ava: {
              name: "Accessibility View: Accept Inline Completion",
              "@input:command": ["editor.action.accessibleViewAcceptInlineCompletion"],
              shortcut: "ctrl+/",
            },
            avd: {
              name: "Accessibility View: Disable Hint",
              "@input:command": ["editor.action.accessibleViewDisableHint"],
              shortcut: "alt+f6",
            },
            "av]": {
              name: "Accessibility View: Next",
              "@input:command": ["editor.action.accessibleViewNext"],
              shortcut: "alt+]",
            },
            "av[": {
              name: "Accessibility View: Previous",
              "@input:command": ["editor.action.accessibleViewPrevious"],
              shortcut: "alt+[",
            },
            "?b": { name: "Breadcrumbs" },
            bf: {
              name: "Breadcrumbs: Focus",
              "@input:command": ["breadcrumbs.focus"],
              shortcut: "shift+cmd+;",
            },
            bs: {
              name: "Breadcrumbs: Select",
              "@input:command": ["breadcrumbs.focusAndSelect"],
              shortcut: "shift+cmd+.",
            },
            bo: {
              name: "Breadcrumbs: On",
              "@input:command": ["breadcrumbs.toggleToOn"],
              shortcut: "shift+cmd+.",
            },
            "?q": { name: "QA (Testing)" },
            qh: {
              name: "QA: History",
              "@input:command": ["testing.toggleTestingPeekHistory"],
              shortcut: "alt+h",
            },
            qs: {
              name: "QA: Show Recent Output",
              "@input:command": ["testing.reRunLastRun"],
              shortcut: "cmd+; l",
            },
            "?qc": { name: "QA Coverage" },
            qci: {
              name: "QA Coverage: Inline",
              "@input:command": ["testing.toggleInlineCoverage"],
              shortcut: "cmd+; shift+cmd+i",
            },
            "qc]": {
              name: "QA Coverage: Next Missed Line",
              "@input:command": ["testing.coverage.goToNextMissedLine"],
              shortcut: "alt+f9",
            },
            "qc[": {
              name: "QA Coverage: Previous Missed Line",
              "@input:command": ["testing.coverage.goToPreviousMissedLine"],
              shortcut: "shift+alt+f9",
            },
            qca: {
              name: "QA Coverage: Al",
              "@input:command": ["testing.coverageAll"],
              shortcut: "cmd+; shift+cmd+a",
            },
            qcc: {
              name: "QA Coverage: Cursor",
              "@input:command": ["testing.coverageAtCursor"],
              shortcut: "cmd+; shift+cmd+c",
            },
            qcf: {
              name: "QA Coverage: File",
              "@input:command": ["testing.coverageCurrentFile"],
              shortcut: "cmd+; shift+cmd+f",
            },
            qcl: {
              name: "QA Coverage: Last Run",
              "@input:command": ["testing.coverageLastRun"],
              shortcut: "cmd+; shift+cmd+l",
            },
            "?qr": { name: "QA Run / Refresh" },
            qr: {
              name: "QA Refresh",
              "@input:command": ["testing.refreshTests"],
              shortcut: "cmd+; cmd+r",
            },
            qra: {
              name: "QA Run: All",
              "@input:command": ["testing.runAll"],
              shortcut: "cmd+; a",
            },
            qri: {
              name: "QA Run: Input Cursor",
              "@input:command": ["testing.runAtCursor"],
              shortcut: "cmd+; c",
            },
            qrc: {
              name: "QA Run: Cancel",
              "@input:command": ["testing.cancelRun"],
              shortcut: "cmd+; cmd+x",
            },
            qrf: {
              name: "QA Run File",
              "@input:command": ["testing.runCurrentFile"],
              shortcut: "cmd+; f",
            },
            qrr: {
              name: "QA: Re-Run",
              "@input:command": ["testing.reRunFailTests"],
              shortcut: "cmd+; e",
            },
            qrl: {
              name: "QA Run: Last Run",
              "@input:command": ["testing.reRunLastRun"],
              shortcut: "cmd+; l",
            },
            "?qo": { name: "QA Output" },
            qop: {
              name: "QA: Output Peek",
              "@input:command": ["testing.openOutputPeek"],
              shortcut: "cmd+; cmd+m",
            },
            qor: {
              name: "QA: Output Recent",
              "@input:command": ["testing.showMostRecentOutput"],
              shortcut: "cmd+; cmd+o",
            },
            qoi: {
              name: "QA: Output Inline",
              "@input:command": ["testing.toggleInlineTestOutput"],
              shortcut: "cmd+; cmd+i",
            },
          },
        },
      },
    },
    todesktop: {
      "230313mzl4w4u92": {
        "macos.toml": {
          name: "Cursor",
          on: {
            command: {
              file: "vscode.js",
              args: ["/Applications/Cursor.app"],
            },
          },
          import: [{ file: "com/microsoft/VSCode/macos.toml" }],
        },
      },
    },
  },
};
var package_default = {
  name,
  version,
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
  version,
};
