// Loaded into LiveSplit One, either at launch through DYLD_INSERT_LIBRARIES or later with
// lldb's `process load`. It listens on a per-process Unix socket in the user's temporary
// directory and runs each request's JavaScript in the app's web view.
//
// Protocol: one JSON line `{"body": "<async function body>"}` in, one JSON line
// `{"ok": true, "value": …}` or `{"ok": false, "error": "…"}` out, then the bridge closes the
// connection.

#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

static const size_t MAX_REQUEST_BYTES = 1 << 20;

static char socketPath[sizeof(((struct sockaddr_un *)0)->sun_path)];
static dispatch_source_t listener;

static void reply(int client, NSDictionary *response) {
  NSMutableData *data =
      [[NSJSONSerialization dataWithJSONObject:response options:0 error:nil] mutableCopy];
  if (!data) {
    data = [[@"{\"ok\":false,\"error\":\"The JavaScript result is not JSON-serializable.\"}"
        dataUsingEncoding:NSUTF8StringEncoding] mutableCopy];
  }
  [data appendBytes:"\n" length:1];
  const char *bytes = data.bytes;
  size_t remaining = data.length;
  while (remaining > 0) {
    ssize_t written = write(client, bytes, remaining);
    if (written <= 0) break;
    bytes += written;
    remaining -= (size_t)written;
  }
  close(client);
}

static void replyInBackground(int client, NSDictionary *response) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    reply(client, response);
  });
}

static WKWebView *findWebView(NSView *view) {
  if ([view isKindOfClass:WKWebView.class]) return (WKWebView *)view;
  for (NSView *child in view.subviews) {
    WKWebView *found = findWebView(child);
    if (found) return found;
  }
  return nil;
}

// LiveSplit One's pop-out windows are about:blank documents written by the main page.
static WKWebView *appWebView(void) {
  NSMutableArray<NSWindow *> *windows = [NSApp.windows mutableCopy];
  if (NSApp.mainWindow) {
    [windows removeObject:NSApp.mainWindow];
    [windows insertObject:NSApp.mainWindow atIndex:0];
  }
  for (NSWindow *window in windows) {
    WKWebView *webView = findWebView(window.contentView);
    if (webView && ![webView.URL.scheme isEqualToString:@"about"]) return webView;
  }
  return nil;
}

static void evaluate(int client, NSString *body) {
  dispatch_async(dispatch_get_main_queue(), ^{
    WKWebView *webView = appWebView();
    if (!webView) {
      replyInBackground(client, @{@"ok" : @NO, @"error" : @"LiveSplit One has no open window."});
      return;
    }
    [webView callAsyncJavaScript:body
                       arguments:nil
                         inFrame:nil
                  inContentWorld:WKContentWorld.pageWorld
               completionHandler:^(id value, NSError *error) {
                 NSString *message = error.userInfo[@"WKJavaScriptExceptionMessage"]
                                         ?: error.localizedDescription;
                 replyInBackground(client, error ? @{@"ok" : @NO, @"error" : message}
                                                 : @{@"ok" : @YES, @"value" : value ?: NSNull.null});
               }];
  });
}

static void serve(int client) {
  uid_t uid;
  gid_t gid;
  if (getpeereid(client, &uid, &gid) != 0 || uid != getuid()) {
    close(client);
    return;
  }
  int on = 1;
  // A client that disconnects early must not terminate LiveSplit One with SIGPIPE.
  setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &on, sizeof on);
  struct timeval timeout = {.tv_sec = 5};
  setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof timeout);

  NSMutableData *request = [NSMutableData data];
  char buffer[4096];
  for (;;) {
    ssize_t count = read(client, buffer, sizeof buffer);
    if (count <= 0 || request.length + (size_t)count > MAX_REQUEST_BYTES) {
      close(client);
      return;
    }
    char *newline = memchr(buffer, '\n', (size_t)count);
    [request appendBytes:buffer length:newline ? (size_t)(newline - buffer) : (size_t)count];
    if (newline) break;
  }

  NSDictionary *message = [NSJSONSerialization JSONObjectWithData:request options:0 error:nil];
  NSString *body = [message isKindOfClass:NSDictionary.class] ? message[@"body"] : nil;
  if (![body isKindOfClass:NSString.class]) {
    reply(client, @{@"ok" : @NO, @"error" : @"The bridge received a malformed request."});
    return;
  }
  evaluate(client, body);
}

static BOOL connectAddress(const struct sockaddr_un *address) {
  int probe = socket(AF_UNIX, SOCK_STREAM, 0);
  if (probe < 0) return NO;
  BOOL connected = connect(probe, (const struct sockaddr *)address, sizeof *address) == 0;
  close(probe);
  return connected;
}

__attribute__((constructor)) static void startBridge(void) {
  char directory[PATH_MAX];
  if (confstr(_CS_DARWIN_USER_TEMP_DIR, directory, sizeof directory) == 0) return;
  int length = snprintf(socketPath, sizeof socketPath, "%skeychord-livesplit-%d.sock", directory,
                        getpid());
  if (length < 0 || (size_t)length >= sizeof socketPath) return;

  struct sockaddr_un address = {.sun_family = AF_UNIX};
  strlcpy(address.sun_path, socketPath, sizeof address.sun_path);
  // Another copy of the bridge (for example from a different package path) already serves this
  // process.
  if (connectAddress(&address)) return;

  int server = socket(AF_UNIX, SOCK_STREAM, 0);
  if (server < 0) return;
  unlink(socketPath);
  mode_t previousMask = umask(0077);
  int bound = bind(server, (const struct sockaddr *)&address, sizeof address);
  umask(previousMask);
  if (bound != 0 || listen(server, 8) != 0) {
    close(server);
    return;
  }
  atexit_b(^{
    unlink(socketPath);
  });

  dispatch_queue_t queue =
      dispatch_queue_create("org.keychord.livesplit.bridge", DISPATCH_QUEUE_CONCURRENT);
  listener = dispatch_source_create(DISPATCH_SOURCE_TYPE_READ, (uintptr_t)server, 0, queue);
  dispatch_source_set_event_handler(listener, ^{
    int client = accept(server, NULL, NULL);
    if (client >= 0) dispatch_async(queue, ^{
        serve(client);
      });
  });
  dispatch_resume(listener);
}
