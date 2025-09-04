import Foundation
import Firebase

struct User: Identifiable, Codable {
    let id: String
    let email: String
    let displayName: String?
    let phoneNumber: String?
    let photoURL: String?
    let isEmailVerified: Bool
    let createdAt: Date
    let lastSignIn: Date?
    
    // Call screening preferences
    var isCallScreeningEnabled: Bool
    var allowedContacts: [String]
    var blockedNumbers: [String]
    var screeningPrompt: String?
    
    init(from firebaseUser: Firebase.User) {
        self.id = firebaseUser.uid
        self.email = firebaseUser.email ?? ""
        self.displayName = firebaseUser.displayName
        self.phoneNumber = firebaseUser.phoneNumber
        self.photoURL = firebaseUser.photoURL?.absoluteString
        self.isEmailVerified = firebaseUser.isEmailVerified
        self.createdAt = firebaseUser.metadata.creationDate ?? Date()
        self.lastSignIn = firebaseUser.metadata.lastSignInDate
        
        // Default values for call screening
        self.isCallScreeningEnabled = false
        self.allowedContacts = []
        self.blockedNumbers = []
        self.screeningPrompt = nil
    }
    
    init(id: String, email: String, displayName: String? = nil, phoneNumber: String? = nil) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.phoneNumber = phoneNumber
        self.photoURL = nil
        self.isEmailVerified = false
        self.createdAt = Date()
        self.lastSignIn = nil
        
        // Default values for call screening
        self.isCallScreeningEnabled = false
        self.allowedContacts = []
        self.blockedNumbers = []
        self.screeningPrompt = nil
    }
}