import WidgetKit
import SwiftUI

/// Timeline provider for service status widget
struct ServiceStatusTimelineProvider: TimelineProvider {
    private let preferencesService: SharedPreferencesService
    
    init(preferencesService: SharedPreferencesService = SharedPreferencesService.shared) {
        self.preferencesService = preferencesService
    }
    
    // MARK: - TimelineProvider Protocol
    
    func placeholder(in context: Context) -> ServiceStatusEntry {
        return ServiceStatusEntry.placeholder()
    }
    
    func getSnapshot(in context: Context, completion: @escaping (Result<ServiceStatusEntry, Error>) -> ()) {
        let currentState = preferencesService.loadServiceState()
        
        // For widget gallery, show sample data
        let entry: ServiceStatusEntry
        if context.isPreview {
            entry = ServiceStatusEntry.sample()
        } else {
            entry = ServiceStatusEntry(
                date: Date(),
                serviceState: currentState,
                relevance: createRelevance(for: currentState)
            )
        }
        
        completion(.success(entry))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Result<Timeline<ServiceStatusEntry>, Error>) -> ()) {
        let currentState = preferencesService.loadServiceState()
        let currentDate = Date()
        
        // Create timeline entries
        var entries: [ServiceStatusEntry] = []
        
        // Current entry
        let currentEntry = ServiceStatusEntry(
            date: currentDate,
            serviceState: currentState,
            relevance: createRelevance(for: currentState)
        )
        entries.append(currentEntry)
        
        // Create projected entries for the next few hours
        let projectedEntries = createProjectedEntries(
            from: currentState,
            startDate: currentDate,
            context: context
        )
        entries.append(contentsOf: projectedEntries)
        
        // Determine refresh policy based on service state
        let refreshInterval = getRefreshInterval(for: currentState)
        let nextRefresh = currentDate.addingTimeInterval(refreshInterval)
        let policy = TimelineReloadPolicy.after(nextRefresh)
        
        let timeline = Timeline(entries: entries, policy: policy)
        completion(.success(timeline))
    }
    
    // MARK: - Helper Methods
    
    /// Create relevance scoring for timeline entry
    private func createRelevance(for state: ServiceState) -> TimelineEntryRelevance {
        var score: Float = 0.0
        var duration: TimeInterval = 60 * 15 // 15 minutes default
        
        // Higher relevance for active service
        if state.isEnabled {
            score += 0.6
            duration = 60 * 10 // More frequent updates when active
        }
        
        // Higher relevance for connection issues
        switch state.connectionStatus {
        case .error:
            score += 0.8
            duration = 60 * 5 // Frequent updates for error resolution
        case .connecting:
            score += 0.4
            duration = 60 * 2 // Very frequent updates when connecting
        case .connected:
            score += 0.3
        case .disconnected:
            score += 0.1
        }
        
        // Higher relevance for recent activity
        if state.callsScreenedToday > 0 {
            score += 0.2
        }
        
        // Higher relevance during business hours
        if isBusinessHours() {
            score += 0.3
        }
        
        return TimelineEntryRelevance(score: min(score, 1.0), duration: duration)
    }
    
    /// Get refresh interval based on service state
    func getRefreshInterval(for state: ServiceState) -> TimeInterval {
        switch (state.isEnabled, state.connectionStatus) {
        case (_, .connecting):
            return 2 * 60 // 2 minutes when connecting
        case (_, .error):
            return 5 * 60 // 5 minutes for error retry
        case (true, .connected):
            return 15 * 60 // 15 minutes when active and connected
        case (false, _):
            return 30 * 60 // 30 minutes when disabled
        case (true, .disconnected):
            return 10 * 60 // 10 minutes when enabled but disconnected
        }
    }
    
    /// Create projected timeline entries for better widget experience
    private func createProjectedEntries(
        from currentState: ServiceState,
        startDate: Date,
        context: Context
    ) -> [ServiceStatusEntry] {
        var entries: [ServiceStatusEntry] = []
        let calendar = Calendar.current
        
        // Only create projected entries if service is active
        guard currentState.isEnabled && currentState.connectionStatus == .connected else {
            return entries
        }
        
        // Create entries for the next few hours with potential stat updates
        for hour in 1...6 {
            let entryDate = calendar.date(byAdding: .hour, value: hour, to: startDate) ?? startDate
            
            // Project potential statistics increase
            let projectedCallsScreened = currentState.callsScreenedToday + (hour * 2)
            let projectedSpamBlocked = currentState.spamCallsBlocked + max(0, hour - 2)
            
            let projectedState = ServiceState(
                isEnabled: currentState.isEnabled,
                lastUpdated: entryDate,
                callsScreenedToday: projectedCallsScreened,
                spamCallsBlocked: projectedSpamBlocked,
                connectionStatus: currentState.connectionStatus,
                statusMessage: currentState.statusMessage
            )
            
            let entry = ServiceStatusEntry(
                date: entryDate,
                serviceState: projectedState,
                relevance: createRelevance(for: projectedState)
            )
            
            entries.append(entry)
        }
        
        return entries
    }
    
    /// Check if current time is during business hours (increased call activity)
    private func isBusinessHours() -> Bool {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: Date())
        let weekday = calendar.component(.weekday, from: Date())
        
        // Business hours: 9 AM - 6 PM on weekdays
        let isWeekday = weekday >= 2 && weekday <= 6 // Monday-Friday
        let isBusinessHour = hour >= 9 && hour <= 18
        
        return isWeekday && isBusinessHour
    }
}

/// Extension for creating mock timeline provider for testing
extension ServiceStatusTimelineProvider {
    /// Create a mock timeline provider for testing
    static func mock(with state: ServiceState) -> ServiceStatusTimelineProvider {
        let mockService = MockSharedPreferencesService()
        mockService.savedState = state
        return ServiceStatusTimelineProvider(preferencesService: mockService)
    }
}

/// Mock implementation for testing
class MockSharedPreferencesService: SharedPreferencesService {
    var savedState: ServiceState?
    var saveStateWasCalled = false
    
    override func saveServiceState(_ state: ServiceState) {
        savedState = state
        saveStateWasCalled = true
    }
    
    override func loadServiceState() -> ServiceState {
        return savedState ?? ServiceState()
    }
    
    override func clearServiceState() {
        savedState = nil
    }
}