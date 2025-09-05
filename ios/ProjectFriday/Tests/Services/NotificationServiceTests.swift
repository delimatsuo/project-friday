/**
 * NotificationService Tests
 * Tests for iOS FCM push notifications and local notification handling
 * Following TDD methodology - these tests drive the implementation
 */

import XCTest
import UserNotifications
import FirebaseMessaging
@testable import ProjectFriday

class NotificationServiceTests: XCTestCase {
    
    var notificationService: NotificationService!
    var mockUserNotificationCenter: MockUNUserNotificationCenter!
    var mockMessaging: MockMessaging!
    var mockFirestore: MockFirestore!
    
    override func setUp() {
        super.setUp()
        
        // Create mock dependencies
        mockUserNotificationCenter = MockUNUserNotificationCenter()
        mockMessaging = MockMessaging()
        mockFirestore = MockFirestore()
        
        // Initialize service with mocks
        notificationService = NotificationService(
            userNotificationCenter: mockUserNotificationCenter,
            messaging: mockMessaging,
            firestore: mockFirestore
        )
    }
    
    override func tearDown() {
        notificationService = nil
        mockUserNotificationCenter = nil
        mockMessaging = nil
        mockFirestore = nil
        super.tearDown()
    }
    
    // MARK: - Initialization Tests
    
    func testInitialization() {
        XCTAssertNotNil(notificationService)
        XCTAssertNotNil(notificationService.userNotificationCenter)
        XCTAssertNotNil(notificationService.messaging)
        XCTAssertNotNil(notificationService.firestore)
    }
    
    func testSetupNotificationCategories() {
        // Setup should register notification categories
        notificationService.setupNotificationCategories()
        
        XCTAssertTrue(mockUserNotificationCenter.setCategoriesCalled)
        XCTAssertEqual(mockUserNotificationCenter.lastSetCategories?.count, 3)
        
        // Check for expected categories
        let categoryIds = mockUserNotificationCenter.lastSetCategories?.map { $0.identifier } ?? []
        XCTAssertTrue(categoryIds.contains("CALL_CATEGORY"))
        XCTAssertTrue(categoryIds.contains("URGENT_CALL_CATEGORY"))
        XCTAssertTrue(categoryIds.contains("SUMMARY_CATEGORY"))
    }
    
    // MARK: - Permission Tests
    
    func testRequestNotificationPermissions_Success() {
        let expectation = XCTestExpectation(description: "Permission granted")
        
        mockUserNotificationCenter.requestAuthorizationResult = (true, nil)
        
        notificationService.requestNotificationPermissions { granted, error in
            XCTAssertTrue(granted)
            XCTAssertNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
        XCTAssertTrue(mockUserNotificationCenter.requestAuthorizationCalled)
    }
    
    func testRequestNotificationPermissions_Denied() {
        let expectation = XCTestExpectation(description: "Permission denied")
        
        mockUserNotificationCenter.requestAuthorizationResult = (false, nil)
        
        notificationService.requestNotificationPermissions { granted, error in
            XCTAssertFalse(granted)
            XCTAssertNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testRequestNotificationPermissions_Error() {
        let expectation = XCTestExpectation(description: "Permission error")
        let testError = NSError(domain: "TestError", code: 1, userInfo: nil)
        
        mockUserNotificationCenter.requestAuthorizationResult = (false, testError)
        
        notificationService.requestNotificationPermissions { granted, error in
            XCTAssertFalse(granted)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - FCM Token Management Tests
    
    func testGetFCMToken_Success() {
        let expectation = XCTestExpectation(description: "FCM token retrieved")
        let expectedToken = "mock-fcm-token-123"
        
        mockMessaging.mockToken = expectedToken
        
        notificationService.getFCMToken { token, error in
            XCTAssertEqual(token, expectedToken)
            XCTAssertNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
        XCTAssertTrue(mockMessaging.tokenCalled)
    }
    
    func testGetFCMToken_Error() {
        let expectation = XCTestExpectation(description: "FCM token error")
        let testError = NSError(domain: "FCMError", code: 1, userInfo: nil)
        
        mockMessaging.mockTokenError = testError
        
        notificationService.getFCMToken { token, error in
            XCTAssertNil(token)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testStoreFCMToken_Success() {
        let expectation = XCTestExpectation(description: "FCM token stored")
        let testToken = "mock-fcm-token-456"
        let testUserId = "user-123"
        
        mockFirestore.updateDocumentResult = (true, nil)
        
        notificationService.storeFCMToken(testToken, forUser: testUserId) { success, error in
            XCTAssertTrue(success)
            XCTAssertNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
        XCTAssertTrue(mockFirestore.updateDocumentCalled)
        XCTAssertEqual(mockFirestore.lastUpdateCollection, "users")
        XCTAssertEqual(mockFirestore.lastUpdateDocumentId, testUserId)
        XCTAssertEqual(mockFirestore.lastUpdateData?["fcmToken"] as? String, testToken)
    }
    
    func testStoreFCMToken_Error() {
        let expectation = XCTestExpectation(description: "FCM token storage error")
        let testError = NSError(domain: "FirestoreError", code: 1, userInfo: nil)
        
        mockFirestore.updateDocumentResult = (false, testError)
        
        notificationService.storeFCMToken("token", forUser: "user") { success, error in
            XCTAssertFalse(success)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testHandleFCMTokenRefresh() {
        let newToken = "new-fcm-token-789"
        let testUserId = "user-123"
        
        // Mock authentication to return user ID
        notificationService.currentUserId = testUserId
        mockFirestore.updateDocumentResult = (true, nil)
        
        notificationService.handleFCMTokenRefresh(newToken)
        
        // Should attempt to store the new token
        XCTAssertTrue(mockFirestore.updateDocumentCalled)
        XCTAssertEqual(mockFirestore.lastUpdateData?["fcmToken"] as? String, newToken)
    }
    
    // MARK: - Notification Handling Tests
    
    func testHandleForegroundNotification_CallType() {
        let userInfo: [AnyHashable: Any] = [
            "callId": "call-123",
            "phoneNumber": "+1234567890",
            "callerName": "John Doe",
            "urgency": "medium",
            "type": "call_screened"
        ]
        
        let result = notificationService.handleForegroundNotification(userInfo: userInfo)
        
        XCTAssertEqual(result, .banner)
        // Should schedule local notification for foreground display
    }
    
    func testHandleForegroundNotification_UrgentCall() {
        let userInfo: [AnyHashable: Any] = [
            "callId": "urgent-call-456",
            "phoneNumber": "+1234567890",
            "callerName": "Emergency Contact",
            "urgency": "high",
            "type": "call_urgent"
        ]
        
        let result = notificationService.handleForegroundNotification(userInfo: userInfo)
        
        XCTAssertEqual(result, .banner)
        // Should use urgent notification sound and priority
    }
    
    func testHandleBackgroundNotification() {
        let userInfo: [AnyHashable: Any] = [
            "callId": "call-789",
            "phoneNumber": "+1111111111",
            "type": "call_screened"
        ]
        
        let expectation = XCTestExpectation(description: "Background notification handled")
        
        notificationService.handleBackgroundNotification(userInfo: userInfo) { result in
            XCTAssertEqual(result, .newData)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testHandleNotificationTap_CallType() {
        let userInfo: [AnyHashable: Any] = [
            "callId": "call-123",
            "phoneNumber": "+1234567890",
            "type": "call_screened"
        ]
        
        let result = notificationService.handleNotificationTap(userInfo: userInfo)
        
        XCTAssertTrue(result)
        // Should navigate to call details view
        XCTAssertEqual(notificationService.lastNavigationDestination, .callDetails("call-123"))
    }
    
    func testHandleNotificationTap_InvalidData() {
        let userInfo: [AnyHashable: Any] = [
            "invalid": "data"
        ]
        
        let result = notificationService.handleNotificationTap(userInfo: userInfo)
        
        XCTAssertFalse(result)
        XCTAssertNil(notificationService.lastNavigationDestination)
    }
    
    // MARK: - Local Notification Tests
    
    func testScheduleLocalNotification_CallReceived() {
        let callData: [String: Any] = [
            "callId": "call-123",
            "phoneNumber": "+1234567890",
            "callerName": "John Doe",
            "summary": "John called about work"
        ]
        
        notificationService.scheduleLocalNotification(
            title: "Call Screened from +1234567890",
            body: "John called about work",
            userInfo: callData,
            categoryId: "CALL_CATEGORY"
        )
        
        XCTAssertTrue(mockUserNotificationCenter.addNotificationRequestCalled)
        XCTAssertEqual(mockUserNotificationCenter.lastNotificationRequest?.content.title, "Call Screened from +1234567890")
        XCTAssertEqual(mockUserNotificationCenter.lastNotificationRequest?.content.body, "John called about work")
        XCTAssertEqual(mockUserNotificationCenter.lastNotificationRequest?.content.categoryIdentifier, "CALL_CATEGORY")
    }
    
    func testScheduleLocalNotification_UrgentCall() {
        let callData: [String: Any] = [
            "callId": "urgent-call-456",
            "phoneNumber": "+1234567890",
            "urgency": "high"
        ]
        
        notificationService.scheduleLocalNotification(
            title: "🚨 Urgent Call from +1234567890",
            body: "Important call requiring attention",
            userInfo: callData,
            categoryId: "URGENT_CALL_CATEGORY",
            soundName: "urgent_notification.wav"
        )
        
        XCTAssertTrue(mockUserNotificationCenter.addNotificationRequestCalled)
        let content = mockUserNotificationCenter.lastNotificationRequest?.content
        XCTAssertEqual(content?.title, "🚨 Urgent Call from +1234567890")
        XCTAssertEqual(content?.categoryIdentifier, "URGENT_CALL_CATEGORY")
        XCTAssertEqual(content?.sound?.name, "urgent_notification.wav")
    }
    
    // MARK: - Badge Management Tests
    
    func testUpdateBadgeCount() {
        notificationService.updateBadgeCount(5)
        
        XCTAssertEqual(UIApplication.shared.applicationIconBadgeNumber, 5)
    }
    
    func testClearBadgeCount() {
        notificationService.clearBadgeCount()
        
        XCTAssertEqual(UIApplication.shared.applicationIconBadgeNumber, 0)
    }
    
    func testIncrementBadgeCount() {
        UIApplication.shared.applicationIconBadgeNumber = 3
        
        notificationService.incrementBadgeCount()
        
        XCTAssertEqual(UIApplication.shared.applicationIconBadgeNumber, 4)
    }
    
    // MARK: - Notification Settings Tests
    
    func testGetNotificationSettings() {
        let expectation = XCTestExpectation(description: "Settings retrieved")
        
        let mockSettings = MockUNNotificationSettings()
        mockSettings.authorizationStatus = .authorized
        mockSettings.alertSetting = .enabled
        mockSettings.soundSetting = .enabled
        mockSettings.badgeSetting = .enabled
        
        mockUserNotificationCenter.mockSettings = mockSettings
        
        notificationService.getNotificationSettings { settings in
            XCTAssertEqual(settings.authorizationStatus, .authorized)
            XCTAssertEqual(settings.alertSetting, .enabled)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - Cleanup Tests
    
    func testRemoveDeliveredNotifications() {
        let notificationIds = ["call-123", "call-456"]
        
        notificationService.removeDeliveredNotifications(withIds: notificationIds)
        
        XCTAssertTrue(mockUserNotificationCenter.removeDeliveredNotificationsCalled)
        XCTAssertEqual(mockUserNotificationCenter.lastRemovedNotificationIds, notificationIds)
    }
    
    func testRemoveAllDeliveredNotifications() {
        notificationService.removeAllDeliveredNotifications()
        
        XCTAssertTrue(mockUserNotificationCenter.removeAllDeliveredNotificationsCalled)
    }
    
    func testRemovePendingNotifications() {
        let notificationIds = ["pending-123", "pending-456"]
        
        notificationService.removePendingNotifications(withIds: notificationIds)
        
        XCTAssertTrue(mockUserNotificationCenter.removePendingNotificationsCalled)
        XCTAssertEqual(mockUserNotificationCenter.lastRemovedPendingIds, notificationIds)
    }
}

// MARK: - Mock Classes

class MockUNUserNotificationCenter: NSObject {
    var requestAuthorizationCalled = false
    var requestAuthorizationResult: (Bool, Error?) = (true, nil)
    
    var setCategoriesCalled = false
    var lastSetCategories: Set<UNNotificationCategory>?
    
    var addNotificationRequestCalled = false
    var lastNotificationRequest: UNNotificationRequest?
    
    var removeDeliveredNotificationsCalled = false
    var lastRemovedNotificationIds: [String]?
    
    var removeAllDeliveredNotificationsCalled = false
    
    var removePendingNotificationsCalled = false
    var lastRemovedPendingIds: [String]?
    
    var mockSettings: UNNotificationSettings?
    
    func requestAuthorization(options: UNAuthorizationOptions, completionHandler: @escaping (Bool, Error?) -> Void) {
        requestAuthorizationCalled = true
        completionHandler(requestAuthorizationResult.0, requestAuthorizationResult.1)
    }
    
    func setNotificationCategories(_ categories: Set<UNNotificationCategory>) {
        setCategoriesCalled = true
        lastSetCategories = categories
    }
    
    func add(_ request: UNNotificationRequest, withCompletionHandler completionHandler: ((Error?) -> Void)?) {
        addNotificationRequestCalled = true
        lastNotificationRequest = request
        completionHandler?(nil)
    }
    
    func removeDeliveredNotifications(withIdentifiers identifiers: [String]) {
        removeDeliveredNotificationsCalled = true
        lastRemovedNotificationIds = identifiers
    }
    
    func removeAllDeliveredNotifications() {
        removeAllDeliveredNotificationsCalled = true
    }
    
    func removePendingNotificationRequests(withIdentifiers identifiers: [String]) {
        removePendingNotificationsCalled = true
        lastRemovedPendingIds = identifiers
    }
    
    func getNotificationSettings(completionHandler: @escaping (UNNotificationSettings) -> Void) {
        completionHandler(mockSettings ?? UNNotificationSettings())
    }
}

class MockMessaging: NSObject {
    var tokenCalled = false
    var mockToken: String?
    var mockTokenError: Error?
    
    func token(completion: @escaping (String?, Error?) -> Void) {
        tokenCalled = true
        completion(mockToken, mockTokenError)
    }
}

class MockFirestore: NSObject {
    var updateDocumentCalled = false
    var updateDocumentResult: (Bool, Error?) = (true, nil)
    
    var lastUpdateCollection: String?
    var lastUpdateDocumentId: String?
    var lastUpdateData: [String: Any]?
    
    func updateDocument(collection: String, documentId: String, data: [String: Any], completion: @escaping (Bool, Error?) -> Void) {
        updateDocumentCalled = true
        lastUpdateCollection = collection
        lastUpdateDocumentId = documentId
        lastUpdateData = data
        completion(updateDocumentResult.0, updateDocumentResult.1)
    }
}

class MockUNNotificationSettings: UNNotificationSettings {
    override var authorizationStatus: UNAuthorizationStatus { .authorized }
    override var alertSetting: UNNotificationSetting { .enabled }
    override var soundSetting: UNNotificationSetting { .enabled }
    override var badgeSetting: UNNotificationSetting { .enabled }
}