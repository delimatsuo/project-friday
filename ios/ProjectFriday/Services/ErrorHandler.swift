import Foundation
import Network
import FirebaseAuth
import FirebaseFirestore
import os

/**
 * ErrorHandler Service
 * Comprehensive error handling with network resilience, automatic retry, and user experience optimization
 */
class ErrorHandler: ObservableObject {
    
    // MARK: - Properties
    
    private let logger = Logger(subsystem: "com.projectfriday.ios", category: "ErrorHandler")
    private let networkMonitor: NetworkMonitoring
    private let userDefaults: UserDefaults
    
    @Published var isInOfflineMode: Bool = false
    @Published var hasPendingSyncOperations: Bool = false
    @Published var currentNetworkStatus: NetworkStatus = .unknown
    
    // Circuit breaker states
    private var circuitBreakers: [String: CircuitBreakerState] = [:]
    
    // Error metrics
    private var errorMetrics: ErrorMetrics = ErrorMetrics()
    private let metricsLock = NSLock()
    
    // Configuration
    private let config: ErrorHandlerConfig
    
    // Cached data for offline mode
    private var offlineCache: [String: Any] = [:]
    private let cacheKey = "ErrorHandler.OfflineCache"
    
    // MARK: - Initialization
    
    init(networkMonitor: NetworkMonitoring = NetworkMonitor.shared,
         userDefaults: UserDefaults = .standard,
         config: ErrorHandlerConfig = .default) {
        self.networkMonitor = networkMonitor
        self.userDefaults = userDefaults
        self.config = config
        
        setupNetworkMonitoring()
        restoreState()
    }
    
    // MARK: - Network Monitoring
    
    private func setupNetworkMonitoring() {
        networkMonitor.statusUpdateHandler = { [weak self] isConnected in
            DispatchQueue.main.async {
                self?.handleNetworkStatusChange(isConnected: isConnected)
            }
        }
        networkMonitor.startMonitoring()
    }
    
    func handleNetworkStatusChange(isConnected: Bool) {
        let previousStatus = currentNetworkStatus
        currentNetworkStatus = isConnected ? .connected : .disconnected
        
        if previousStatus == .disconnected && isConnected {
            // Reconnected - process pending operations
            handleReconnection()
        } else if !isConnected {
            // Lost connection - enter offline mode
            enterOfflineMode()
        }
        
        isInOfflineMode = !isConnected
        
        logger.info("Network status changed: \(isConnected ? "connected" : "disconnected")")
    }
    
    var isNetworkAvailable: Bool {
        return networkMonitor.isConnected
    }
    
    // MARK: - Error Classification
    
    func classifyError(_ error: Error) -> ErrorClassification {
        let classification = ErrorClassification()
        
        // Network errors
        if let urlError = error as? URLError {
            return classifyURLError(urlError)
        }
        
        // Firebase errors
        if let nsError = error as NSError,
           nsError.domain == AuthErrorDomain || nsError.domain.contains("Firebase") {
            return classifyFirebaseError(nsError)
        }
        
        // Custom validation errors
        if error is ValidationError {
            classification.category = .validation
            classification.severity = .low
            classification.isRetryable = false
            classification.userMessage = error.localizedDescription
            return classification
        }
        
        // Default classification
        classification.category = .unknown
        classification.severity = .medium
        classification.isRetryable = false
        classification.userMessage = "An unexpected error occurred. Please try again."
        classification.suggestedRetryDelay = config.baseRetryDelay
        
        return classification
    }
    
    private func classifyURLError(_ urlError: URLError) -> ErrorClassification {
        let classification = ErrorClassification()
        classification.category = .network
        
        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost:
            classification.severity = .high
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.networkRetryDelay
            classification.userMessage = "No internet connection. Please check your network settings."
            classification.recoverySuggestions = [
                "Check your WiFi connection",
                "Try switching to cellular data",
                "Move to an area with better signal"
            ]
            
        case .timedOut:
            classification.severity = .medium
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.baseRetryDelay
            classification.userMessage = "The request timed out. Please try again."
            classification.recoverySuggestions = [
                "Try again in a moment",
                "Check your internet connection"
            ]
            
        case .cannotConnectToHost, .cannotFindHost:
            classification.severity = .high
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.networkRetryDelay * 2
            classification.userMessage = "Cannot connect to server. Please try again later."
            classification.recoverySuggestions = [
                "Try again in a few minutes",
                "Check if the service is experiencing issues"
            ]
            
        case .cancelled:
            classification.severity = .low
            classification.isRetryable = false
            classification.userMessage = "Operation was cancelled."
            
        default:
            classification.severity = .medium
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.baseRetryDelay
            classification.userMessage = "Network error occurred. Please try again."
        }
        
        return classification
    }
    
    private func classifyFirebaseError(_ error: NSError) -> ErrorClassification {
        let classification = ErrorClassification()
        classification.category = .firebase
        
        if error.domain == AuthErrorDomain {
            return classifyAuthError(error)
        }
        
        // Firestore errors
        switch error.code {
        case FirestoreErrorCode.unavailable.rawValue:
            classification.severity = .high
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.firebaseRetryDelay
            classification.userMessage = "Service temporarily unavailable. Please try again."
            
        case FirestoreErrorCode.deadlineExceeded.rawValue:
            classification.severity = .medium
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.baseRetryDelay
            classification.userMessage = "Request timed out. Please try again."
            
        case FirestoreErrorCode.permissionDenied.rawValue:
            classification.severity = .medium
            classification.isRetryable = false
            classification.userMessage = "Permission denied. Please sign in again."
            
        case FirestoreErrorCode.resourceExhausted.rawValue:
            classification.severity = .medium
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.firebaseRetryDelay * 2
            classification.userMessage = "Service is busy. Please try again later."
            
        default:
            classification.severity = .medium
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.firebaseRetryDelay
            classification.userMessage = "A service error occurred. Please try again."
        }
        
        return classification
    }
    
    private func classifyAuthError(_ error: NSError) -> ErrorClassification {
        let classification = ErrorClassification()
        classification.category = .authentication
        classification.severity = .medium
        classification.isRetryable = false
        
        switch error.code {
        case AuthErrorCode.networkError.rawValue:
            classification.category = .network
            classification.isRetryable = true
            classification.userMessage = "Network error during authentication. Please try again."
            
        case AuthErrorCode.userNotFound.rawValue:
            classification.userMessage = "No account found with this email address."
            
        case AuthErrorCode.wrongPassword.rawValue:
            classification.userMessage = "Incorrect password. Please try again."
            
        case AuthErrorCode.emailAlreadyInUse.rawValue:
            classification.userMessage = "An account with this email already exists."
            
        case AuthErrorCode.weakPassword.rawValue:
            classification.userMessage = "Password should be at least 6 characters."
            
        case AuthErrorCode.invalidEmail.rawValue:
            classification.userMessage = "Please enter a valid email address."
            
        case AuthErrorCode.tooManyRequests.rawValue:
            classification.isRetryable = true
            classification.suggestedRetryDelay = config.authRetryDelay
            classification.userMessage = "Too many attempts. Please try again later."
            
        default:
            classification.userMessage = "Authentication failed. Please try again."
        }
        
        return classification
    }
    
    // MARK: - Retry Logic
    
    func executeWithRetry<T>(
        operation: @escaping () async throws -> T,
        maxRetries: Int? = nil,
        baseDelay: TimeInterval? = nil
    ) async throws -> T {
        let maxAttempts = (maxRetries ?? config.maxRetries) + 1
        let delay = baseDelay ?? config.baseRetryDelay
        var lastError: Error?
        
        for attempt in 1...maxAttempts {
            do {
                let result = try await operation()
                
                // Track success
                trackSuccess(context: [
                    "attempt": attempt,
                    "totalAttempts": maxAttempts
                ])
                
                if attempt > 1 {
                    logger.info("Operation succeeded after \(attempt) attempts")
                }
                
                return result
            } catch {
                lastError = error
                let classification = classifyError(error)
                
                // Track error
                trackError(error, context: [
                    "attempt": attempt,
                    "maxAttempts": maxAttempts,
                    "retryable": classification.isRetryable
                ])
                
                // Don't retry if not retryable or max attempts reached
                if !classification.isRetryable || attempt >= maxAttempts {
                    break
                }
                
                // Calculate delay with exponential backoff
                let retryDelay = min(
                    delay * pow(2.0, Double(attempt - 1)),
                    config.maxRetryDelay
                )
                
                logger.info("Operation failed (attempt \(attempt)/\(maxAttempts)), retrying in \(retryDelay)s")
                
                try await Task.sleep(nanoseconds: UInt64(retryDelay * 1_000_000_000))
            }
        }
        
        logger.error("Operation failed after \(maxAttempts) attempts: \(lastError?.localizedDescription ?? "unknown error")")
        throw lastError ?? GenericError.operationFailed
    }
    
    // MARK: - Circuit Breaker
    
    func executeWithCircuitBreaker<T>(
        serviceName: String,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        let circuitState = getCircuitBreakerState(for: serviceName)
        
        switch circuitState {
        case .open:
            let timeSinceLastFailure = Date().timeIntervalSince(
                circuitBreakers[serviceName]?.lastFailureTime ?? Date()
            )
            
            if timeSinceLastFailure < config.circuitBreakerTimeout {
                throw CircuitBreakerError.circuitOpen(serviceName: serviceName)
            } else {
                // Move to half-open
                setCircuitBreakerState(serviceName: serviceName, state: .halfOpen)
                logger.info("Circuit breaker for \(serviceName) moved to half-open")
            }
            
        case .halfOpen:
            // Allow limited requests in half-open state
            break
            
        case .closed:
            // Normal operation
            break
        }
        
        do {
            let result = try await operation()
            
            // Operation succeeded
            recordServiceSuccess(serviceName: serviceName)
            
            if circuitState == .halfOpen {
                setCircuitBreakerState(serviceName: serviceName, state: .closed)
                logger.info("Circuit breaker for \(serviceName) closed after success")
            }
            
            return result
        } catch {
            // Operation failed
            recordServiceFailure(serviceName: serviceName)
            
            let currentState = getOrCreateCircuitBreakerState(serviceName: serviceName)
            if currentState.failureCount >= config.circuitBreakerFailureThreshold {
                setCircuitBreakerState(serviceName: serviceName, state: .open)
                logger.warning("Circuit breaker for \(serviceName) opened due to failures")
            }
            
            throw error
        }
    }
    
    func getCircuitBreakerState(for serviceName: String) -> CircuitBreakerState.State {
        return circuitBreakers[serviceName]?.state ?? .closed
    }
    
    func setCircuitBreakerState(serviceName: String, state: CircuitBreakerState.State) {
        if circuitBreakers[serviceName] == nil {
            circuitBreakers[serviceName] = CircuitBreakerState()
        }
        circuitBreakers[serviceName]?.state = state
    }
    
    private func getOrCreateCircuitBreakerState(serviceName: String) -> CircuitBreakerState {
        if circuitBreakers[serviceName] == nil {
            circuitBreakers[serviceName] = CircuitBreakerState()
        }
        return circuitBreakers[serviceName]!
    }
    
    func recordServiceFailure(serviceName: String) {
        let state = getOrCreateCircuitBreakerState(serviceName: serviceName)
        state.failureCount += 1
        state.lastFailureTime = Date()
        state.successCount = 0
    }
    
    func recordServiceSuccess(serviceName: String) {
        let state = getOrCreateCircuitBreakerState(serviceName: serviceName)
        state.successCount += 1
        state.failureCount = max(0, state.failureCount - 1) // Gradually reduce failure count
    }
    
    // MARK: - Offline Mode & Caching
    
    private func enterOfflineMode() {
        isInOfflineMode = true
        logger.info("Entered offline mode")
        
        // Save current state for offline access
        saveState()
    }
    
    private func handleReconnection() {
        isInOfflineMode = false
        logger.info("Reconnected to network")
        
        // Process any pending sync operations
        if hasPendingSyncOperations {
            Task {
                await processPendingSyncOperations()
            }
        }
    }
    
    func cacheDataForOfflineUse(data: Any, key: String) {
        offlineCache[key] = data
        
        // Persist to UserDefaults for app restarts
        if let encodableData = data as? Codable {
            if let encoded = try? JSONEncoder().encode(AnyEncodable(encodableData)) {
                userDefaults.set(encoded, forKey: "\(cacheKey).\(key)")
            }
        }
        
        logger.debug("Cached data for offline use: \(key)")
    }
    
    func getCachedData(for key: String) -> Any? {
        // First check in-memory cache
        if let data = offlineCache[key] {
            return data
        }
        
        // Then check persistent storage
        if let data = userDefaults.data(forKey: "\(cacheKey).\(key)") {
            return data
        }
        
        return nil
    }
    
    private func processPendingSyncOperations() async {
        logger.info("Processing pending sync operations")
        
        // This would integrate with your app's sync logic
        // For now, just clear the pending flag
        DispatchQueue.main.async {
            self.hasPendingSyncOperations = false
        }
    }
    
    // MARK: - User Experience
    
    func getUserFriendlyMessage(for error: Error) -> String {
        let classification = classifyError(error)
        return classification.userMessage ?? "An unexpected error occurred."
    }
    
    func getRecoverySuggestions(for error: Error) -> [String] {
        let classification = classifyError(error)
        return classification.recoverySuggestions ?? ["Please try again later."]
    }
    
    func shouldShowRetryButton(for error: Error) -> Bool {
        let classification = classifyError(error)
        return classification.isRetryable
    }
    
    // MARK: - Error Tracking
    
    func trackError(_ error: Error, context: [String: Any] = [:]) {
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        let classification = classifyError(error)
        let errorEntry = ErrorEntry(
            error: error,
            classification: classification,
            context: context,
            timestamp: Date()
        )
        
        errorMetrics.totalErrors += 1
        errorMetrics.errorsByCategory[classification.category, default: 0] += 1
        errorMetrics.recentErrors.append(errorEntry)
        
        // Keep only recent errors (last 100)
        if errorMetrics.recentErrors.count > 100 {
            errorMetrics.recentErrors.removeFirst()
        }
        
        logger.error("Error tracked: \(error.localizedDescription)", metadata: [
            "category": "\(classification.category)",
            "severity": "\(classification.severity)",
            "retryable": "\(classification.isRetryable)"
        ])
    }
    
    func trackSuccess(context: [String: Any] = [:]) {
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        errorMetrics.totalSuccesses += 1
        
        logger.debug("Success tracked", metadata: [
            "totalSuccesses": "\(errorMetrics.totalSuccesses)",
            "errorRate": "\(getErrorRate())"
        ])
    }
    
    func getErrorMetrics() -> ErrorMetrics {
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        return errorMetrics
    }
    
    func getErrorRate() -> Double {
        let total = errorMetrics.totalErrors + errorMetrics.totalSuccesses
        return total > 0 ? Double(errorMetrics.totalErrors) / Double(total) : 0.0
    }
    
    func getErrorTrend(timeWindow: TimeInterval) -> ErrorTrend {
        let cutoffTime = Date().addingTimeInterval(-timeWindow)
        let errorsInWindow = errorMetrics.recentErrors.filter { $0.timestamp > cutoffTime }
        
        let averageErrorsPerHour = Double(errorsInWindow.count) / (timeWindow / 3600.0)
        
        return ErrorTrend(
            errorsInWindow: errorsInWindow.count,
            averageErrorsPerHour: averageErrorsPerHour,
            timeWindow: timeWindow
        )
    }
    
    // MARK: - State Management
    
    func saveState() {
        let state = ErrorHandlerState(
            circuitBreakers: circuitBreakers,
            errorMetrics: errorMetrics,
            offlineCache: offlineCache
        )
        
        if let encoded = try? JSONEncoder().encode(state) {
            userDefaults.set(encoded, forKey: "ErrorHandler.State")
        }
        
        logger.debug("Error handler state saved")
    }
    
    func restoreState() {
        guard let data = userDefaults.data(forKey: "ErrorHandler.State"),
              let state = try? JSONDecoder().decode(ErrorHandlerState.self, from: data) else {
            logger.debug("No previous error handler state found")
            return
        }
        
        circuitBreakers = state.circuitBreakers
        errorMetrics = state.errorMetrics
        offlineCache = state.offlineCache
        
        logger.debug("Error handler state restored")
    }
    
    // MARK: - Degradation Strategy
    
    func getDegradationStrategy() -> DegradationStrategy {
        let errorRate = getErrorRate()
        let openCircuitCount = circuitBreakers.values.filter { $0.state == .open }.count
        
        var strategy = DegradationStrategy()
        
        if errorRate > 0.5 || openCircuitCount >= 3 {
            // Severe degradation
            strategy.useOfflineMode = true
            strategy.limitFeatures = true
            strategy.allowWriteOperations = false
            strategy.showMaintenanceMessage = true
        } else if errorRate > 0.2 || openCircuitCount >= 1 {
            // Moderate degradation
            strategy.limitFeatures = true
            strategy.allowWriteOperations = false
        } else if errorRate > 0.1 {
            // Light degradation
            strategy.showPerformanceWarning = true
        }
        
        return strategy
    }
}

// MARK: - Supporting Types

struct ErrorClassification {
    var category: ErrorCategory = .unknown
    var severity: ErrorSeverity = .medium
    var isRetryable: Bool = false
    var userMessage: String?
    var recoverySuggestions: [String]?
    var suggestedRetryDelay: TimeInterval = 1.0
}

enum ErrorCategory: String, CaseIterable {
    case network
    case firebase
    case authentication
    case validation
    case unknown
}

enum ErrorSeverity: String, CaseIterable {
    case low, medium, high, critical
}

enum NetworkStatus {
    case unknown, connected, disconnected
}

class CircuitBreakerState: ObservableObject, Codable {
    enum State: String, Codable {
        case closed, open, halfOpen
    }
    
    @Published var state: State = .closed
    @Published var failureCount: Int = 0
    @Published var successCount: Int = 0
    var lastFailureTime: Date = Date()
    
    enum CodingKeys: String, CodingKey {
        case state, failureCount, successCount, lastFailureTime
    }
    
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        state = try container.decode(State.self, forKey: .state)
        failureCount = try container.decode(Int.self, forKey: .failureCount)
        successCount = try container.decode(Int.self, forKey: .successCount)
        lastFailureTime = try container.decode(Date.self, forKey: .lastFailureTime)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(state, forKey: .state)
        try container.encode(failureCount, forKey: .failureCount)
        try container.encode(successCount, forKey: .successCount)
        try container.encode(lastFailureTime, forKey: .lastFailureTime)
    }
    
    init() {}
}

struct ErrorMetrics: Codable {
    var totalErrors: Int = 0
    var totalSuccesses: Int = 0
    var errorsByCategory: [ErrorCategory: Int] = [:]
    var recentErrors: [ErrorEntry] = []
}

struct ErrorEntry: Codable {
    let error: ErrorInfo
    let classification: ErrorClassificationInfo
    let context: [String: String] // Simplified for Codable
    let timestamp: Date
    
    init(error: Error, classification: ErrorClassification, context: [String: Any], timestamp: Date) {
        self.error = ErrorInfo(
            domain: (error as NSError).domain,
            code: (error as NSError).code,
            description: error.localizedDescription
        )
        self.classification = ErrorClassificationInfo(
            category: classification.category,
            severity: classification.severity,
            isRetryable: classification.isRetryable
        )
        // Convert context to String values for Codable
        self.context = context.compactMapValues { "\($0)" }
        self.timestamp = timestamp
    }
}

struct ErrorInfo: Codable {
    let domain: String
    let code: Int
    let description: String
}

struct ErrorClassificationInfo: Codable {
    let category: ErrorCategory
    let severity: ErrorSeverity
    let isRetryable: Bool
}

struct ErrorTrend {
    let errorsInWindow: Int
    let averageErrorsPerHour: Double
    let timeWindow: TimeInterval
}

struct ErrorHandlerConfig {
    let maxRetries: Int
    let baseRetryDelay: TimeInterval
    let maxRetryDelay: TimeInterval
    let networkRetryDelay: TimeInterval
    let firebaseRetryDelay: TimeInterval
    let authRetryDelay: TimeInterval
    let circuitBreakerFailureThreshold: Int
    let circuitBreakerTimeout: TimeInterval
    
    static let `default` = ErrorHandlerConfig(
        maxRetries: 3,
        baseRetryDelay: 1.0,
        maxRetryDelay: 30.0,
        networkRetryDelay: 2.0,
        firebaseRetryDelay: 3.0,
        authRetryDelay: 5.0,
        circuitBreakerFailureThreshold: 5,
        circuitBreakerTimeout: 60.0
    )
}

struct ErrorHandlerState: Codable {
    let circuitBreakers: [String: CircuitBreakerState]
    let errorMetrics: ErrorMetrics
    let offlineCache: [String: Data] // Simplified for Codable
    
    init(circuitBreakers: [String: CircuitBreakerState], errorMetrics: ErrorMetrics, offlineCache: [String: Any]) {
        self.circuitBreakers = circuitBreakers
        self.errorMetrics = errorMetrics
        // Convert offlineCache to Data for Codable
        self.offlineCache = offlineCache.compactMapValues { value in
            if let data = value as? Data {
                return data
            }
            return try? JSONSerialization.data(withJSONObject: value)
        }
    }
}

struct DegradationStrategy {
    var useOfflineMode: Bool = false
    var limitFeatures: Bool = false
    var allowWriteOperations: Bool = true
    var showPerformanceWarning: Bool = false
    var showMaintenanceMessage: Bool = false
}

// MARK: - Error Types

enum CircuitBreakerError: LocalizedError {
    case circuitOpen(serviceName: String)
    
    var errorDescription: String? {
        switch self {
        case .circuitOpen(let serviceName):
            return "Service \(serviceName) is temporarily unavailable. Please try again later."
        }
    }
    
    enum Reason {
        case circuitOpen
    }
    
    var reason: Reason {
        switch self {
        case .circuitOpen:
            return .circuitOpen
        }
    }
}

enum GenericError: LocalizedError {
    case operationFailed
    
    var errorDescription: String? {
        switch self {
        case .operationFailed:
            return "The operation could not be completed."
        }
    }
}

// MARK: - Network Monitoring Protocol

protocol NetworkMonitoring {
    var isConnected: Bool { get }
    var statusUpdateHandler: ((Bool) -> Void)? { get set }
    
    func startMonitoring()
    func stopMonitoring()
}

// MARK: - Network Monitor Implementation

class NetworkMonitor: NetworkMonitoring, ObservableObject {
    static let shared = NetworkMonitor()
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    
    @Published var isConnected: Bool = false
    var statusUpdateHandler: ((Bool) -> Void)?
    
    private init() {
        startMonitoring()
    }
    
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            let isConnected = path.status == .satisfied
            
            DispatchQueue.main.async {
                self?.isConnected = isConnected
                self?.statusUpdateHandler?(isConnected)
            }
        }
        
        monitor.start(queue: queue)
    }
    
    func stopMonitoring() {
        monitor.cancel()
    }
}

// MARK: - Helper Types

private struct AnyEncodable: Encodable {
    private let encodable: Encodable
    
    init(_ encodable: Encodable) {
        self.encodable = encodable
    }
    
    func encode(to encoder: Encoder) throws {
        try encodable.encode(to: encoder)
    }
}