import XCTest
import Firebase
@testable import ProjectFriday

final class CallLogTests: XCTestCase {
    
    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }
    
    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }
    
    // MARK: - CallLog Model Tests
    
    func testCallLogInitialization() throws {
        // Given
        let id = "test-call-id"
        let userId = "test-user-id"
        let callerId = "+1234567890"
        let callerName = "John Doe"
        let timestamp = Date()
        let duration = 120
        let transcript = "Hello, this is John calling about..."
        let aiSummary = "John called about a business inquiry"
        let audioUrl = "https://example.com/audio.mp3"
        
        // When
        let callLog = CallLog(
            id: id,
            userId: userId,
            callerId: callerId,
            callerName: callerName,
            timestamp: timestamp,
            duration: duration,
            fullTranscript: transcript,
            aiSummary: aiSummary,
            audioRecordingUrl: audioUrl,
            isRead: false
        )
        
        // Then
        XCTAssertEqual(callLog.id, id)
        XCTAssertEqual(callLog.userId, userId)
        XCTAssertEqual(callLog.callerId, callerId)
        XCTAssertEqual(callLog.callerName, callerName)
        XCTAssertEqual(callLog.timestamp, timestamp)
        XCTAssertEqual(callLog.duration, duration)
        XCTAssertEqual(callLog.fullTranscript, transcript)
        XCTAssertEqual(callLog.aiSummary, aiSummary)
        XCTAssertEqual(callLog.audioRecordingUrl, audioUrl)
        XCTAssertFalse(callLog.isRead)
    }
    
    func testCallLogFirestoreEncoding() throws {
        // Given
        let callLog = createTestCallLog()
        
        // When
        let encoder = JSONEncoder()
        let data = try encoder.encode(callLog)
        
        // Then
        XCTAssertNotNil(data)
        XCTAssertGreaterThan(data.count, 0)
    }
    
    func testCallLogFirestoreDecoding() throws {
        // Given
        let originalCallLog = createTestCallLog()
        let encoder = JSONEncoder()
        let data = try encoder.encode(originalCallLog)
        
        // When
        let decoder = JSONDecoder()
        let decodedCallLog = try decoder.decode(CallLog.self, from: data)
        
        // Then
        XCTAssertEqual(decodedCallLog.id, originalCallLog.id)
        XCTAssertEqual(decodedCallLog.userId, originalCallLog.userId)
        XCTAssertEqual(decodedCallLog.callerId, originalCallLog.callerId)
        XCTAssertEqual(decodedCallLog.callerName, originalCallLog.callerName)
        XCTAssertEqual(decodedCallLog.duration, originalCallLog.duration)
        XCTAssertEqual(decodedCallLog.fullTranscript, originalCallLog.fullTranscript)
        XCTAssertEqual(decodedCallLog.aiSummary, originalCallLog.aiSummary)
        XCTAssertEqual(decodedCallLog.audioRecordingUrl, originalCallLog.audioRecordingUrl)
        XCTAssertEqual(decodedCallLog.isRead, originalCallLog.isRead)
    }
    
    func testCallLogFirestoreDictionaryConversion() throws {
        // Given
        let callLog = createTestCallLog()
        
        // When
        let dictionary = callLog.toDictionary()
        
        // Then
        XCTAssertEqual(dictionary["id"] as? String, callLog.id)
        XCTAssertEqual(dictionary["userId"] as? String, callLog.userId)
        XCTAssertEqual(dictionary["callerId"] as? String, callLog.callerId)
        XCTAssertEqual(dictionary["callerName"] as? String, callLog.callerName)
        XCTAssertEqual(dictionary["duration"] as? Int, callLog.duration)
        XCTAssertEqual(dictionary["fullTranscript"] as? String, callLog.fullTranscript)
        XCTAssertEqual(dictionary["aiSummary"] as? String, callLog.aiSummary)
        XCTAssertEqual(dictionary["audioRecordingUrl"] as? String, callLog.audioRecordingUrl)
        XCTAssertEqual(dictionary["isRead"] as? Bool, callLog.isRead)
        XCTAssertNotNil(dictionary["timestamp"])
    }
    
    func testCallLogFromFirestoreDictionary() throws {
        // Given
        let dictionary: [String: Any] = [
            "id": "test-id",
            "userId": "test-user",
            "callerId": "+1234567890",
            "callerName": "Test Caller",
            "timestamp": Timestamp(date: Date()),
            "duration": 60,
            "fullTranscript": "Test transcript",
            "aiSummary": "Test summary",
            "audioRecordingUrl": "https://example.com/test.mp3",
            "isRead": false
        ]
        
        // When
        let callLog = try CallLog.fromDictionary(dictionary)
        
        // Then
        XCTAssertEqual(callLog.id, "test-id")
        XCTAssertEqual(callLog.userId, "test-user")
        XCTAssertEqual(callLog.callerId, "+1234567890")
        XCTAssertEqual(callLog.callerName, "Test Caller")
        XCTAssertEqual(callLog.duration, 60)
        XCTAssertEqual(callLog.fullTranscript, "Test transcript")
        XCTAssertEqual(callLog.aiSummary, "Test summary")
        XCTAssertEqual(callLog.audioRecordingUrl, "https://example.com/test.mp3")
        XCTAssertFalse(callLog.isRead)
    }
    
    func testCallLogDisplayFormats() throws {
        // Given
        let callLog = createTestCallLog()
        
        // When & Then
        XCTAssertFalse(callLog.formattedCallerId.isEmpty)
        XCTAssertFalse(callLog.displayName.isEmpty)
        XCTAssertFalse(callLog.formattedDuration.isEmpty)
        XCTAssertFalse(callLog.relativeTimeString.isEmpty)
    }
    
    func testCallLogMarkAsRead() throws {
        // Given
        var callLog = createTestCallLog()
        XCTAssertFalse(callLog.isRead)
        
        // When
        callLog.markAsRead()
        
        // Then
        XCTAssertTrue(callLog.isRead)
    }
    
    // MARK: - Helper Methods
    
    private func createTestCallLog() -> CallLog {
        return CallLog(
            id: "test-call-123",
            userId: "test-user-456",
            callerId: "+1234567890",
            callerName: "John Doe",
            timestamp: Date(),
            duration: 120,
            fullTranscript: "Hello, this is John calling about the project. I wanted to discuss the timeline and budget requirements.",
            aiSummary: "John called to discuss project timeline and budget",
            audioRecordingUrl: "https://example.com/recordings/test-call-123.mp3",
            isRead: false
        )
    }
}

// MARK: - CallLogService Tests

final class CallLogServiceTests: XCTestCase {
    
    var mockFirestore: MockFirestore!
    var callLogService: CallLogService!
    
    override func setUpWithError() throws {
        mockFirestore = MockFirestore()
        callLogService = CallLogService()
    }
    
    override func tearDownWithError() throws {
        mockFirestore = nil
        callLogService = nil
    }
    
    func testFetchCallLogsForUser() async throws {
        // Given
        let userId = "test-user-123"
        let expectedCallLogs = [createTestCallLog()]
        
        // When
        let callLogs = try await callLogService.fetchCallLogs(for: userId)
        
        // Then - This will be implemented after we create the service
        XCTAssertNotNil(callLogs)
    }
    
    func testRealTimeListener() async throws {
        // Given
        let userId = "test-user-123"
        let expectation = XCTestExpectation(description: "Real-time updates received")
        
        // When
        let listener = callLogService.addRealTimeListener(for: userId) { callLogs, error in
            XCTAssertNil(error)
            XCTAssertNotNil(callLogs)
            expectation.fulfill()
        }
        
        // Then
        await fulfillment(of: [expectation], timeout: 5.0)
        callLogService.removeListener(listener)
    }
    
    func testMarkCallLogAsRead() async throws {
        // Given
        let callLogId = "test-call-123"
        let userId = "test-user-456"
        
        // When & Then
        try await callLogService.markAsRead(callLogId: callLogId, userId: userId)
        // Assert the call was made correctly - implementation will follow
    }
    
    func testDeleteCallLog() async throws {
        // Given
        let callLogId = "test-call-123"
        let userId = "test-user-456"
        
        // When & Then
        try await callLogService.deleteCallLog(callLogId: callLogId, userId: userId)
        // Assert the deletion was successful - implementation will follow
    }
}

// MARK: - CallLogViewModel Tests

final class CallLogViewModelTests: XCTestCase {
    
    var viewModel: CallLogViewModel!
    var mockService: MockCallLogService!
    
    override func setUpWithError() throws {
        mockService = MockCallLogService()
        viewModel = CallLogViewModel(service: mockService)
    }
    
    override func tearDownWithError() throws {
        viewModel = nil
        mockService = nil
    }
    
    func testInitialState() throws {
        // Then
        XCTAssertEqual(viewModel.callLogs.count, 0)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
        XCTAssertEqual(viewModel.searchText, "")
    }
    
    func testFetchCallLogs() async throws {
        // Given
        let userId = "test-user-123"
        mockService.mockCallLogs = [createTestCallLog()]
        
        // When
        await viewModel.fetchCallLogs(for: userId)
        
        // Then
        XCTAssertEqual(viewModel.callLogs.count, 1)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
    }
    
    func testSearchFiltering() throws {
        // Given
        let callLog1 = createTestCallLog(callerId: "+1234567890", callerName: "John Doe")
        let callLog2 = createTestCallLog(callerId: "+0987654321", callerName: "Jane Smith")
        viewModel.callLogs = [callLog1, callLog2]
        
        // When
        viewModel.searchText = "John"
        
        // Then
        XCTAssertEqual(viewModel.filteredCallLogs.count, 1)
        XCTAssertEqual(viewModel.filteredCallLogs.first?.callerName, "John Doe")
    }
    
    func testErrorHandling() async throws {
        // Given
        let userId = "test-user-123"
        mockService.shouldThrowError = true
        
        // When
        await viewModel.fetchCallLogs(for: userId)
        
        // Then
        XCTAssertTrue(viewModel.callLogs.isEmpty)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNotNil(viewModel.error)
    }
    
    private func createTestCallLog(callerId: String = "+1234567890", callerName: String = "Test Caller") -> CallLog {
        return CallLog(
            id: UUID().uuidString,
            userId: "test-user",
            callerId: callerId,
            callerName: callerName,
            timestamp: Date(),
            duration: 60,
            fullTranscript: "Test transcript",
            aiSummary: "Test summary",
            audioRecordingUrl: "https://example.com/test.mp3",
            isRead: false
        )
    }
}

// MARK: - Mock Classes

class MockFirestore {
    // Mock implementation for testing
}

class MockCallLogService {
    var mockCallLogs: [CallLog] = []
    var shouldThrowError = false
    
    func fetchCallLogs(for userId: String) async throws -> [CallLog] {
        if shouldThrowError {
            throw NSError(domain: "Test", code: 1, userInfo: nil)
        }
        return mockCallLogs
    }
}