/**
 * AppDelegate
 * Handles app lifecycle events and FCM setup
 * Required for Firebase Cloud Messaging integration
 */

import UIKit
import Firebase
import FirebaseMessaging
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    
    var notificationService: NotificationService!
    
    func application(_ application: UIApplication,
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        
        // Initialize notification service
        notificationService = NotificationService()
        
        // Set notification delegates
        UNUserNotificationCenter.current().delegate = notificationService
        
        // Request notification permissions
        notificationService.requestNotificationPermissions { granted, error in
            if granted {
                print("Notification permissions granted")
            } else {
                print("Notification permissions denied: \\(error?.localizedDescription ?? "unknown error")")
            }
        }
        
        return true
    }
    
    // MARK: - Remote Notifications
    
    func application(_ application: UIApplication,
                    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Pass device token to FCM
        Messaging.messaging().apnsToken = deviceToken
        
        print("APNs device token: \\(deviceToken.map { String(format: "%02.2hhx", $0) }.joined())")
    }
    
    func application(_ application: UIApplication,
                    didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Failed to register for remote notifications: \\(error)")
    }
    
    func application(_ application: UIApplication,
                    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        
        // Handle background notification
        notificationService.handleBackgroundNotification(userInfo: userInfo) { result in
            completionHandler(result)
        }
    }
    
    // MARK: - FCM Messaging Integration
    
    func application(_ application: UIApplication,
                    didReceiveRemoteNotification userInfo: [AnyHashable: Any]) {
        // Handle notification when app is running
        print("Received remote notification: \\(userInfo)")
    }
}