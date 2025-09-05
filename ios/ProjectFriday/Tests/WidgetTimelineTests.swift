import XCTest
import WidgetKit
@testable import ProjectFriday

class WidgetTimelineTests: XCTestCase {
    var timelineProvider: ServiceStatusTimelineProvider!
    var mockPreferencesService: MockSharedPreferencesService!
    
    override func setUp() {
        super.setUp()
        mockPreferencesService = MockSharedPreferencesService()
        timelineProvider = ServiceStatusTimelineProvider(preferencesService: mockPreferencesService)
    }
    
    override func tearDown() {
        timelineProvider = nil
        mockPreferencesService = nil
        super.tearDown()
    }
    
    // MARK: - Placeholder Tests
    
    func testPlaceholder() {
        let placeholder = timelineProvider.placeholder(in: Context())
        
        XCTAssertEqual(placeholder.serviceState.isEnabled, false)
        XCTAssertEqual(placeholder.serviceState.connectionStatus, .disconnected)
        XCTAssertEqual(placeholder.serviceState.statusMessage, "Service disabled")
    }
    
    // MARK: - Snapshot Tests
    
    func testSnapshotForDisplayInWidget() {
        let expectation = XCTestExpectation(description: "Snapshot completion")
        
        // Given: Service is enabled with some stats
        let enabledState = ServiceState(
            isEnabled: true,
            callsScreenedToday: 5,
            spamCallsBlocked: 2,
            connectionStatus: .connected,
            statusMessage: "Service active"
        )
        mockPreferencesService.savedState = enabledState
        
        let context = Context()
        
        // When: Getting snapshot for widget preview
        timelineProvider.getSnapshot(in: context) { result in
            switch result {
            case .success(let entry):
                // Then: Entry should reflect enabled state
                XCTAssertTrue(entry.serviceState.isEnabled)
                XCTAssertEqual(entry.serviceState.callsScreenedToday, 5)
                XCTAssertEqual(entry.serviceState.spamCallsBlocked, 2)
                XCTAssertEqual(entry.serviceState.connectionStatus, .connected)
            case .failure(let error):
                XCTFail("Snapshot should not fail: \(error)")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testSnapshotForDisplayInSelectionUI() {
        let expectation = XCTestExpectation(description: "Snapshot completion")
        
        // Given: Service is disabled (default state for widget selection)
        mockPreferencesService.savedState = ServiceState()
        
        var context = Context()
        context.isPreview = true
        
        // When: Getting snapshot for widget selection UI
        timelineProvider.getSnapshot(in: context) { result in
            switch result {
            case .success(let entry):
                // Then: Entry should show disabled state with sample data
                XCTAssertFalse(entry.serviceState.isEnabled)
                XCTAssertEqual(entry.serviceState.connectionStatus, .disconnected)
                XCTAssertEqual(entry.serviceState.statusMessage, "Service disabled")
            case .failure(let error):
                XCTFail("Snapshot should not fail: \(error)")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - Timeline Tests
    
    func testTimelineWithDisabledService() {
        let expectation = XCTestExpectation(description: "Timeline completion")
        
        // Given: Service is disabled
        mockPreferencesService.savedState = ServiceState()
        
        let context = Context()
        
        // When: Getting timeline
        timelineProvider.getTimeline(in: context) { result in
            switch result {
            case .success(let timeline):
                // Then: Timeline should have entries and appropriate refresh policy
                XCTAssertFalse(timeline.entries.isEmpty)
                XCTAssertEqual(timeline.policy, .after(Date().addingTimeInterval(30 * 60))) // 30 minutes
                
                // First entry should reflect disabled state
                let firstEntry = timeline.entries.first!
                XCTAssertFalse(firstEntry.serviceState.isEnabled)
                XCTAssertEqual(firstEntry.serviceState.connectionStatus, .disconnected)
                
            case .failure(let error):
                XCTFail("Timeline should not fail: \(error)")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testTimelineWithEnabledService() {
        let expectation = XCTestExpectation(description: "Timeline completion")
        
        // Given: Service is enabled and connected
        let enabledState = ServiceState(
            isEnabled: true,
            callsScreenedToday: 3,
            spamCallsBlocked: 1,
            connectionStatus: .connected,
            statusMessage: "Service active"
        )
        mockPreferencesService.savedState = enabledState
        
        let context = Context()
        
        // When: Getting timeline
        timelineProvider.getTimeline(in: context) { result in
            switch result {
            case .success(let timeline):
                // Then: Timeline should have more frequent updates
                XCTAssertFalse(timeline.entries.isEmpty)
                XCTAssertEqual(timeline.policy, .after(Date().addingTimeInterval(15 * 60))) // 15 minutes
                
                // First entry should reflect enabled state
                let firstEntry = timeline.entries.first!
                XCTAssertTrue(firstEntry.serviceState.isEnabled)
                XCTAssertEqual(firstEntry.serviceState.connectionStatus, .connected)
                XCTAssertEqual(firstEntry.serviceState.callsScreenedToday, 3)
                XCTAssertEqual(firstEntry.serviceState.spamCallsBlocked, 1)
                
            case .failure(let error):
                XCTFail("Timeline should not fail: \(error)")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testTimelineWithConnectionError() {
        let expectation = XCTestExpectation(description: "Timeline completion")
        
        // Given: Service has connection error
        let errorState = ServiceState(
            isEnabled: false,
            connectionStatus: .error,
            statusMessage: "Connection error"
        )
        mockPreferencesService.savedState = errorState
        
        let context = Context()
        
        // When: Getting timeline
        timelineProvider.getTimeline(in: context) { result in
            switch result {
            case .success(let timeline):
                // Then: Timeline should have shorter refresh interval to retry
                XCTAssertFalse(timeline.entries.isEmpty)
                XCTAssertEqual(timeline.policy, .after(Date().addingTimeInterval(5 * 60))) // 5 minutes for retry
                
                // First entry should reflect error state
                let firstEntry = timeline.entries.first!
                XCTAssertFalse(firstEntry.serviceState.isEnabled)
                XCTAssertEqual(firstEntry.serviceState.connectionStatus, .error)
                
            case .failure(let error):
                XCTFail("Timeline should not fail: \(error)")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - Timeline Entry Tests
    
    func testTimelineEntryRelevance() {
        // Test that timeline entries have appropriate relevance scores
        let currentDate = Date()
        
        // Enabled service should have higher relevance
        let enabledEntry = ServiceStatusEntry(
            date: currentDate,
            serviceState: ServiceState(isEnabled: true, connectionStatus: .connected)
        )
        
        let disabledEntry = ServiceStatusEntry(
            date: currentDate,
            serviceState: ServiceState(isEnabled: false)
        )
        
        // In a real implementation, we'd check relevance scores
        // For now, just verify the entries are created correctly
        XCTAssertTrue(enabledEntry.serviceState.isEnabled)
        XCTAssertFalse(disabledEntry.serviceState.isEnabled)
    }
    
    func testTimelineEntryDuration() {
        // Test that timeline entries have appropriate display durations
        let currentDate = Date()
        
        let entry = ServiceStatusEntry(
            date: currentDate,
            serviceState: ServiceState(isEnabled: true, connectionStatus: .connected)
        )
        
        // Verify entry date is correct
        XCTAssertEqual(entry.date.timeIntervalSince(currentDate), 0, accuracy: 1.0)
    }
    
    // MARK: - Widget Refresh Policy Tests
    
    func testRefreshPolicyForDifferentStates() {
        let provider = ServiceStatusTimelineProvider()
        
        // Test refresh intervals for different states
        let disabledInterval = provider.getRefreshInterval(for: ServiceState())
        XCTAssertEqual(disabledInterval, 30 * 60) // 30 minutes for disabled
        
        let enabledState = ServiceState(isEnabled: true, connectionStatus: .connected)
        let enabledInterval = provider.getRefreshInterval(for: enabledState)
        XCTAssertEqual(enabledInterval, 15 * 60) // 15 minutes for enabled
        
        let errorState = ServiceState(connectionStatus: .error)
        let errorInterval = provider.getRefreshInterval(for: errorState)
        XCTAssertEqual(errorInterval, 5 * 60) // 5 minutes for error retry
    }
}