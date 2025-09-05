/**
 * NotificationService
 * Handles Firebase Cloud Messaging (FCM) push notifications for iOS
 * Manages local notifications, badge counts, and notification permissions
 */

import Foundation
import UserNotifications
import UIKit
import Firebase
import FirebaseMessaging
import FirebaseFirestore

enum NavigationDestination {
    case callDetails(String)
    case home
    case settings
}

protocol NotificationServiceProtocol {
    func requestNotificationPermissions(completion: @escaping (Bool, Error?) -> Void)
    func getFCMToken(completion: @escaping (String?, Error?) -> Void)
    func storeFCMToken(_ token: String, forUser userId: String, completion: @escaping (Bool, Error?) -> Void)
    func handleForegroundNotification(userInfo: [AnyHashable: Any]) -> UNNotificationPresentationOptions
    func handleBackgroundNotification(userInfo: [AnyHashable: Any], completion: @escaping (UIBackgroundFetchResult) -> Void)
    func handleNotificationTap(userInfo: [AnyHashable: Any]) -> Bool
}

class NotificationService: NSObject, NotificationServiceProtocol {
    
    // MARK: - Properties
    
    let userNotificationCenter: UNUserNotificationCenter
    let messaging: Messaging
    let firestore: Firestore
    
    var currentUserId: String?
    var lastNavigationDestination: NavigationDestination?
    
    // Notification categories for different call types
    private let callCategory = "CALL_CATEGORY"
    private let urgentCallCategory = "URGENT_CALL_CATEGORY"
    private let summaryCategory = "SUMMARY_CATEGORY"
    
    // MARK: - Initialization
    
    convenience override init() {
        self.init(
            userNotificationCenter: UNUserNotificationCenter.current(),
            messaging: Messaging.messaging(),
            firestore: Firestore.firestore()
        )
    }
    
    init(userNotificationCenter: UNUserNotificationCenter,
         messaging: Messaging,
         firestore: Firestore) {
        self.userNotificationCenter = userNotificationCenter
        self.messaging = messaging
        self.firestore = firestore
        
        super.init()
        
        setupNotificationCategories()
        setupMessagingDelegate()
    }
    
    // MARK: - Setup Methods
    
    func setupNotificationCategories() {
        let callActions = [
            UNNotificationAction(
                identifier: "CALL_BACK_ACTION",
                title: "Call Back",
                options: [.foreground]
            ),
            UNNotificationAction(
                identifier: "ADD_CONTACT_ACTION",
                title: "Add to Contacts",
                options: []
            ),
            UNNotificationAction(
                identifier: "BLOCK_ACTION",
                title: "Block Number",
                options: [.destructive]
            )
        ]
        
        let urgentActions = [
            UNNotificationAction(
                identifier: "URGENT_CALL_BACK_ACTION",
                title: "Call Back Now",
                options: [.foreground]
            ),
            UNNotificationAction(
                identifier: "VIEW_DETAILS_ACTION",
                title: "View Details",
                options: [.foreground]
            )
        ]
        
        let summaryActions = [
            UNNotificationAction(
                identifier: "VIEW_SUMMARY_ACTION",
                title: "View Summary",
                options: [.foreground]
            ),
            UNNotificationAction(
                identifier: "DISMISS_ACTION",
                title: "Dismiss",
                options: []
            )
        ]
        
        let categories: Set<UNNotificationCategory> = [
            UNNotificationCategory(
                identifier: callCategory,
                actions: callActions,
                intentIdentifiers: [],
                options: [.customDismissAction]
            ),
            UNNotificationCategory(
                identifier: urgentCallCategory,
                actions: urgentActions,
                intentIdentifiers: [],
                options: [.customDismissAction]
            ),
            UNNotificationCategory(
                identifier: summaryCategory,
                actions: summaryActions,
                intentIdentifiers: [],
                options: [.customDismissAction]
            )
        ]
        
        userNotificationCenter.setNotificationCategories(categories)
    }
    
    private func setupMessagingDelegate() {
        messaging.delegate = self
    }
    
    // MARK: - Permission Management
    
    func requestNotificationPermissions(completion: @escaping (Bool, Error?) -> Void) {
        let options: UNAuthorizationOptions = [.alert, .badge, .sound]
        
        userNotificationCenter.requestAuthorization(options: options) { granted, error in
            DispatchQueue.main.async {
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                completion(granted, error)
            }
        }
    }
    
    func getNotificationSettings(completion: @escaping (UNNotificationSettings) -> Void) {
        userNotificationCenter.getNotificationSettings { settings in
            DispatchQueue.main.async {
                completion(settings)
            }
        }
    }
    
    // MARK: - FCM Token Management
    
    func getFCMToken(completion: @escaping (String?, Error?) -> Void) {
        messaging.token { token, error in
            DispatchQueue.main.async {
                completion(token, error)
            }
        }
    }
    
    func storeFCMToken(_ token: String, forUser userId: String, completion: @escaping (Bool, Error?) -> Void) {
        let userData: [String: Any] = [
            "fcmToken": token,
            "fcmTokenUpdatedAt": FieldValue.serverTimestamp(),
            "platform": "ios",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        ]
        
        firestore.collection("users").document(userId).updateData(userData) { error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(false, error)
                } else {
                    completion(true, nil)
                }
            }
        }
    }
    
    func handleFCMTokenRefresh(_ token: String) {
        guard let userId = currentUserId else {
            print("No current user ID, cannot store FCM token")
            return
        }
        
        storeFCMToken(token, forUser: userId) { success, error in
            if success {
                print("FCM token refreshed and stored successfully")
            } else {
                print("Failed to store refreshed FCM token: \\(error?.localizedDescription ?? "unknown error")")
            }
        }
    }
    
    // MARK: - Notification Handling
    
    func handleForegroundNotification(userInfo: [AnyHashable: Any]) -> UNNotificationPresentationOptions {
        guard let type = userInfo["type"] as? String else {
            return []
        }
        
        switch type {
        case "call_screened", "call_completed":
            // Show banner with sound for regular calls
            scheduleLocalNotificationFromPayload(userInfo: userInfo)
            return [.banner, .sound]
            
        case "call_urgent":
            // Show banner with sound and badge for urgent calls
            scheduleLocalNotificationFromPayload(userInfo: userInfo)
            incrementBadgeCount()
            return [.banner, .sound, .badge]
            
        default:
            return [.banner]
        }
    }
    
    func handleBackgroundNotification(userInfo: [AnyHashable: Any], completion: @escaping (UIBackgroundFetchResult) -> Void) {
        // Process notification data in background
        guard let callId = userInfo["callId"] as? String else {
            completion(.failed)
            return
        }
        
        // Update local data store with call information
        updateLocalCallData(from: userInfo) { success in
            if success {
                completion(.newData)
            } else {
                completion(.failed)
            }
        }
    }
    
    func handleNotificationTap(userInfo: [AnyHashable: Any]) -> Bool {
        guard let callId = userInfo["callId"] as? String else {
            return false
        }
        
        // Navigate to appropriate screen based on notification type
        let type = userInfo["type"] as? String ?? "call_screened"
        
        switch type {
        case "call_screened", "call_urgent", "call_completed":
            lastNavigationDestination = .callDetails(callId)
            navigateToCallDetails(callId: callId)
            return true
            
        default:
            return false
        }
    }
    
    // MARK: - Local Notification Management
    
    func scheduleLocalNotification(title: String,
                                 body: String,
                                 userInfo: [String: Any],
                                 categoryId: String,
                                 soundName: String? = nil) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.userInfo = userInfo
        content.categoryIdentifier = categoryId
        
        // Set sound
        if let soundName = soundName {
            content.sound = UNNotificationSound(named: UNNotificationSoundName(soundName))
        } else {
            content.sound = .default
        }
        
        // Create trigger for immediate delivery
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        
        // Create unique identifier from call ID or timestamp
        let identifier = userInfo["callId"] as? String ?? UUID().uuidString
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )
        
        userNotificationCenter.add(request) { error in
            if let error = error {
                print("Failed to schedule local notification: \\(error)")
            }
        }
    }
    
    private func scheduleLocalNotificationFromPayload(userInfo: [AnyHashable: Any]) {
        let title = createNotificationTitle(from: userInfo)
        let body = createNotificationBody(from: userInfo)
        let categoryId = determineCategory(from: userInfo)
        let soundName = determineSoundName(from: userInfo)
        
        let notificationUserInfo = userInfo.reduce(into: [String: Any]()) { result, element in
            result[String(describing: element.key)] = element.value
        }
        
        scheduleLocalNotification(
            title: title,
            body: body,
            userInfo: notificationUserInfo,
            categoryId: categoryId,
            soundName: soundName
        )
    }
    
    private func createNotificationTitle(from userInfo: [AnyHashable: Any]) -> String {
        let phoneNumber = userInfo["phoneNumber"] as? String ?? "Unknown"
        let urgency = userInfo["urgency"] as? String ?? "medium"
        
        if urgency == "high" {
            return "🚨 Urgent Call from \\(phoneNumber)"
        } else {
            return "Call Screened from \\(phoneNumber)"
        }
    }
    
    private func createNotificationBody(from userInfo: [AnyHashable: Any]) -> String {
        if let summary = userInfo["aiSummary"] as? String, !summary.isEmpty {
            return summary
        }
        
        let callerName = userInfo["callerName"] as? String
        let phoneNumber = userInfo["phoneNumber"] as? String ?? "Unknown"
        
        if let name = callerName, !name.isEmpty, name != phoneNumber {
            return "\\(name) called"
        } else {
            return "Call from \\(phoneNumber)"
        }
    }
    
    private func determineCategory(from userInfo: [AnyHashable: Any]) -> String {
        let urgency = userInfo["urgency"] as? String ?? "medium"
        let type = userInfo["type"] as? String ?? "call_screened"
        
        switch type {
        case "call_urgent":
            return urgentCallCategory
        case "call_completed":
            return summaryCategory
        default:
            return urgency == "high" ? urgentCallCategory : callCategory
        }
    }
    
    private func determineSoundName(from userInfo: [AnyHashable: Any]) -> String? {
        let urgency = userInfo["urgency"] as? String ?? "medium"
        return urgency == "high" ? "urgent_notification.wav" : "call_notification.wav"
    }
    
    // MARK: - Badge Management
    
    func updateBadgeCount(_ count: Int) {
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = count
        }
    }
    
    func clearBadgeCount() {
        updateBadgeCount(0)
    }
    
    func incrementBadgeCount() {
        let currentCount = UIApplication.shared.applicationIconBadgeNumber
        updateBadgeCount(currentCount + 1)
    }
    
    // MARK: - Notification Cleanup
    
    func removeDeliveredNotifications(withIds identifiers: [String]) {
        userNotificationCenter.removeDeliveredNotifications(withIdentifiers: identifiers)
    }
    
    func removeAllDeliveredNotifications() {
        userNotificationCenter.removeAllDeliveredNotifications()
    }
    
    func removePendingNotifications(withIds identifiers: [String]) {
        userNotificationCenter.removePendingNotificationRequests(withIdentifiers: identifiers)
    }
    
    // MARK: - Navigation Helpers
    
    private func navigateToCallDetails(callId: String) {
        // Post notification for app navigation
        NotificationCenter.default.post(
            name: NSNotification.Name("NavigateToCallDetails"),
            object: nil,
            userInfo: ["callId": callId]
        )
    }
    
    private func updateLocalCallData(from userInfo: [AnyHashable: Any], completion: @escaping (Bool) -> Void) {
        // Update local Core Data or UserDefaults with call information
        // This is a placeholder for actual implementation
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(true)
        }
    }
}

// MARK: - MessagingDelegate

extension NotificationService: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        
        print("FCM registration token: \\(token)")
        handleFCMTokenRefresh(token)
        
        // Post notification for other parts of the app
        NotificationCenter.default.post(
            name: NSNotification.Name("FCMTokenRefresh"),
            object: nil,
            userInfo: ["token": token]
        )
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationService: UNUserNotificationCenterDelegate {
    
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                              willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo
        let presentationOptions = handleForegroundNotification(userInfo: userInfo)
        completionHandler(presentationOptions)
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                              didReceive response: UNNotificationResponse,
                              withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        let actionIdentifier = response.actionIdentifier
        
        switch actionIdentifier {
        case "CALL_BACK_ACTION", "URGENT_CALL_BACK_ACTION":
            handleCallBackAction(userInfo: userInfo)
        case "ADD_CONTACT_ACTION":
            handleAddContactAction(userInfo: userInfo)
        case "BLOCK_ACTION":
            handleBlockAction(userInfo: userInfo)
        case "VIEW_DETAILS_ACTION", "VIEW_SUMMARY_ACTION":
            handleViewDetailsAction(userInfo: userInfo)
        case UNNotificationDefaultActionIdentifier:
            _ = handleNotificationTap(userInfo: userInfo)
        default:
            break
        }
        
        completionHandler()
    }
    
    // MARK: - Action Handlers
    
    private func handleCallBackAction(userInfo: [AnyHashable: Any]) {
        guard let phoneNumber = userInfo["phoneNumber"] as? String else { return }
        
        if let url = URL(string: "tel://\\(phoneNumber)") {
            UIApplication.shared.open(url)
        }
    }
    
    private func handleAddContactAction(userInfo: [AnyHashable: Any]) {
        // Post notification to show add contact interface
        NotificationCenter.default.post(
            name: NSNotification.Name("ShowAddContact"),
            object: nil,
            userInfo: userInfo
        )
    }
    
    private func handleBlockAction(userInfo: [AnyHashable: Any]) {
        // Post notification to block the number
        NotificationCenter.default.post(
            name: NSNotification.Name("BlockPhoneNumber"),
            object: nil,
            userInfo: userInfo
        )
    }
    
    private func handleViewDetailsAction(userInfo: [AnyHashable: Any]) {
        _ = handleNotificationTap(userInfo: userInfo)
    }
}