import SafariServices
import SwiftUI

/// The bundle identifier of the embedded Safari Web Extension target.
/// Keep in sync with the extension target's PRODUCT_BUNDLE_IDENTIFIER.
let extensionBundleIdentifier = "__EXT_BUNDLE_ID__"

struct ContentView: View {
    @State private var extensionEnabled: Bool?

    var body: some View {
        VStack(spacing: 16) {
            Image("ExtensionIcon")
                .resizable()
                .interpolation(.high)
                .frame(width: 96, height: 96)
                .shadow(radius: 4, y: 2)

            Text("__APP_DISPLAY_NAME__")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text(statusText)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Button("Open Safari Extension Settings…") {
                SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
                    if let error {
                        NSLog("Failed to open Safari extension settings: \(error.localizedDescription)")
                    }
                }
            }
            .controlSize(.large)

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q")
        }
        .padding(32)
        .frame(width: 440, height: 360)
        .onAppear(perform: refreshExtensionState)
    }

    private var statusText: String {
        switch extensionEnabled {
        case .some(true):
            return "The extension is enabled in Safari. You're protected."
        case .some(false):
            return "The extension is installed but turned off. Enable it in Safari → Settings → Extensions."
        case .none:
            return "This app contains the __APP_DISPLAY_NAME__ Safari extension. Enable it in Safari → Settings → Extensions."
        }
    }

    private func refreshExtensionState() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            if let error {
                NSLog("Failed to read Safari extension state: \(error.localizedDescription)")
                return
            }
            DispatchQueue.main.async {
                extensionEnabled = state?.isEnabled ?? false
            }
        }
    }
}

#Preview {
    ContentView()
}
