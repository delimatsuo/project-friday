import Foundation
import SwiftUI
import Firebase
import AuthenticationServices
import CryptoKit

@MainActor
class AuthenticationViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var currentUser: User?
    @Published var errorMessage: String?
    
    private let firebaseService = FirebaseService.shared
    private var currentNonce: String?
    
    init() {
        checkAuthenticationState()
    }
    
    // MARK: - Authentication State
    
    func checkAuthenticationState() {
        if let firebaseUser = firebaseService.getCurrentUser() {
            self.currentUser = User(from: firebaseUser)
            self.isAuthenticated = true
        } else {
            self.currentUser = nil
            self.isAuthenticated = false
        }
    }
    
    // MARK: - Email/Password Authentication
    
    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let user = try await firebaseService.signIn(email: email, password: password)
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            self.errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func signUp(email: String, password: String, displayName: String?) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let user = try await firebaseService.signUp(email: email, password: password, displayName: displayName)
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            self.errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func signOut() {
        do {
            try firebaseService.signOut()
            self.currentUser = nil
            self.isAuthenticated = false
        } catch {
            self.errorMessage = error.localizedDescription
        }
    }
    
    func resetPassword(email: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await firebaseService.resetPassword(email: email)
            // Success message could be shown here
        } catch {
            self.errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Google Sign In
    
    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let user = try await firebaseService.signInWithGoogle()
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            self.errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Apple Sign In
    
    func signInWithApple() {
        let request = createAppleIDRequest()
        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.presentationContextProvider = self
        authorizationController.performRequests()
    }
    
    private func createAppleIDRequest() -> ASAuthorizationAppleIDRequest {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        
        let nonce = randomNonceString()
        currentNonce = nonce
        request.nonce = sha256(nonce)
        
        return request
    }
    
    // MARK: - Helper Methods for Apple Sign In
    
    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset: [Character] =
        Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length
        
        while remainingLength > 0 {
            let randoms: [UInt8] = (0 ..< 16).map { _ in
                var random: UInt8 = 0
                let errorCode = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
                if errorCode != errSecSuccess {
                    fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
                }
                return random
            }
            
            randoms.forEach { random in
                if remainingLength == 0 {
                    return
                }
                
                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }
        
        return result
    }
    
    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        let hashString = hashedData.compactMap {
            String(format: "%02x", $0)
        }.joined()
        
        return hashString
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthenticationViewModel: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        Task {
            isLoading = true
            errorMessage = nil
            
            do {
                let user = try await firebaseService.signInWithApple(authorization: authorization)
                await MainActor.run {
                    self.currentUser = user
                    self.isAuthenticated = true
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        errorMessage = error.localizedDescription
        isLoading = false
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AuthenticationViewModel: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first else {
            fatalError("No window available")
        }
        return window
    }
}