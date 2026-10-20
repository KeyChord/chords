//#region package.json
var name = "@keychord/chords-com.apple";
var displayName = "macOS App Stubs";
var version = "0.0.0";
var description =
  "Empty chord stubs for pre-installed macOS apps. App bindings are provided by separate bundle-ID packages.";
var categories = ["macOS"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-com.apple",
};
var type = "module";
var scripts = { test: "bun test --isolate" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    apple: {
      AOSUIPrefPaneLauncher: {
        "macos.toml": {
          name: "AOSUIPrefPaneLauncher",
          chords: {},
        },
      },
      "AVB-Audio-Configuration": {
        "macos.toml": {
          name: "AVB Configuration",
          chords: {},
        },
      },
      AboutThisMacLauncher: {
        "macos.toml": {
          name: "About This Mac",
          chords: {},
        },
      },
      AccessibilityUIServer: {
        "macos.toml": {
          name: "AccessibilityUIServer",
          chords: {},
        },
      },
      AddressBook: {
        UrlForwarder: {
          "macos.toml": {
            name: "AddressBookUrlForwarder",
            chords: {},
          },
        },
        "macos.toml": {
          name: "Contacts",
          chords: {},
        },
      },
      AirPlayUIAgent: {
        "macos.toml": {
          name: "AirPlayUIAgent",
          chords: {},
        },
      },
      AppStore: {
        "macos.toml": {
          name: "App Store",
          chords: {},
        },
      },
      AppleScriptUtility: {
        "macos.toml": {
          name: "AppleScript Utility",
          chords: {},
        },
      },
      Automator: {
        "Automator-Application-Stub": {
          "macos.toml": {
            name: "Automator Application Stub",
            chords: {},
          },
        },
        "macos.toml": {
          name: "Automator",
          chords: {},
        },
      },
      AutomatorInstaller: {
        "macos.toml": {
          name: "Automator Installer",
          chords: {},
        },
      },
      Batteries: {
        "macos.toml": {
          name: "Batteries",
          chords: {},
        },
      },
      BluetoothFileExchange: {
        "macos.toml": {
          name: "Bluetooth File Exchange",
          chords: {},
        },
      },
      BluetoothSetupAssistant: {
        "macos.toml": {
          name: "BluetoothSetupAssistant",
          chords: {},
        },
      },
      BluetoothUIServer: {
        "macos.toml": {
          name: "BluetoothUIServer",
          chords: {},
        },
      },
      BluetoothUIService: {
        "macos.toml": {
          name: "BluetoothUIService",
          chords: {},
        },
      },
      CalendarFileHandler: {
        "macos.toml": {
          name: "CalendarFileHandler",
          chords: {},
        },
      },
      CaptiveNetworkAssistant: {
        "macos.toml": {
          name: "Captive Network Assistant",
          chords: {},
        },
      },
      CertificateAssistant: {
        "macos.toml": {
          name: "Certificate Assistant",
          chords: {},
        },
      },
      Chess: {
        "macos.toml": {
          name: "Chess",
          chords: {},
        },
      },
      ClockAngel: {
        "macos.toml": {
          name: "ClockAngel",
          chords: {},
        },
      },
      CloudKit: {
        ShareBear: {
          "macos.toml": {
            name: "iCloud",
            chords: {},
          },
        },
      },
      ColorSyncUtility: {
        "macos.toml": {
          name: "ColorSync Utility",
          chords: {},
        },
      },
      Compressor: {
        "macos.toml": {
          name: "Compressor",
          chords: {},
        },
      },
      CompressorApp: {
        "macos.toml": {
          name: "Compressor: Encode Media",
          chords: {},
        },
      },
      Console: {
        "macos.toml": {
          name: "Console",
          chords: {},
        },
      },
      CoreLocationAgent: {
        "macos.toml": {
          name: "CoreLocationAgent",
          chords: {},
        },
      },
      CreateML: {
        "macos.toml": {
          name: "Create ML",
          chords: {},
        },
      },
      DVDPlayer: {
        "macos.toml": {
          name: "DVD Player",
          chords: {},
        },
      },
      DeskCam: {
        "macos.toml": {
          name: "Desk View",
          chords: {},
        },
      },
      DiagnosticsModeAssistant: {
        "macos.toml": {
          name: "Apple Diagnostics",
          chords: {},
        },
      },
      DiagnosticsReporter: {
        "macos.toml": {
          name: "Diagnostics Reporter",
          chords: {},
        },
      },
      Dictionary: {
        "macos.toml": {
          name: "Dictionary",
          chords: {},
        },
      },
      DigitalColorMeter: {
        "macos.toml": {
          name: "Digital Color Meter",
          chords: {},
        },
      },
      DirectoryUtility: {
        "macos.toml": {
          name: "Directory Utility",
          chords: {},
        },
      },
      DiscHelper: {
        "macos.toml": {
          name: "DiscHelper",
          chords: {},
        },
      },
      DiskImageMounter: {
        "macos.toml": {
          name: "DiskImageMounter",
          chords: {},
        },
      },
      DiskUtility: {
        "macos.toml": {
          name: "Disk Utility",
          chords: {},
        },
      },
      DwellControl: {
        "macos.toml": {
          name: "Dwell Control",
          chords: {},
        },
      },
      EnhancedLogging: {
        "macos.toml": {
          name: "Enhanced Logging",
          chords: {},
        },
      },
      EraseAssistant: {
        "macos.toml": {
          name: "Erase Assistant",
          chords: {},
        },
      },
      EscrowSecurityAlert: {
        "macos.toml": {
          name: "EscrowSecurityAlert",
          chords: {},
        },
      },
      ExpansionSlotUtility: {
        "macos.toml": {
          name: "Expansion Slot Utility",
          chords: {},
        },
      },
      FaceTime: {
        "macos.toml": {
          name: "FaceTime",
          chords: {},
        },
      },
      Family: {
        "macos.toml": {
          name: "Family",
          chords: {},
        },
      },
      FamilyExtensionHost: {
        "macos.toml": {
          name: "FamilyExtensionHost",
          chords: {},
        },
      },
      FileMerge: {
        "macos.toml": {
          name: "FileMerge",
          chords: {},
        },
      },
      "FileProvider-Feedback": {
        "macos.toml": {
          name: "FileProvider-Feedback",
          chords: {},
        },
      },
      FinalCut: {
        "macos.toml": {
          name: "Final Cut Pro",
          chords: {},
        },
      },
      FinalCutApp: {
        "macos.toml": {
          name: "Final Cut Pro: Create Video",
          chords: {},
        },
      },
      FolderActionsDispatcher: {
        "macos.toml": {
          name: "FolderActionsDispatcher",
          chords: {},
        },
      },
      FolderActionsSetup: {
        "macos.toml": {
          name: "Folder Actions Setup",
          chords: {},
        },
      },
      FontBook: {
        "macos.toml": {
          name: "Font Book",
          chords: {},
        },
      },
      GameOverlayUI: {
        "macos.toml": {
          name: "GameOverlayUI",
          chords: {},
        },
      },
      GameTrampoline: {
        "macos.toml": {
          name: "GameTrampoline",
          chords: {},
        },
      },
      GenerativePlaygroundApp: {
        "macos.toml": {
          name: "Image Playground",
          chords: {},
        },
      },
      Home: {
        "macos.toml": {
          name: "Home",
          chords: {},
        },
      },
      IOUIAgent: {
        "macos.toml": {
          name: "IOUIAgent",
          chords: {},
        },
      },
      IPAInstaller: {
        "macos.toml": {
          name: "iOS App Installer",
          chords: {},
        },
      },
      IconComposer: {
        "macos.toml": {
          name: "Icon Composer",
          chords: {},
        },
      },
      Image_Capture: {
        "macos.toml": {
          name: "Image Capture",
          chords: {},
        },
      },
      InstallAssistant: {
        Catalina: {
          "macos.toml": {
            name: "macOS Catalina",
            chords: {},
          },
        },
        ElCapitan2: {
          "macos.toml": {
            name: "OS X El Capitan",
            chords: {},
          },
        },
        HighSierra: {
          "macos.toml": {
            name: "macOS High Sierra",
            chords: {},
          },
        },
        Mojave: {
          "macos.toml": {
            name: "macOS Mojave",
            chords: {},
          },
        },
        Sierra: {
          "macos.toml": {
            name: "macOS Sierra",
            chords: {},
          },
        },
        macOSBigSur: {
          "macos.toml": {
            name: "macOS Big Sur",
            chords: {},
          },
        },
        macOSMonterey: {
          "macos.toml": {
            name: "macOS Monterey",
            chords: {},
          },
        },
      },
      "Installer-Progress": {
        "macos.toml": {
          name: "Installer Progress",
          chords: {},
        },
      },
      JavaLauncher: {
        "macos.toml": {
          name: "JavaLauncher",
          chords: {},
        },
      },
      KeyboardAccessAgent: {
        "macos.toml": {
          name: "KeyboardAccessAgent",
          chords: {},
        },
      },
      KeyboardSetupAssistant: {
        "macos.toml": {
          name: "KeyboardSetupAssistant",
          chords: {},
        },
      },
      Keynote: {
        "macos.toml": {
          name: "Keynote: Design Presentations",
          chords: {},
        },
      },
      "Language-Chooser": {
        "macos.toml": {
          name: "Language Chooser",
          chords: {},
        },
      },
      MDMMigrationTrampoline: {
        "macos.toml": {
          name: "MDMMigrationTrampoline",
          chords: {},
        },
      },
      MRT: {
        "macos.toml": {
          name: "MRT",
          chords: {},
        },
      },
      MTLReplayer: {
        "macos.toml": {
          name: "MTLReplayer",
          chords: {},
        },
      },
      Magnifier: {
        "macos.toml": {
          name: "Magnifier",
          chords: {},
        },
      },
      ManagedClient: {
        "macos.toml": {
          name: "ManagedClient",
          chords: {},
        },
      },
      Maps: {
        "macos.toml": {
          name: "Maps",
          chords: {},
        },
      },
      MediaRemoteUI: {
        "macos.toml": {
          name: "MediaRemoteUI",
          chords: {},
        },
      },
      MediaRemoteUIService: {
        "macos.toml": {
          name: "MediaRemoteUIService",
          chords: {},
        },
      },
      MedicalImagingCalibrator: {
        "macos.toml": {
          name: "Medical Imaging Calibrator",
          chords: {},
        },
      },
      MemorySlotUtility: {
        "macos.toml": {
          name: "Memory Slot Utility",
          chords: {},
        },
      },
      MenuBarAgent: {
        "macos.toml": {
          name: "MenuBarAgent",
          chords: {},
        },
      },
      MigrateAssistant: {
        "macos.toml": {
          name: "Migration Assistant",
          chords: {},
        },
      },
      MobileSMS: {
        "macos.toml": {
          name: "Messages",
          chords: {},
        },
      },
      Music: {
        "macos.toml": {
          name: "Music",
          chords: {},
        },
      },
      NetAuthAgent: {
        "macos.toml": {
          name: "NetAuthAgent",
          chords: {},
        },
      },
      NewDeviceOutreachApp: {
        "macos.toml": {
          name: "Coverage Details",
          chords: {},
        },
      },
      Notes: {
        "macos.toml": {
          name: "Notes",
          chords: {},
        },
      },
      NowPlayingTouchUI: {
        "macos.toml": {
          name: "NowPlayingTouchUI",
          chords: {},
        },
      },
      Numbers: {
        "macos.toml": {
          name: "Numbers: Make Spreadsheets",
          chords: {},
        },
      },
      OAHSoftwareUpdateApp: {
        "macos.toml": {
          name: "Rosetta 2 Updater",
          chords: {},
        },
      },
      OBEXAgent: {
        "macos.toml": {
          name: "OBEXAgent",
          chords: {},
        },
      },
      OSDUIHelper: {
        "macos.toml": {
          name: "OSDUIHelper",
          chords: {},
        },
      },
      PIPAgent: {
        "macos.toml": {
          name: "PIPAgent",
          chords: {},
        },
      },
      PackageUIKit: {
        "Install-in-Progress": {
          "macos.toml": {
            name: "Install in Progress",
            chords: {},
          },
        },
      },
      Pages: {
        "macos.toml": {
          name: "Pages: Create Documents",
          chords: {},
        },
      },
      PairedDevices: {
        "macos.toml": {
          name: "Paired Devices",
          chords: {},
        },
      },
      "Pass-Viewer": {
        "macos.toml": {
          name: "Pass Viewer",
          chords: {},
        },
      },
      PassViewer: {
        "macos.toml": {
          name: "PassViewer",
          chords: {},
        },
      },
      Passwords: {
        "macos.toml": {
          name: "Passwords",
          chords: {},
        },
      },
      PeopleMessageService: {
        "macos.toml": {
          name: "PeopleMessageService",
          chords: {},
        },
      },
      PeopleViewService: {
        "macos.toml": {
          name: "PeopleViewService",
          chords: {},
        },
      },
      PhotoBooth: {
        "macos.toml": {
          name: "Photo Booth",
          chords: {},
        },
      },
      Photos: {
        "macos.toml": {
          name: "Photos",
          chords: {},
        },
      },
      PlaygroundsMac: {
        "macos.toml": {
          name: "Swift Playground",
          chords: {},
        },
      },
      PowerChime: {
        "macos.toml": {
          name: "PowerChime",
          chords: {},
        },
      },
      Preview: {
        "macos.toml": {
          name: "Preview",
          chords: {},
        },
      },
      PreviewShell: {
        "macos.toml": {
          name: "PreviewShell",
          chords: {},
        },
      },
      PreviewShellMac: {
        "macos.toml": {
          name: "PreviewShellMac",
          chords: {},
        },
      },
      ProblemReporter: {
        "macos.toml": {
          name: "Problem Reporter",
          chords: {},
        },
      },
      QuickTimePlayerX: {
        "macos.toml": {
          name: "QuickTime Player",
          chords: {},
        },
      },
      RapportUIAgent: {
        "macos.toml": {
          name: "RapportUIAgent",
          chords: {},
        },
      },
      RealityComposerPro: {
        "macos.toml": {
          name: "Reality Composer Pro",
          chords: {},
        },
      },
      RemoteDesktop: {
        "macos.toml": {
          name: "Apple Remote Desktop",
          chords: {},
        },
      },
      ScreenSaver: {
        Engine: {
          "macos.toml": {
            name: "ScreenSaverEngine",
            chords: {},
          },
        },
      },
      ScreenSharing: {
        "macos.toml": {
          name: "Screen Sharing",
          chords: {},
        },
      },
      ScreenTimeWidgetApplication: {
        "macos.toml": {
          name: "Screen Time",
          chords: {},
        },
      },
      ScriptEditor2: {
        "macos.toml": {
          name: "Script Editor",
          chords: {},
        },
      },
      ScriptMenuApp: {
        "macos.toml": {
          name: "Script Menu",
          chords: {},
        },
      },
      ScriptMonitor: {
        "macos.toml": {
          name: "ScriptMonitor",
          chords: {},
        },
      },
      Settings: {
        "macos.toml": {
          name: "SettingsPlaceholder",
          chords: {},
        },
      },
      SetupAssistant: {
        "macos.toml": {
          name: "Setup Assistant",
          chords: {},
        },
      },
      Sharing: {
        AirDropUI: {
          "macos.toml": {
            name: "AirDropUI",
            chords: {},
          },
        },
      },
      ShortcutsActions: {
        "macos.toml": {
          name: "ShortcutsActions",
          chords: {},
        },
      },
      SoftwareUpdate: {
        "macos.toml": {
          name: "Software Update",
          chords: {},
        },
      },
      SpacesTouchBarAgent: {
        "macos.toml": {
          name: "SpacesTouchBarAgent",
          chords: {},
        },
      },
      Spotlight: {
        "macos.toml": {
          name: "Spotlight",
          chords: {},
        },
      },
      Stickies: {
        "macos.toml": {
          name: "Stickies",
          chords: {},
        },
      },
      SystemIntents: {
        "macos.toml": {
          name: "SystemIntents",
          chords: {},
        },
      },
      SystemProfiler: {
        "macos.toml": {
          name: "System Information",
          chords: {},
        },
      },
      TV: {
        "macos.toml": {
          name: "TV",
          chords: {},
        },
      },
      TestFlight: {
        "macos.toml": {
          name: "TestFlight",
          chords: {},
        },
      },
      TextEdit: {
        "macos.toml": {
          name: "TextEdit",
          chords: {},
        },
      },
      TextInputMenuAgent: {
        "macos.toml": {
          name: "TextInputMenuAgent",
          chords: {},
        },
      },
      TextInputSwitcher: {
        "macos.toml": {
          name: "TextInputSwitcher",
          chords: {},
        },
      },
      ThermalTrap: {
        "macos.toml": {
          name: "ThermalTrap",
          chords: {},
        },
      },
      "Ticket-Viewer": {
        "macos.toml": {
          name: "Ticket Viewer",
          chords: {},
        },
      },
      TransporterApp: {
        "macos.toml": {
          name: "Transporter",
          chords: {},
        },
      },
      UIKitSystemApp: {
        "macos.toml": {
          name: "UIKitSystem",
          chords: {},
        },
      },
      UniversalAccessControl: {
        "macos.toml": {
          name: "UniversalAccessControl",
          chords: {},
        },
      },
      UnmountAssistantAgent: {
        "macos.toml": {
          name: "UnmountAssistantAgent",
          chords: {},
        },
      },
      UserNotificationCenter: {
        "macos.toml": {
          name: "UserNotificationCenter",
          chords: {},
        },
      },
      VoiceMemos: {
        "macos.toml": {
          name: "Voice Memos",
          chords: {},
        },
      },
      VoiceOver: {
        "macos.toml": {
          name: "VoiceOver",
          chords: {},
        },
      },
      VoiceOverUtility: {
        "macos.toml": {
          name: "VoiceOver Utility",
          chords: {},
        },
      },
      WatchFaceAlert: {
        "macos.toml": {
          name: "WatchFaceAlert",
          chords: {},
        },
      },
      "WorkoutAlert-Mac": {
        "macos.toml": {
          name: "WorkoutAlert-Mac",
          chords: {},
        },
      },
      XProtectFramework: {
        XProtect: {
          "macos.toml": {
            name: "XProtect",
            chords: {},
          },
        },
      },
      accessibility: {
        AccessibilityReader: {
          "macos.toml": {
            name: "Accessibility Reader",
            chords: {},
          },
        },
      },
      airport: {
        airportutility: {
          "macos.toml": {
            name: "AirPort Utility",
            chords: {},
          },
        },
      },
      appleseed: {
        FeedbackAssistant: {
          "macos.toml": {
            name: "Feedback Assistant",
            chords: {},
          },
        },
      },
      apps: {
        launcher: {
          "macos.toml": {
            name: "Apps",
            chords: {},
          },
        },
      },
      archiveutility: {
        "macos.toml": {
          name: "Archive Utility",
          chords: {},
        },
      },
      audio: {
        AudioMIDISetup: {
          "macos.toml": {
            name: "Audio MIDI Setup",
            chords: {},
          },
        },
      },
      backup: {
        launcher: {
          "macos.toml": {
            name: "Time Machine",
            chords: {},
          },
        },
      },
      "business-essentials": {
        "macos.toml": {
          name: "Apple Business",
          chords: {},
        },
      },
      calculator: {
        "macos.toml": {
          name: "Calculator",
          chords: {},
        },
      },
      campo: {
        "macos.toml": {
          name: "Siri AI",
          chords: {},
        },
      },
      chrono: {
        "WidgetRenderer-Activities": {
          "macos.toml": {
            name: "WidgetRenderer_Activities",
            chords: {},
          },
        },
      },
      clock: {
        "macos.toml": {
          name: "Clock",
          chords: {},
        },
      },
      configurator: {
        ui: {
          "macos.toml": {
            name: "Apple Configurator",
            chords: {},
          },
        },
      },
      controlcenter: {
        "macos.toml": {
          name: "ControlCenter",
          chords: {},
        },
      },
      controlstrip: {
        "macos.toml": {
          name: "ControlStrip",
          chords: {},
        },
      },
      coreservices: {
        uiagent: {
          "macos.toml": {
            name: "CoreServicesUIAgent",
            chords: {},
          },
        },
      },
      databaseevents: {
        "macos.toml": {
          name: "Database Events",
          chords: {},
        },
      },
      displaycalibrator: {
        "macos.toml": {
          name: "Pro Display Calibrator",
          chords: {},
        },
      },
      dock: {
        "macos.toml": {
          name: "Dock",
          chords: {},
        },
      },
      dt: {
        CommandLineTools: {
          installondemand: {
            "macos.toml": {
              name: "Install Command Line Developer Tools",
              chords: {},
            },
          },
        },
        Instruments: {
          "macos.toml": {
            name: "Instruments",
            chords: {},
          },
        },
        Xcode: {
          "macos.toml": {
            name: "Xcode",
            chords: {},
          },
        },
      },
      exposelauncher: {
        "macos.toml": {
          name: "Mission Control",
          chords: {},
        },
      },
      findmy: {
        "macos.toml": {
          name: "Find My",
          chords: {},
        },
      },
      freeform: {
        "macos.toml": {
          name: "Freeform",
          chords: {},
        },
      },
      gamecenter: {
        "macos.toml": {
          name: "Game Center",
          chords: {},
        },
      },
      games: {
        "macos.toml": {
          name: "Games",
          chords: {},
        },
      },
      garageband10: {
        "macos.toml": {
          name: "GarageBand",
          chords: {},
        },
      },
      grapher: {
        "macos.toml": {
          name: "Grapher",
          chords: {},
        },
      },
      helpviewer: {
        "macos.toml": {
          name: "Tips",
          chords: {},
        },
      },
      iBooksX: {
        "macos.toml": {
          name: "Books",
          chords: {},
        },
      },
      iCal: {
        "macos.toml": {
          name: "Calendar",
          chords: {},
        },
      },
      iMovieApp: {
        "macos.toml": {
          name: "iMovie",
          chords: {},
        },
      },
      iWork: {
        Keynote: {
          "macos.toml": {
            name: "Keynote",
            chords: {},
          },
        },
        Numbers: {
          "macos.toml": {
            name: "Numbers",
            chords: {},
          },
        },
        Pages: {
          "macos.toml": {
            name: "Pages",
            chords: {},
          },
        },
      },
      icq: {
        "macos.toml": {
          name: "iCloud+",
          chords: {},
        },
      },
      imageevents: {
        "macos.toml": {
          name: "Image Events",
          chords: {},
        },
      },
      installer: {
        "macos.toml": {
          name: "Installer",
          chords: {},
        },
      },
      journal: {
        "macos.toml": {
          name: "Journal",
          chords: {},
        },
      },
      keychainaccess: {
        "macos.toml": {
          name: "Keychain Access",
          chords: {},
        },
      },
      logic10: {
        "macos.toml": {
          name: "Logic Pro",
          chords: {},
        },
      },
      loginwindow: {
        "macos.toml": {
          name: "loginwindow",
          chords: {},
        },
      },
      macos: {
        classroom: {
          "macos.toml": {
            name: "Classroom",
            chords: {},
          },
        },
      },
      mail: {
        "macos.toml": {
          name: "Mail",
          chords: {},
        },
      },
      mainstage3: {
        "macos.toml": {
          name: "MainStage",
          chords: {},
        },
      },
      mcx: {
        ProfileHelper: {
          "macos.toml": {
            name: "ProfileHelper",
            chords: {},
          },
        },
      },
      mobilephone: {
        "macos.toml": {
          name: "Phone",
          chords: {},
        },
      },
      motionapp: {
        "macos.toml": {
          name: "Motion",
          chords: {},
        },
      },
      motionappApp: {
        "macos.toml": {
          name: "Motion: Animate Effects",
          chords: {},
        },
      },
      musicrecognition: {
        mac: {
          "macos.toml": {
            name: "MusicRecognitionMac",
            chords: {},
          },
        },
      },
      news: {
        "macos.toml": {
          name: "News",
          chords: {},
        },
      },
      notificationcenterui: {
        "macos.toml": {
          name: "NotificationCenter",
          chords: {},
        },
      },
      pixelmator: {
        "macos.toml": {
          name: "Pixelmator Pro: Edit Images",
          chords: {},
        },
      },
      pluginIM: {
        pluginIMRegistrator: {
          "macos.toml": {
            name: "RegisterPluginIMApp",
            chords: {},
          },
        },
      },
      podcasts: {
        "macos.toml": {
          name: "Podcasts",
          chords: {},
        },
      },
      print: {
        add: {
          "macos.toml": {
            name: "AddPrinter",
            chords: {},
          },
        },
      },
      printcenter: {
        "macos.toml": {
          name: "Print Center",
          chords: {},
        },
      },
      rcd: {
        "macos.toml": {
          name: "rcd",
          chords: {},
        },
      },
      reminders: {
        "macos.toml": {
          name: "Reminders",
          chords: {},
        },
      },
      screencaptureui: {
        "macos.toml": {
          name: "screencaptureui",
          chords: {},
        },
      },
      screenshot: {
        launcher: {
          "macos.toml": {
            name: "Screenshot",
            chords: {},
          },
        },
      },
      security: {
        "Keychain-Circle-Notification": {
          "macos.toml": {
            name: "Keychain Circle Notification",
            chords: {},
          },
        },
      },
      shortcuts: {
        droplet: {
          "macos.toml": {
            name: "ShortcutDroplet",
            chords: {},
          },
        },
        events: {
          "macos.toml": {
            name: "Shortcuts Events",
            chords: {},
          },
        },
        "macos.toml": {
          name: "Shortcuts",
          chords: {},
        },
      },
      siri: {
        launcher: {
          "macos.toml": {
            name: "Siri",
            chords: {},
          },
        },
        "macos.toml": {
          name: "Siri",
          chords: {},
        },
      },
      stocks: {
        "macos.toml": {
          name: "Stocks",
          chords: {},
        },
      },
      systemevents: {
        "macos.toml": {
          name: "System Events",
          chords: {},
        },
      },
      systemuiserver: {
        "macos.toml": {
          name: "SystemUIServer",
          chords: {},
        },
      },
      tcc: {
        AuthorizationPromptService: {
          "macos.toml": {
            name: "AuthorizationPromptService",
            chords: {},
          },
        },
      },
      tips: {
        "macos.toml": {
          name: "TipsSpotlightHandler",
          chords: {},
        },
      },
      universalcontrol: {
        "macos.toml": {
          name: "UniversalControl",
          chords: {},
        },
      },
      wallpaper: {
        agent: {
          "macos.toml": {
            name: "WallpaperAgent",
            chords: {},
          },
        },
      },
      weather: {
        "macos.toml": {
          name: "Weather",
          chords: {},
        },
      },
      widgetkit: {
        simulator: {
          "macos.toml": {
            name: "WidgetKit Simulator",
            chords: {},
          },
        },
      },
      wifi: {
        WiFiAgent: {
          "macos.toml": {
            name: "WiFiAgent",
            chords: {},
          },
        },
        diagnostics: {
          "macos.toml": {
            name: "Wireless Diagnostics",
            chords: {},
          },
        },
      },
      windowmanager: {
        StageManagerOnboarding: {
          "macos.toml": {
            name: "StageManagerOnboarding",
            chords: {},
          },
        },
        "macos.toml": {
          name: "WindowManager",
          chords: {},
        },
      },
    },
  },
  "macos.toml": {
    name: "macOS",
    chords: {},
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
