import SwiftUI
import Firebase

@main
struct ProjectFridayApp: App {
    @StateObject private var authViewModel = AuthenticationViewModel()
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    init() {
        configureFirebase()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authViewModel)
                .onOpenURL { url in
                    // Handle widget deep links
                    handleWidgetURL(url)
                }
        }
    }
    
    private func configureFirebase() {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") else {
            print("GoogleService-Info.plist not found")
            return
        }
        
        guard let options = FirebaseOptions(contentsOfFile: path) else {
            print("Failed to create FirebaseOptions")
            return
        }
        
        FirebaseApp.configure(options: options)
        
        // Configure additional Firebase services
        #if DEBUG
        Auth.auth().useEmulator(withHost: "localhost", port: 9099)
        #endif
    }
    
    private func handleWidgetURL(_ url: URL) {
        // Handle widget deep linking
        guard url.scheme == "projectfriday" else { return }
        
        switch url.host {
        case "toggle-service":
            // Widget tapped to toggle service
            // The actual toggle is handled in the widget itself
            // This just ensures the app is aware of the action
            print("Service toggle requested from widget")
            
        case "open-app":
            // Widget tapped to open main app
            // App is already opening, no additional action needed
            print("App opened from widget")
            
        case "open-settings":
            // Widget tapped to open settings
            // Could navigate to specific settings screen
            print("Settings requested from widget")
            
        default:
            print("Unknown widget URL: \(url)")
        }
    }
}