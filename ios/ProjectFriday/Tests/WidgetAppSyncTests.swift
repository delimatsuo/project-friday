import XCTest
import WidgetKit
@testable import ProjectFriday

class WidgetAppSyncTests: XCTestCase {
    var preferencesService: SharedPreferencesService!
    var serviceToggleViewModel: ServiceToggleViewModel!
    
    override func setUp() {
        super.setUp()
        preferencesService = SharedPreferencesService.shared
        // Clear any existing state
        preferencesService.clearServiceState()
        serviceToggleViewModel = ServiceToggleViewModel(preferencesService: preferencesService)
    }
    
    override func tearDown() {
        preferencesService.clearServiceState()
        serviceToggleViewModel = nil
        preferencesService = nil
        super.tearDown()
    }
    
    // MARK: - App to Widget Sync Tests
    
    func testAppStateChangesSyncToWidget() {
        // Given: App initially has service disabled
        XCTAssertFalse(serviceToggleViewModel.isServiceEnabled)
        
        // When: User enables service in app
        serviceToggleViewModel.toggleService()
        
        // Then: Widget should be able to read the updated state
        let savedState = preferencesService.loadServiceState()
        XCTAssertTrue(savedState.isEnabled)
        XCTAssertEqual(savedState.connectionStatus, .connecting)
    }
    
    func testAppStatisticsUpdateSyncToWidget() {
        // Given: Service is enabled
        serviceToggleViewModel.toggleService()
        
        // When: Statistics are updated in the app
        serviceToggleViewModel.updateStatistics(callsScreened: 15, spamBlocked: 5)
        
        // Then: Widget should be able to read updated statistics
        let savedState = preferencesService.loadServiceState()
        XCTAssertEqual(savedState.callsScreenedToday, 15)
        XCTAssertEqual(savedState.spamCallsBlocked, 5)
    }
    
    func testAppConnectionStatusSyncToWidget() {
        // Given: Service is enabled and connecting
        serviceToggleViewModel.toggleService()
        XCTAssertEqual(serviceToggleViewModel.connectionStatus, .connecting)
        
        // When: Connection status changes in app
        serviceToggleViewModel.updateConnectionStatus(.connected)
        
        // Then: Widget should be able to read the updated connection status
        let savedState = preferencesService.loadServiceState()
        XCTAssertEqual(savedState.connectionStatus, .connected)
        XCTAssertTrue(savedState.statusMessage.contains("active"))
    }
    
    // MARK: - Widget Timeline Refresh Tests
    
    func testWidgetRefreshAfterAppStateChange() {
        let expectation = XCTestExpectation(description: "Widget timeline refresh")
        
        // Given: Timeline provider exists
        let timelineProvider = ServiceStatusTimelineProvider(preferencesService: preferencesService)
        
        // When: App state changes
        serviceToggleViewModel.toggleService()
        
        // Then: Widget timeline should reflect new state
        timelineProvider.getSnapshot(in: Context()) { result in
            switch result {
            case .success(let entry):
                XCTAssertTrue(entry.serviceState.isEnabled)
                XCTAssertEqual(entry.serviceState.connectionStatus, .connecting)
            case .failure(let error):
                XCTFail("Timeline snapshot should not fail: \(error)")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testWidgetTimelineReflectsCurrentAppState() {
        let expectation = XCTestExpectation(description: "Widget timeline reflects app state")
        
        // Given: App has specific state with statistics
        serviceToggleViewModel.toggleService()
        serviceToggleViewModel.updateConnectionStatus(.connected)
        serviceToggleViewModel.updateStatistics(callsScreened: 10, spamBlocked: 3)
        
        // When: Widget requests timeline
        let timelineProvider = ServiceStatusTimelineProvider(preferencesService: preferencesService)
        timelineProvider.getTimeline(in: Context()) { result in
            switch result {
            case .success(let timeline):
                // Then: Timeline should reflect current app state
                let firstEntry = timeline.entries.first!
                XCTAssertTrue(firstEntry.serviceState.isEnabled)
                XCTAssertEqual(firstEntry.serviceState.connectionStatus, .connected)
                XCTAssertEqual(firstEntry.serviceState.callsScreenedToday, 10)
                XCTAssertEqual(firstEntry.serviceState.spamCallsBlocked, 3)
                
            case .failure(let error):
                XCTFail("Timeline should not fail: \(error)")
            }
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - Data Persistence Tests
    
    func testDataPersistsAcrossAppLaunches() {
        // Given: Service state is saved
        let originalState = ServiceState(
            isEnabled: true,
            callsScreenedToday: 8,
            spamCallsBlocked: 2,
            connectionStatus: .connected,
            statusMessage: "Service active"
        )
        preferencesService.saveServiceState(originalState)
        
        // When: Creating new ViewModel instance (simulating app relaunch)
        let newViewModel = ServiceToggleViewModel(preferencesService: preferencesService)
        
        // Then: State should be restored correctly
        XCTAssertTrue(newViewModel.isServiceEnabled)
        XCTAssertEqual(newViewModel.callsScreenedToday, 8)
        XCTAssertEqual(newViewModel.spamCallsBlocked, 2)
        XCTAssertEqual(newViewModel.connectionStatus, .connected)
        XCTAssertEqual(newViewModel.statusMessage, "Service active")
    }
    
    func testWidgetCanAccessDataAfterAppTermination() {
        // Given: App saves state and terminates
        let appState = ServiceState(
            isEnabled: true,
            callsScreenedToday: 12,
            spamCallsBlocked: 4,
            connectionStatus: .connected,
            statusMessage: "Service active"
        )
        preferencesService.saveServiceState(appState)
        
        // When: Widget loads data (app may be terminated)
        let widgetPreferencesService = SharedPreferencesService.shared
        let loadedState = widgetPreferencesService.loadServiceState()
        
        // Then: Widget should be able to access the saved data
        XCTAssertTrue(loadedState.isEnabled)
        XCTAssertEqual(loadedState.callsScreenedToday, 12)
        XCTAssertEqual(loadedState.spamCallsBlocked, 4)
        XCTAssertEqual(loadedState.connectionStatus, .connected)
    }
    
    // MARK: - Error Handling Tests
    
    func testWidgetHandlesCorruptedData() {
        // Given: Corrupted data in UserDefaults
        let userDefaults = UserDefaults(suiteName: "group.com.projectfriday.app")
        userDefaults?.set("corrupted_json", forKey: "service_state")
        
        // When: Widget tries to load state
        let loadedState = preferencesService.loadServiceState()
        
        // Then: Should return default state instead of crashing
        XCTAssertFalse(loadedState.isEnabled)
        XCTAssertEqual(loadedState.connectionStatus, .disconnected)
        XCTAssertEqual(loadedState.callsScreenedToday, 0)
        XCTAssertEqual(loadedState.spamCallsBlocked, 0)
    }
    
    func testWidgetHandlesMissingAppGroupAccess() {
        // This test would be more relevant in actual device testing
        // where app group access might be denied
        
        // Given: No saved data exists
        preferencesService.clearServiceState()
        
        // When: Widget tries to load state
        let loadedState = preferencesService.loadServiceState()
        
        // Then: Should return default state gracefully
        XCTAssertFalse(loadedState.isEnabled)
        XCTAssertEqual(loadedState.connectionStatus, .disconnected)
        XCTAssertEqual(loadedState.statusMessage, "Service disabled")
    }
    
    // MARK: - Performance Tests
    
    func testDataSyncPerformance() {
        // Measure the performance of saving and loading state
        let state = ServiceState(
            isEnabled: true,
            callsScreenedToday: 100,
            spamCallsBlocked: 25,
            connectionStatus: .connected,
            statusMessage: "Service active"
        )
        
        measure {
            // Simulate multiple save/load cycles
            for _ in 0..<100 {
                preferencesService.saveServiceState(state)
                _ = preferencesService.loadServiceState()
            }
        }
    }
    
    func testWidgetTimelineGenerationPerformance() {
        // Given: Service state with typical data
        let state = ServiceState(
            isEnabled: true,
            callsScreenedToday: 20,
            spamCallsBlocked: 5,
            connectionStatus: .connected,
            statusMessage: "Service active"
        )
        preferencesService.saveServiceState(state)
        
        let timelineProvider = ServiceStatusTimelineProvider(preferencesService: preferencesService)
        
        // Measure timeline generation performance
        measure {
            let expectation = XCTestExpectation(description: "Timeline generation")
            
            timelineProvider.getTimeline(in: Context()) { result in
                switch result {
                case .success(let timeline):
                    XCTAssertFalse(timeline.entries.isEmpty)
                case .failure(let error):
                    XCTFail("Timeline generation failed: \(error)")
                }
                expectation.fulfill()
            }
            
            wait(for: [expectation], timeout: 0.1)
        }
    }
    
    // MARK: - Widget Refresh Policy Tests
    
    func testWidgetRefreshPolicyBasedOnAppState() {
        let timelineProvider = ServiceStatusTimelineProvider(preferencesService: preferencesService)
        
        // Test different states produce appropriate refresh intervals
        let disabledState = ServiceState()
        let disabledInterval = timelineProvider.getRefreshInterval(for: disabledState)
        XCTAssertEqual(disabledInterval, 30 * 60) // 30 minutes
        
        let enabledState = ServiceState(isEnabled: true, connectionStatus: .connected)
        let enabledInterval = timelineProvider.getRefreshInterval(for: enabledState)
        XCTAssertEqual(enabledInterval, 15 * 60) // 15 minutes
        
        let errorState = ServiceState(connectionStatus: .error)
        let errorInterval = timelineProvider.getRefreshInterval(for: errorState)
        XCTAssertEqual(errorInterval, 5 * 60) // 5 minutes for retry
    }
}