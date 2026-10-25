import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct LongevityLiveApp: App {
    init() { FirebaseApp.configure() }
    var body: some Scene {
        WindowGroup { ContentView().onOpenURL { url in
            if url.scheme == "longevitylive" { NotificationCenter.default.post(name: Notification.Name("LongevityOpenRun"), object: nil) }
            else { GIDSignIn.sharedInstance.handle(url) }
        } }
    }
}
