import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    
    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                MainView()
            } else {
                SignInView()
            }
        }
        .onAppear {
            authViewModel.checkAuthenticationState()
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthenticationViewModel())
}