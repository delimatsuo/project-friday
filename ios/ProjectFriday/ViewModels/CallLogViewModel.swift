import Foundation
import SwiftUI
import Firebase
import FirebaseFirestore
import Combine

@MainActor
class CallLogViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published var callLogs: [CallLog] = []
    @Published var isLoading = false
    @Published var isRefreshing = false
    @Published var error: Error?
    @Published var searchText = ""
    @Published var showingError = false
    @Published var selectedCallLog: CallLog?
    @Published var unreadCount = 0
    
    // MARK: - Computed Properties
    
    var filteredCallLogs: [CallLog] {
        return service.searchCallLogs(callLogs, searchText: searchText)
    }
    
    var groupedCallLogs: [(String, [CallLog])] {
        return service.groupCallLogsByDate(filteredCallLogs)
    }
    
    var hasUnreadCalls: Bool {
        return unreadCount > 0
    }
    
    // MARK: - Private Properties
    
    private let service: CallLogServiceProtocol
    private var currentListener: ListenerRegistration?
    private var cancellables = Set<AnyCancellable>()
    private let hapticFeedback = UIImpactFeedbackGenerator(style: .light)
    
    // MARK: - Initialization
    
    init(service: CallLogServiceProtocol = CallLogService()) {
        self.service = service
        setupBindings()
    }
    
    deinit {
        removeListener()
    }
    
    // MARK: - Setup
    
    private func setupBindings() {
        // Watch for error changes to show/hide error alerts
        $error
            .map { $0 != nil }
            .assign(to: \.showingError, on: self)
            .store(in: &cancellables)
        
        // Setup haptic feedback
        hapticFeedback.prepare()
    }
    
    // MARK: - Public Methods
    
    func fetchCallLogs(for userId: String) async {
        guard !userId.isEmpty else { return }
        
        isLoading = true
        error = nil
        
        do {
            let fetchedCallLogs = try await service.fetchCallLogs(for: userId)
            callLogs = fetchedCallLogs
            updateUnreadCount()
        } catch {
            self.error = error
            print("Error fetching call logs: \(error)")
        }
        
        isLoading = false
    }
    
    func refreshCallLogs(for userId: String) async {
        guard !userId.isEmpty else { return }
        
        isRefreshing = true
        await fetchCallLogs(for: userId)
        isRefreshing = false
        
        // Haptic feedback for refresh
        hapticFeedback.impactOccurred()
    }
    
    func setupRealTimeListener(for userId: String) {
        guard !userId.isEmpty else { return }
        
        // Remove existing listener
        removeListener()
        
        currentListener = service.addRealTimeListener(for: userId) { [weak self] callLogs, error in
            Task { @MainActor in
                if let error = error {
                    self?.error = error
                    print("Real-time listener error: \(error)")
                } else if let callLogs = callLogs {
                    self?.callLogs = callLogs
                    self?.updateUnreadCount()
                }
            }
        }
    }
    
    func removeListener() {
        if let listener = currentListener {
            service.removeListener(listener)
            currentListener = nil
        }
    }
    
    func markAsRead(_ callLog: CallLog, userId: String) async {
        guard !callLog.isRead else { return }
        
        do {
            try await service.markAsRead(callLogId: callLog.id, userId: userId)
            
            // Update local state
            if let index = callLogs.firstIndex(where: { $0.id == callLog.id }) {
                callLogs[index].markAsRead()
            }
            updateUnreadCount()
            
            // Haptic feedback
            hapticFeedback.impactOccurred()
        } catch {
            self.error = error
        }
    }
    
    func deleteCallLog(_ callLog: CallLog, userId: String) async {
        do {
            try await service.deleteCallLog(callLogId: callLog.id, userId: userId)
            
            // Update local state
            callLogs.removeAll { $0.id == callLog.id }
            updateUnreadCount()
            
            // Haptic feedback
            let heavyFeedback = UIImpactFeedbackGenerator(style: .heavy)
            heavyFeedback.impactOccurred()
        } catch {
            self.error = error
        }
    }
    
    func markAllAsRead(userId: String) async {
        guard hasUnreadCalls else { return }
        
        do {
            if let service = service as? CallLogService {
                try await service.markAllAsRead(for: userId)
            }
            
            // Update local state
            for index in callLogs.indices {
                callLogs[index].markAsRead()
            }
            updateUnreadCount()
            
            // Haptic feedback
            hapticFeedback.impactOccurred()
        } catch {
            self.error = error
        }
    }
    
    func clearSearch() {
        searchText = ""
    }
    
    func selectCallLog(_ callLog: CallLog) {
        selectedCallLog = callLog
        hapticFeedback.impactOccurred()
    }
    
    func dismissError() {
        error = nil
        showingError = false
    }
    
    // MARK: - Private Methods
    
    private func updateUnreadCount() {
        unreadCount = callLogs.filter { !$0.isRead }.count
    }
}

// MARK: - CallLogViewModel Extensions

extension CallLogViewModel {
    
    // Convenience methods for UI
    
    var isEmptyState: Bool {
        return callLogs.isEmpty && !isLoading
    }
    
    var isSearchResultEmpty: Bool {
        return !searchText.isEmpty && filteredCallLogs.isEmpty
    }
    
    var errorMessage: String {
        return error?.localizedDescription ?? "Unknown error occurred"
    }
    
    func formattedUnreadCount() -> String {
        if unreadCount > 99 {
            return "99+"
        }
        return "\(unreadCount)"
    }
    
    // For testing purposes
    func setCallLogs(_ callLogs: [CallLog]) {
        self.callLogs = callLogs
        updateUnreadCount()
    }
    
    func setError(_ error: Error?) {
        self.error = error
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension CallLogViewModel {
    static func preview() -> CallLogViewModel {
        let viewModel = CallLogViewModel(service: MockCallLogService())
        
        // Set up some sample data
        let sampleCallLogs = [
            CallLog(
                id: "1",
                userId: "preview-user",
                callerId: "+1234567890",
                callerName: "John Doe",
                timestamp: Date().addingTimeInterval(-3600), // 1 hour ago
                duration: 120,
                fullTranscript: "Hello, this is John calling about the project meeting tomorrow. I wanted to confirm the time and location.",
                aiSummary: "John called to confirm project meeting details",
                audioRecordingUrl: nil,
                isRead: false
            ),
            CallLog(
                id: "2",
                userId: "preview-user",
                callerId: "+0987654321",
                callerName: "Jane Smith",
                timestamp: Date().addingTimeInterval(-7200), // 2 hours ago
                duration: 45,
                fullTranscript: "Hi, this is Jane from ABC Company. I'm calling about the invoice we sent last week.",
                aiSummary: "Jane from ABC Company called about an invoice",
                audioRecordingUrl: nil,
                isRead: true
            )
        ]
        
        viewModel.setCallLogs(sampleCallLogs)
        return viewModel
    }
}

// Mock service for previews and testing
class MockCallLogService: CallLogServiceProtocol {
    var mockCallLogs: [CallLog] = []
    var shouldThrowError = false
    
    func fetchCallLogs(for userId: String) async throws -> [CallLog] {
        if shouldThrowError {
            throw CallLogError.networkError
        }
        return mockCallLogs
    }
    
    func addRealTimeListener(for userId: String, completion: @escaping ([CallLog]?, Error?) -> Void) -> ListenerRegistration {
        // Mock listener that immediately returns data
        completion(mockCallLogs, nil)
        return MockListenerRegistration()
    }
    
    func removeListener(_ listener: ListenerRegistration) {
        // Mock implementation
    }
    
    func markAsRead(callLogId: String, userId: String) async throws {
        if shouldThrowError {
            throw CallLogError.networkError
        }
    }
    
    func deleteCallLog(callLogId: String, userId: String) async throws {
        if shouldThrowError {
            throw CallLogError.networkError
        }
    }
    
    func searchCallLogs(_ callLogs: [CallLog], searchText: String) -> [CallLog] {
        return callLogs.filter { $0.matchesSearch(searchText) }
    }
}

class MockListenerRegistration: ListenerRegistration {
    func remove() {
        // Mock implementation
    }
}
#endif