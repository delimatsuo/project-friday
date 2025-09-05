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
}