import SwiftUI

@main
struct __APP_NAME__App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowResizability(.contentSize)
        .commands {
            // A single-purpose container app has no document lifecycle.
            CommandGroup(replacing: .newItem) {}
        }
    }
}
