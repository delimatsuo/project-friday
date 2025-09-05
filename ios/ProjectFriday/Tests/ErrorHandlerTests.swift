import XCTest
import Network
@testable import ProjectFriday

/**
 * Error Handler Tests
 * Comprehensive test suite for iOS error handling, network resilience, and user experience
 */
class ErrorHandlerTests: XCTestCase {
    
    var errorHandler: ErrorHandler!
    var mockNetworkMonitor: MockNetworkMonitor!
    var mockUserDefaults: MockUserDefaults!
    
    override func setUp() {
        super.setUp()
        mockNetworkMonitor = MockNetworkMonitor()
        mockUserDefaults = MockUserDefaults()
        errorHandler = ErrorHandler(
            networkMonitor: mockNetworkMonitor,
            userDefaults: mockUserDefaults
        )
    }
    
    override func tearDown() {
        errorHandler = nil
        mockNetworkMonitor = nil
        mockUserDefaults = nil
        super.tearDown()
    }
    
    // MARK: - Error Classification Tests
    
    func testNetworkErrorClassification() {
        let networkError = URLError(.notConnectedToInternet)
        let classification = errorHandler.classifyError(networkError)
        
        XCTAssertEqual(classification.category, .network)
        XCTAssertEqual(classification.severity, .high)
        XCTAssertTrue(classification.isRetryable)
        XCTAssertGreaterThan(classification.suggestedRetryDelay, 0)
    }
    
    func testFirebaseErrorClassification() {
        let firebaseError = createMockFirebaseError(code: .networkError)
        let classification = errorHandler.classifyError(firebaseError)
        
        XCTAssertEqual(classification.category, .firebase)
        XCTAssertEqual(classification.severity, .medium)
        XCTAssertTrue(classification.isRetryable)
    }
    
    func testValidationErrorClassification() {
        let validationError = ValidationError.invalidEmail
        let classification = errorHandler.classifyError(validationError)
        
        XCTAssertEqual(classification.category, .validation)
        XCTAssertEqual(classification.severity, .low)
        XCTAssertFalse(classification.isRetryable)
        XCTAssertNotNil(classification.userMessage)
    }
    
    func testAuthenticationErrorClassification() {
        let authError = createMockFirebaseError(code: .userNotFound)
        let classification = errorHandler.classifyError(authError)
        
        XCTAssertEqual(classification.category, .authentication)
        XCTAssertEqual(classification.severity, .medium)
        XCTAssertFalse(classification.isRetryable)
    }
    
    // MARK: - Retry Logic Tests
    
    func testAutomaticRetryWithExponentialBackoff() async {
        let expectation = self.expectation(description: "Retry operation completes")
        var attemptCount = 0
        let maxRetries = 3
        
        let operation: () async throws -> String = {
            attemptCount += 1
            if attemptCount <= 2 {
                throw URLError(.networkConnectionLost)
            }
            return "Success"
        }
        
        do {
            let result = try await errorHandler.executeWithRetry(
                operation: operation,
                maxRetries: maxRetries,
                baseDelay: 0.1
            )
            
            XCTAssertEqual(result, "Success")
            XCTAssertEqual(attemptCount, 3)
            expectation.fulfill()
        } catch {
            XCTFail("Operation should have succeeded after retries: \(error)")
            expectation.fulfill()
        }
        
        await fulfillment(of: [expectation], timeout: 5.0)
    }
    
    func testRetryFailsAfterMaxAttempts() async {
        let expectation = self.expectation(description: "Retry operation fails")
        var attemptCount = 0
        
        let operation: () async throws -> String = {
            attemptCount += 1
            throw URLError(.networkConnectionLost)
        }
        
        do {
            _ = try await errorHandler.executeWithRetry(
                operation: operation,
                maxRetries: 2,
                baseDelay: 0.01
            )
            XCTFail("Operation should have failed after max retries")
        } catch {
            XCTAssertEqual(attemptCount, 3) // Initial attempt + 2 retries
            XCTAssertTrue(error is URLError)
            expectation.fulfill()
        }
        
        await fulfillment(of: [expectation], timeout: 2.0)
    }
    
    func testNonRetryableErrorDoesNotRetry() async {
        let expectation = self.expectation(description: "Non-retryable error fails immediately")
        var attemptCount = 0
        
        let operation: () async throws -> String = {
            attemptCount += 1
            throw ValidationError.invalidEmail
        }
        
        do {
            _ = try await errorHandler.executeWithRetry(operation: operation)
            XCTFail("Operation should have failed immediately")
        } catch {
            XCTAssertEqual(attemptCount, 1)
            XCTAssertTrue(error is ValidationError)
            expectation.fulfill()
        }
        
        await fulfillment(of: [expectation], timeout: 1.0)
    }
    
    // MARK: - Network Connectivity Tests
    
    func testNetworkStatusDetection() {
        mockNetworkMonitor.isConnected = false
        XCTAssertFalse(errorHandler.isNetworkAvailable)
        
        mockNetworkMonitor.isConnected = true
        XCTAssertTrue(errorHandler.isNetworkAvailable)
    }
    
    func testOfflineModeHandling() {
        mockNetworkMonitor.isConnected = false
        errorHandler.handleNetworkStatusChange(isConnected: false)
        
        XCTAssertTrue(errorHandler.isInOfflineMode)
        
        // Verify offline data is available
        let cachedData = errorHandler.getCachedData(for: "test_key")
        XCTAssertNotNil(cachedData)
    }
    
    func testOnlineReconnectionHandling() {
        // Start offline
        mockNetworkMonitor.isConnected = false
        errorHandler.handleNetworkStatusChange(isConnected: false)
        XCTAssertTrue(errorHandler.isInOfflineMode)
        
        // Reconnect
        mockNetworkMonitor.isConnected = true
        errorHandler.handleNetworkStatusChange(isConnected: true)
        
        XCTAssertFalse(errorHandler.isInOfflineMode)
        XCTAssertTrue(errorHandler.hasPendingSyncOperations)
    }
    
    func testOfflineDataCaching() {
        let testData = ["key": "value"]
        
        errorHandler.cacheDataForOfflineUse(data: testData, key: "test_data")
        
        let retrievedData = errorHandler.getCachedData(for: "test_data") as? [String: String]
        XCTAssertEqual(retrievedData, testData)
    }
    
    // MARK: - Circuit Breaker Tests
    
    func testCircuitBreakerOpensAfterFailures() async {
        let serviceName = "test_service"
        let failureThreshold = 3
        
        // Trigger failures to open circuit
        for _ in 0..<failureThreshold {
            errorHandler.recordServiceFailure(serviceName: serviceName)
        }
        
        let circuitState = errorHandler.getCircuitBreakerState(for: serviceName)
        XCTAssertEqual(circuitState, .open)
    }
    
    func testCircuitBreakerRejectsRequestsWhenOpen() async {
        let serviceName = "test_service"
        
        // Force circuit to open state
        errorHandler.setCircuitBreakerState(serviceName: serviceName, state: .open)
        
        let operation: () async throws -> String = {
            return "Should not execute"
        }
        
        do {
            _ = try await errorHandler.executeWithCircuitBreaker(
                serviceName: serviceName,
                operation: operation
            )
            XCTFail("Circuit breaker should have rejected the request")
        } catch let error as ErrorHandler.CircuitBreakerError {
            XCTAssertEqual(error.reason, .circuitOpen)
        } catch {
            XCTFail("Expected CircuitBreakerError but got: \(error)")
        }
    }
    
    func testCircuitBreakerHalfOpenTransition() async {
        let serviceName = "test_service"
        
        // Set circuit to half-open
        errorHandler.setCircuitBreakerState(serviceName: serviceName, state: .halfOpen)
        
        let successfulOperation: () async throws -> String = {
            return "Success"
        }
        
        do {
            let result = try await errorHandler.executeWithCircuitBreaker(
                serviceName: serviceName,
                operation: successfulOperation
            )
            
            XCTAssertEqual(result, "Success")
            
            // Circuit should close after successful operation
            let circuitState = errorHandler.getCircuitBreakerState(for: serviceName)
            XCTAssertEqual(circuitState, .closed)
        } catch {
            XCTFail("Operation should have succeeded: \(error)")
        }
    }
    
    // MARK: - User Experience Tests
    
    func testUserFriendlyErrorMessages() {
        let networkError = URLError(.notConnectedToInternet)
        let userMessage = errorHandler.getUserFriendlyMessage(for: networkError)
        
        XCTAssertFalse(userMessage.isEmpty)
        XCTAssertFalse(userMessage.contains("URLError"))
        XCTAssertTrue(userMessage.contains("network") || userMessage.contains("connection"))
    }
    
    func testErrorRecoverySuggestions() {
        let networkError = URLError(.notConnectedToInternet)
        let suggestions = errorHandler.getRecoverySuggestions(for: networkError)
        
        XCTAssertFalse(suggestions.isEmpty)
        XCTAssertTrue(suggestions.contains { $0.lowercased().contains("wifi") || $0.lowercased().contains("cellular") })
    }
    
    func testErrorSeverityDetermination() {
        let criticalError = URLError(.cannotConnectToHost)
        let mediumError = URLError(.timedOut)
        let lowError = ValidationError.invalidEmail
        
        XCTAssertEqual(errorHandler.classifyError(criticalError).severity, .high)
        XCTAssertEqual(errorHandler.classifyError(mediumError).severity, .medium)
        XCTAssertEqual(errorHandler.classifyError(lowError).severity, .low)
    }
    
    // MARK: - Error Tracking and Analytics Tests
    
    func testErrorMetricsTracking() {
        let networkError = URLError(.networkConnectionLost)
        let firebaseError = createMockFirebaseError(code: .networkError)
        
        errorHandler.trackError(networkError, context: ["screen": "call_log"])
        errorHandler.trackError(firebaseError, context: ["operation": "fetch_calls"])
        
        let metrics = errorHandler.getErrorMetrics()
        
        XCTAssertEqual(metrics.totalErrors, 2)
        XCTAssertEqual(metrics.errorsByCategory[.network], 1)
        XCTAssertEqual(metrics.errorsByCategory[.firebase], 1)
    }
    
    func testErrorRateCalculation() {
        // Track successful operations
        for _ in 0..<8 {
            errorHandler.trackSuccess(context: ["operation": "test"])
        }
        
        // Track some errors
        for _ in 0..<2 {
            let error = URLError(.networkConnectionLost)
            errorHandler.trackError(error, context: ["operation": "test"])
        }
        
        let errorRate = errorHandler.getErrorRate()
        XCTAssertEqual(errorRate, 0.2, accuracy: 0.01) // 20% error rate
    }
    
    func testErrorTrendAnalysis() {
        // Simulate errors over time
        let now = Date()
        let oneHourAgo = now.addingTimeInterval(-3600)
        
        // Add errors at different times
        errorHandler.trackError(
            URLError(.networkConnectionLost),
            context: ["timestamp": oneHourAgo]
        )
        errorHandler.trackError(
            URLError(.networkConnectionLost),
            context: ["timestamp": now]
        )
        
        let trend = errorHandler.getErrorTrend(timeWindow: 3600) // 1 hour
        XCTAssertEqual(trend.errorsInWindow, 2)
        XCTAssertGreaterThan(trend.averageErrorsPerHour, 0)
    }
    
    // MARK: - State Restoration Tests
    
    func testErrorStateRestoration() {
        // Simulate app going to background with pending errors
        let pendingError = URLError(.networkConnectionLost)
        errorHandler.trackError(pendingError, context: ["pending": true])
        
        // Save state
        errorHandler.saveState()
        
        // Create new error handler instance (simulating app restart)
        let newErrorHandler = ErrorHandler(
            networkMonitor: mockNetworkMonitor,
            userDefaults: mockUserDefaults
        )
        newErrorHandler.restoreState()
        
        // Verify state was restored
        let metrics = newErrorHandler.getErrorMetrics()
        XCTAssertGreaterThan(metrics.totalErrors, 0)
    }
    
    func testGracefulDegradation() {
        // Simulate multiple service failures
        errorHandler.recordServiceFailure(serviceName: "firebase")
        errorHandler.recordServiceFailure(serviceName: "api")
        errorHandler.recordServiceFailure(serviceName: "cache")
        
        let degradationStrategy = errorHandler.getDegradationStrategy()
        
        XCTAssertTrue(degradationStrategy.useOfflineMode)
        XCTAssertTrue(degradationStrategy.limitFeatures)
        XCTAssertFalse(degradationStrategy.allowWriteOperations)
    }
    
    // MARK: - Helper Methods
    
    private func createMockFirebaseError(code: MockFirebaseErrorCode) -> NSError {
        return NSError(
            domain: "FIRAuthErrorDomain",
            code: code.rawValue,
            userInfo: [NSLocalizedDescriptionKey: "Mock Firebase Error"]
        )
    }
}

// MARK: - Mock Objects

class MockNetworkMonitor: NetworkMonitoring {
    var isConnected: Bool = true
    var connectionType: ConnectionType = .wifi
    var statusUpdateHandler: ((Bool) -> Void)?
    
    func startMonitoring() {
        // Mock implementation
    }
    
    func stopMonitoring() {
        // Mock implementation
    }
    
    func simulateConnectionChange(isConnected: Bool) {
        self.isConnected = isConnected
        statusUpdateHandler?(isConnected)
    }
}

class MockUserDefaults: UserDefaults {
    private var storage: [String: Any] = [:]
    
    override func object(forKey defaultName: String) -> Any? {
        return storage[defaultName]
    }
    
    override func set(_ value: Any?, forKey defaultName: String) {
        storage[defaultName] = value
    }
    
    override func removeObject(forKey defaultName: String) {
        storage.removeValue(forKey: defaultName)
    }
}

enum MockFirebaseErrorCode: Int {
    case networkError = 17020
    case userNotFound = 17011
    case wrongPassword = 17009
    case emailAlreadyInUse = 17007
}

// MARK: - Test Error Types

enum ValidationError: LocalizedError {
    case invalidEmail
    case weakPassword
    case missingField(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidEmail:
            return "Please enter a valid email address"
        case .weakPassword:
            return "Password must be at least 8 characters long"
        case .missingField(let field):
            return "\(field) is required"
        }
    }
}