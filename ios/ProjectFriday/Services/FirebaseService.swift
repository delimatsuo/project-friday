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
    private let errorHandler = ErrorHandler()
    
    private init() {}
    
    // MARK: - Authentication State Listener
    
    private var authStateListener: AuthStateDidChangeListenerHandle?
    
    func addAuthStateListener(callback: @escaping (Firebase.User?) -> Void) {
        authStateListener = auth.addStateDidChangeListener { _, user in
            callback(user)
        }
    }
    
    func removeAuthStateListener() {
        if let listener = authStateListener {
            auth.removeStateDidChangeListener(listener)
            authStateListener = nil
        }
    }
    
    // MARK: - Authentication
    
    func signIn(email: String, password: String) async throws -> User {
        return try await errorHandler.executeWithRetry {
            let result = try await auth.signIn(withEmail: email, password: password)
            let user = User(from: result.user)
            try await saveUserToFirestore(user: user)
            return user
        }
    }
    
    func signUp(email: String, password: String, displayName: String? = nil) async throws -> User {
        do {
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
        } catch {
            throw AuthError(from: error)
        }
    }
    
    func signOut() throws {
        try auth.signOut()
    }
    
    func resetPassword(email: String) async throws {
        do {
            try await auth.sendPasswordReset(withEmail: email)
        } catch {
            throw AuthError(from: error)
        }
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
    
    func signInWithApple(authorization: ASAuthorization, nonce: String) async throws -> User {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            throw AuthError.invalidCredential
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
        try await errorHandler.executeWithCircuitBreaker(serviceName: "firestore") {
            let userDoc = self.db.collection("users").document(user.id)
            
            // Check if user document exists
            let document = try await userDoc.getDocument()
            let isNewUser = !document.exists
            
            var userData: [String: Any] = [
                "id": user.id,
                "email": user.email,
                "displayName": user.displayName ?? "",
                "phoneNumber": user.phoneNumber ?? "",
                "photoURL": user.photoURL ?? "",
                "isEmailVerified": user.isEmailVerified,
                "lastSignIn": Date(),
                "updatedAt": Date()
            ]
            
            // Only set these fields for new users
            if isNewUser {
                userData["createdAt"] = user.createdAt
                userData["isCallScreeningEnabled"] = user.isCallScreeningEnabled
                userData["allowedContacts"] = user.allowedContacts
                userData["blockedNumbers"] = user.blockedNumbers
                userData["screeningPrompt"] = user.screeningPrompt ?? ""
                userData["hasCompletedOnboarding"] = false
                userData["profileCompleted"] = false
            }
            
            try await userDoc.setData(userData, merge: true)
        }
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
    
    func updateOnboardingStatus(uid: String, completed: Bool) async throws {
        let userDoc = db.collection("users").document(uid)
        try await userDoc.setData([
            "hasCompletedOnboarding": completed,
            "updatedAt": Date()
        ], merge: true)
    }
    
    func updateProfileCompletion(uid: String, completed: Bool) async throws {
        let userDoc = db.collection("users").document(uid)
        try await userDoc.setData([
            "profileCompleted": completed,
            "updatedAt": Date()
        ], merge: true)
    }
    
    // MARK: - Helper Methods
    
    // Store the current nonce for Apple Sign In
    private var currentNonce: String?
    
    func setCurrentNonce(_ nonce: String) {
        currentNonce = nonce
    }
    
    private func getCurrentNonce() -> String? {
        return currentNonce
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
    case userCancelled
    case networkError
    case weakPassword
    case emailAlreadyInUse
    case invalidEmail
    case userNotFound
    case wrongPassword
    case tooManyRequests
    
    var errorDescription: String? {
        switch self {
        case .noViewController:
            return "Unable to present sign in screen. Please try again."
        case .noClientID:
            return "Google sign in is not properly configured. Please contact support."
        case .noIDToken:
            return "Sign in failed. Please try again."
        case .invalidCredential:
            return "Invalid sign in credentials. Please try again."
        case .invalidNonce:
            return "Apple sign in failed. Please try again."
        case .invalidToken:
            return "Authentication failed. Please try again."
        case .userCancelled:
            return "Sign in was cancelled."
        case .networkError:
            return "Network connection failed. Please check your internet and try again."
        case .weakPassword:
            return "Password should be at least 6 characters long."
        case .emailAlreadyInUse:
            return "An account with this email already exists. Please sign in instead."
        case .invalidEmail:
            return "Please enter a valid email address."
        case .userNotFound:
            return "No account found with this email. Please sign up first."
        case .wrongPassword:
            return "Incorrect password. Please try again or reset your password."
        case .tooManyRequests:
            return "Too many failed attempts. Please try again later."
        }
    }
    
    init(from firebaseError: Error) {
        let nsError = firebaseError as NSError
        
        switch nsError.code {
        case AuthErrorCode.networkError.rawValue:
            self = .networkError
        case AuthErrorCode.weakPassword.rawValue:
            self = .weakPassword
        case AuthErrorCode.emailAlreadyInUse.rawValue:
            self = .emailAlreadyInUse
        case AuthErrorCode.invalidEmail.rawValue:
            self = .invalidEmail
        case AuthErrorCode.userNotFound.rawValue:
            self = .userNotFound
        case AuthErrorCode.wrongPassword.rawValue:
            self = .wrongPassword
        case AuthErrorCode.tooManyRequests.rawValue:
            self = .tooManyRequests
        default:
            self = .networkError
        }
    }
}