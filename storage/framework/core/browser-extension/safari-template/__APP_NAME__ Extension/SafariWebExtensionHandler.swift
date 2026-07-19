import SafariServices
import os.log

/// Bridge for `browser.runtime.sendNativeMessage`. __APP_DISPLAY_NAME__ keeps all
/// state in the web extension itself (no telemetry, no native storage), so
/// this only implements the required protocol and echoes a reply — the web
/// extension never calls it today.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(macOS 15.4, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        }
        else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@", String(describing: message))

        let response = NSExtensionItem()
        if #available(macOS 15.4, *) {
            response.userInfo = [SFExtensionResponseKey: ["Response to": message]]
        }
        else {
            response.userInfo = ["message": ["Response to": message]]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
