import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    
    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                if authViewModel.hasCompletedOnboarding {
                    MainView()
                } else {
                    OnboardingView()
                }
            } else {
                SignInView()
            }
        }
        .onAppear {
            authViewModel.checkAuthenticationState()
        }
        .alert("Success", isPresented: .constant(authViewModel.showSuccessMessage != nil)) {
            Button("OK") {
                authViewModel.clearMessages()
            }
        } message: {
            if let successMessage = authViewModel.showSuccessMessage {
                Text(successMessage)
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthenticationViewModel())
}