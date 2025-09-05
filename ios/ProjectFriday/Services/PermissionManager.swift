import Foundation
import SwiftUI
import UserNotifications
import Contacts

@MainActor
class PermissionManager: ObservableObject {
    static let shared = PermissionManager()
    
    @Published var pushNotificationStatus: UNAuthorizationStatus = .notDetermined
    @Published var contactsStatus: CNAuthorizationStatus = .notDetermined
    
    private init() {
        updatePermissionStatuses()
    }
    
    // MARK: - Permission Status Updates
    
    func updatePermissionStatuses() {
        updatePushNotificationStatus()
        updateContactsStatus()
    }
    
    private func updatePushNotificationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.pushNotificationStatus = settings.authorizationStatus
            }
        }
    }
    
    private func updateContactsStatus() {
        contactsStatus = CNContactStore.authorizationStatus(for: .contacts)
    }
    
    // MARK: - Push Notifications
    
    func requestPushNotificationPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            updatePushNotificationStatus()
            return granted
        } catch {
            print("Error requesting push notification permission: \(error)")
            return false
        }
    }
    
    var isPushNotificationPermissionGranted: Bool {
        return pushNotificationStatus == .authorized
    }
    
    var isPushNotificationPermissionDenied: Bool {
        return pushNotificationStatus == .denied
    }
    
    // MARK: - Contacts
    
    func requestContactsPermission() async -> Bool {
        let store = CNContactStore()
        
        do {
            let granted = try await store.requestAccess(for: .contacts)
            updateContactsStatus()
            return granted
        } catch {
            print("Error requesting contacts permission: \(error)")
            return false
        }
    }
    
    var isContactsPermissionGranted: Bool {
        return contactsStatus == .authorized
    }
    
    var isContactsPermissionDenied: Bool {
        return contactsStatus == .denied
    }
    
    // MARK: - Settings Deep Links
    
    func openAppSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        
        if UIApplication.shared.canOpenURL(settingsUrl) {
            UIApplication.shared.open(settingsUrl)
        }
    }
    
    // MARK: - Combined Permission Status
    
    var allCriticalPermissionsGranted: Bool {
        return isPushNotificationPermissionGranted
        // Note: Contacts permission is helpful but not critical for core functionality
    }
    
    var hasAnyPermissionDenied: Bool {
        return isPushNotificationPermissionDenied || isContactsPermissionDenied
    }
    
    // MARK: - Permission Descriptions
    
    func getPermissionDescription(for permission: PermissionType) -> PermissionInfo {
        switch permission {
        case .pushNotifications:
            return PermissionInfo(
                title: "Push Notifications",
                description: "Get notified instantly when important calls are screened so you never miss what matters.",
                systemName: "bell.fill",
                isRequired: true,
                status: pushNotificationStatus.description,
                isGranted: isPushNotificationPermissionGranted
            )
        case .contacts:
            return PermissionInfo(
                title: "Contacts Access",
                description: "Allow Project Friday to identify known contacts and automatically allow their calls through.",
                systemName: "person.2.fill",
                isRequired: false,
                status: contactsStatus.description,
                isGranted: isContactsPermissionGranted
            )
        }
    }
}

// MARK: - Permission Types and Info

enum PermissionType: CaseIterable {
    case pushNotifications
    case contacts
}

struct PermissionInfo {
    let title: String
    let description: String
    let systemName: String
    let isRequired: Bool
    let status: String
    let isGranted: Bool
}

// MARK: - Extensions

extension UNAuthorizationStatus {
    var description: String {
        switch self {
        case .notDetermined:
            return "Not requested"
        case .denied:
            return "Denied"
        case .authorized:
            return "Granted"
        case .provisional:
            return "Provisional"
        case .ephemeral:
            return "Ephemeral"
        @unknown default:
            return "Unknown"
        }
    }
}

extension CNAuthorizationStatus {
    var description: String {
        switch self {
        case .notDetermined:
            return "Not requested"
        case .restricted:
            return "Restricted"
        case .denied:
            return "Denied"
        case .authorized:
            return "Granted"
        @unknown default:
            return "Unknown"
        }
    }
}