import AppKit
import WebKit

@MainActor
final class RaycastFixture: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var window: NSWindow!
    var web: WKWebView!
    var activations: [String] = []
    var observations: [[String: String]] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "activated")
        config.userContentController.add(self, name: "observed")
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 600, height: 400),
                          styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Raycast search fixture"
        window.contentView = web
        window.isReleasedWhenClosed = false
        web.loadHTMLString(#"""
        <html><body>
        <div id="search" aria-busy="false">
          <input id="input" placeholder="Search for apps or commands…" autofocus>
        </div>
        <div role="group" aria-label="Root search results" id="results">Suggestions</div>
        <button id="open" aria-label="Open Application ↵">Open Application ↵</button>
        <script>
          const input = document.querySelector('#input');
          const search = document.querySelector('#search');
          const results = document.querySelector('#results');
          const open = document.querySelector('#open');
          let timer;
          function update(event) {
            window.webkit.messageHandlers.observed.postMessage({type: event.type, query: input.value});
            clearTimeout(timer);
            search.setAttribute('aria-busy', 'true');
            open.disabled = true;
            const query = input.value;
            // Deliberately exceed the old 200 ms delay and preserve stale results.
            timer = setTimeout(() => {
              results.textContent = 'First match for ' + query;
              search.setAttribute('aria-busy', 'false');
              open.disabled = false;
            }, 450);
          }
          input.addEventListener('input', update);
          input.addEventListener('change', update);
          open.addEventListener('click', () => {
            window.webkit.messageHandlers.activated.postMessage(input.value);
          });
        </script></body></html>
        """#, baseURL: nil)
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { show() }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        show()
        return false
    }
    func show() {
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        web.evaluateJavaScript("document.querySelector('#input').focus()")
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "observed", let observation = message.body as? [String: String] {
            observations.append(observation)
            persist()
            return
        }
        guard let query = message.body as? String else { return }
        activations.append(query)
        persist()
        window.orderOut(nil)
        NSApplication.shared.hide(nil)
    }
    func persist() {
        let data = try! JSONSerialization.data(withJSONObject: ["activations": activations, "observations": observations])
        try! data.write(to: URL(fileURLWithPath: output), options: .atomic)
    }
}

@main
struct Main {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = RaycastFixture()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
