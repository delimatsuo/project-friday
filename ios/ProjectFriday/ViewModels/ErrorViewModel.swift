import Foundation
import SwiftUI
import Combine

/**
 * ErrorViewModel
 * Manages error state and user interaction for error handling UI components
 */
@MainActor
class ErrorViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published var currentError: DisplayableError?
    @Published var errorHistory: [DisplayableError] = []
    @Published var isShowingError: Bool = false
    @Published var isRetrying: Bool = false
    @Published var canRetry: Bool = false
    @Published var networkStatus: NetworkStatus = .unknown
    @Published var isInOfflineMode: Bool = false
    
    // MARK: - Private Properties
    
    private let errorHandler: ErrorHandler
    private var cancellables = Set<AnyCancellable>()
    private var retryOperation: (() async throws -> Void)?
    
    // MARK: - Configuration
    
    private let maxErrorHistory = 10
    private let errorDisplayDuration: TimeInterval = 5.0
    
    // MARK: - Initialization
    
    init(errorHandler: ErrorHandler = ErrorHandler()) {
        self.errorHandler = errorHandler
        setupObservers()
    }
    
    // MARK: - Setup
    
    private func setupObservers() {
        // Observe network status changes
        errorHandler.$currentNetworkStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.networkStatus = status
            }
            .store(in: &cancellables)
        
        // Observe offline mode changes
        errorHandler.$isInOfflineMode
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isOffline in
                self?.isInOfflineMode = isOffline
                if isOffline {
                    self?.showOfflineMessage()
                } else {
                    self?.hideOfflineMessage()
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Public Methods
    
    func presentError(_ error: Error, retryAction: (() async throws -> Void)? = nil) {
        let classification = errorHandler.classifyError(error)
        let displayableError = DisplayableError(
            id: UUID(),
            title: getErrorTitle(for: classification),
            message: errorHandler.getUserFriendlyMessage(for: error),
            suggestions: errorHandler.getRecoverySuggestions(for: error),
            severity: classification.severity,
            category: classification.category,
            canRetry: classification.isRetryable && retryAction != nil,
            timestamp: Date()
        )
        
        // Store retry operation
        if classification.isRetryable {
            self.retryOperation = retryAction
        }
        
        // Update state
        currentError = displayableError
        canRetry = displayableError.canRetry
        isShowingError = true
        
        // Add to history
        addToErrorHistory(displayableError)
        
        // Track the error
        errorHandler.trackError(error, context: [
            "presented_to_user": true,
            "retry_available": displayableError.canRetry
        ])
        
        // Auto-dismiss for low severity errors
        if classification.severity == .low {
            scheduleAutoDismissal()
        }
    }
    
    func dismissError() {
        currentError = nil
        isShowingError = false
        canRetry = false
        retryOperation = nil
    }
    
    func retryOperation() async {
        guard let retryOperation = retryOperation else { return }
        
        isRetrying = true
        
        do {
            try await retryOperation()
            
            // Success - dismiss error and track success
            dismissError()
            errorHandler.trackSuccess(context: ["retry_successful": true])
            
            // Show success feedback
            showSuccessMessage("Operation completed successfully")
            
        } catch {
            // Retry failed - present new error
            isRetrying = false
            presentError(error, retryAction: retryOperation)
            
            // Track retry failure
            errorHandler.trackError(error, context: ["retry_failed": true])
        }
        
        isRetrying = false
    }
    
    func clearErrorHistory() {
        errorHistory.removeAll()
    }
    
    func getNetworkStatusMessage() -> String {
        switch networkStatus {
        case .connected:
            return "Connected"
        case .disconnected:
            return "No internet connection"
        case .unknown:
            return "Checking connection..."
        }
    }
    
    func getNetworkStatusColor() -> Color {
        switch networkStatus {
        case .connected:
            return .green
        case .disconnected:
            return .red
        case .unknown:
            return .orange
        }
    }
    
    // MARK: - Private Methods
    
    private func getErrorTitle(for classification: ErrorClassification) -> String {
        switch classification.category {
        case .network:
            return "Connection Problem"
        case .firebase:
            return "Service Error"
        case .authentication:
            return "Authentication Error"
        case .validation:
            return "Invalid Input"
        case .unknown:
            switch classification.severity {
            case .critical:
                return "Critical Error"
            case .high:
                return "Error"
            case .medium:
                return "Something Went Wrong"
            case .low:
                return "Notice"
            }
        }
    }
    
    private func addToErrorHistory(_ error: DisplayableError) {
        errorHistory.insert(error, at: 0)
        
        // Keep only recent errors
        if errorHistory.count > maxErrorHistory {
            errorHistory.removeLast()
        }
    }
    
    private func scheduleAutoDismissal() {
        Task {
            try? await Task.sleep(nanoseconds: UInt64(errorDisplayDuration * 1_000_000_000))
            if currentError?.severity == .low {
                dismissError()
            }
        }
    }
    
    private func showOfflineMessage() {
        let offlineError = DisplayableError(
            id: UUID(),
            title: "Offline Mode",
            message: "You're currently offline. Some features may be limited.",
            suggestions: [
                "Check your internet connection",
                "Try switching between WiFi and cellular data"
            ],
            severity: .medium,
            category: .network,
            canRetry: false,
            timestamp: Date()
        )
        
        // Only show if no other error is currently displayed
        if !isShowingError {
            currentError = offlineError
            isShowingError = true
        }
    }
    
    private func hideOfflineMessage() {
        // Only hide if the current error is the offline message
        if currentError?.category == .network && 
           currentError?.title == "Offline Mode" {
            dismissError()
        }
    }
    
    private func showSuccessMessage(_ message: String) {
        // Implementation would show a success toast/banner
        // For now, just log the success
        print("Success: \(message)")
    }
}

// MARK: - Supporting Types

struct DisplayableError: Identifiable, Hashable {
    let id: UUID
    let title: String
    let message: String
    let suggestions: [String]
    let severity: ErrorSeverity
    let category: ErrorCategory
    let canRetry: Bool
    let timestamp: Date
    
    var severityColor: Color {
        switch severity {
        case .low:
            return .blue
        case .medium:
            return .orange
        case .high:
            return .red
        case .critical:
            return .purple
        }
    }
    
    var severityIcon: String {
        switch severity {
        case .low:
            return "info.circle"
        case .medium:
            return "exclamationmark.triangle"
        case .high:
            return "xmark.circle"
        case .critical:
            return "exclamationmark.octagon"
        }
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: DisplayableError, rhs: DisplayableError) -> Bool {
        return lhs.id == rhs.id
    }
}

// MARK: - Error Display Style

enum ErrorDisplayStyle {
    case banner
    case modal
    case toast
    case inline
}

// MARK: - Error Actions

enum ErrorAction {
    case retry
    case dismiss
    case showDetails
    case contactSupport
    case goOffline
}

// MARK: - Error Context

struct ErrorContext {
    let screen: String?
    let operation: String?
    let userID: String?
    let additionalInfo: [String: Any]
    
    init(screen: String? = nil, 
         operation: String? = nil, 
         userID: String? = nil, 
         additionalInfo: [String: Any] = [:]) {
        self.screen = screen
        self.operation = operation
        self.userID = userID
        self.additionalInfo = additionalInfo
    }
}