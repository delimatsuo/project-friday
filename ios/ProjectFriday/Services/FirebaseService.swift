import Foundation
import Firebase
import FirebaseAuth
import FirebaseFirestore
import GoogleSignIn
import AuthenticationServices

class FirebaseService: ObservableObject {
    static let shared = FirebaseService()
    
    private let db = Firestore.firestore()
    private let auth = Auth.auth()
    
    private init() {}
    
    // MARK: - Authentication
    
    func signIn(email: String, password: String) async throws -> User {
        let result = try await auth.signIn(withEmail: email, password: password)
        let user = User(from: result.user)
        try await saveUserToFirestore(user: user)
        return user
    }
    
    func signUp(email: String, password: String, displayName: String? = nil) async throws -> User {
        let result = try await auth.createUser(withEmail: email, password: password)
        
        // Update display name if provided
        if let displayName = displayName {
            let changeRequest = result.user.createProfileChangeRequest()
            changeRequest.displayName = displayName
            try await changeRequest.commitChanges()
        }
        
        // Send email verification
        try await result.user.sendEmailVerification()
        
        let user = User(from: result.user)
        try await saveUserToFirestore(user: user)
        return user
    }
    
    func signOut() throws {
        try auth.signOut()
    }
    
    func resetPassword(email: String) async throws {
        try await auth.sendPasswordReset(withEmail: email)
    }
    
    func getCurrentUser() -> Firebase.User? {
        return auth.currentUser
    }
    
    // MARK: - Google Sign In
    
    func signInWithGoogle() async throws -> User {
        guard let presentingViewController = await MainActor.run(body: {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }?.rootViewController
        }) else {
            throw AuthError.noViewController
        }
        
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            throw AuthError.noClientID
        }
        
        GIDConfiguration.shared.configuration = GIDConfiguration(clientID: clientID)
        
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController)
        
        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthError.noIDToken
        }
        
        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: result.user.accessToken.tokenString
        )
        
        let authResult = try await auth.signIn(with: credential)
        let user = User(from: authResult.user)
        try await saveUserToFirestore(user: user)
        return user
    }
    
    // MARK: - Apple Sign In
    
    func signInWithApple(authorization: ASAuthorization) async throws -> User {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            throw AuthError.invalidCredential
        }
        
        guard let nonce = getCurrentNonce() else {
            throw AuthError.invalidNonce
        }
        
        guard let appleIDToken = appleIDCredential.identityToken else {
            throw AuthError.noIDToken
        }
        
        guard let idTokenString = String(data: appleIDToken, encoding: .utf8) else {
            throw AuthError.invalidToken
        }
        
        let credential = OAuthProvider.credential(
            withProviderID: "apple.com",
            idToken: idTokenString,
            rawNonce: nonce
        )
        
        let authResult = try await auth.signIn(with: credential)
        let user = User(from: authResult.user)
        try await saveUserToFirestore(user: user)
        return user
    }
    
    // MARK: - Firestore Operations
    
    private func saveUserToFirestore(user: User) async throws {
        let userDoc = db.collection("users").document(user.id)
        try await userDoc.setData([
            "id": user.id,
            "email": user.email,
            "displayName": user.displayName ?? "",
            "phoneNumber": user.phoneNumber ?? "",
            "photoURL": user.photoURL ?? "",
            "isEmailVerified": user.isEmailVerified,
            "createdAt": user.createdAt,
            "lastSignIn": user.lastSignIn ?? Date(),
            "isCallScreeningEnabled": user.isCallScreeningEnabled,
            "allowedContacts": user.allowedContacts,
            "blockedNumbers": user.blockedNumbers,
            "screeningPrompt": user.screeningPrompt ?? ""
        ], merge: true)
    }
    
    func fetchUser(uid: String) async throws -> User? {
        let document = try await db.collection("users").document(uid).getDocument()
        guard document.exists, let data = document.data() else {
            return nil
        }
        
        return try document.data(as: User.self)
    }
    
    func updateUserProfile(_ user: User) async throws {
        try await saveUserToFirestore(user: user)
    }
    
    // MARK: - Helper Methods
    
    private func getCurrentNonce() -> String? {
        // This would be stored from the Apple Sign In request
        // For now, return a placeholder
        return "placeholder_nonce"
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case noViewController
    case noClientID
    case noIDToken
    case invalidCredential
    case invalidNonce
    case invalidToken
    
    var errorDescription: String? {
        switch self {
        case .noViewController:
            return "No view controller available for sign in"
        case .noClientID:
            return "No Google client ID found"
        case .noIDToken:
            return "No ID token received"
        case .invalidCredential:
            return "Invalid credential received"
        case .invalidNonce:
            return "Invalid nonce"
        case .invalidToken:
            return "Invalid token format"
        }
    }
}