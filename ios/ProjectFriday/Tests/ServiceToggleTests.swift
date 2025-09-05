import XCTest
import Combine
@testable import ProjectFriday

class ServiceToggleTests: XCTestCase {
    var viewModel: ServiceToggleViewModel!
    var mockPreferencesService: MockSharedPreferencesService!
    var cancellables: Set<AnyCancellable>!
    
    override func setUp() {
        super.setUp()
        mockPreferencesService = MockSharedPreferencesService()
        viewModel = ServiceToggleViewModel(preferencesService: mockPreferencesService)
        cancellables = []
    }
    
    override func tearDown() {
        cancellables = nil
        viewModel = nil
        mockPreferencesService = nil
        super.tearDown()
    }
    
    // MARK: - Initial State Tests
    
    func testInitialState() {
        XCTAssertFalse(viewModel.isServiceEnabled)
        XCTAssertEqual(viewModel.connectionStatus, .disconnected)
        XCTAssertEqual(viewModel.callsScreenedToday, 0)
        XCTAssertEqual(viewModel.spamCallsBlocked, 0)
        XCTAssertEqual(viewModel.statusMessage, "Service disabled")
    }
    
    func testLoadExistingState() {
        // Given: Existing state in preferences
        let existingState = ServiceState(
            isEnabled: true,
            callsScreenedToday: 5,
            spamCallsBlocked: 2,
            connectionStatus: .connected,
            statusMessage: "Service active"
        )
        mockPreferencesService.savedState = existingState
        
        // When: ViewModel loads state
        let newViewModel = ServiceToggleViewModel(preferencesService: mockPreferencesService)
        
        // Then: State should be loaded correctly
        XCTAssertTrue(newViewModel.isServiceEnabled)
        XCTAssertEqual(newViewModel.connectionStatus, .connected)
        XCTAssertEqual(newViewModel.callsScreenedToday, 5)
        XCTAssertEqual(newViewModel.spamCallsBlocked, 2)
        XCTAssertEqual(newViewModel.statusMessage, "Service active")
    }
    
    // MARK: - Service Toggle Tests
    
    func testToggleServiceOn() {
        // Given: Service is initially off
        XCTAssertFalse(viewModel.isServiceEnabled)
        
        // When: Service is toggled on
        viewModel.toggleService()
        
        // Then: Service should be enabled and state should be saved
        XCTAssertTrue(viewModel.isServiceEnabled)
        XCTAssertEqual(viewModel.connectionStatus, .connecting)
        XCTAssertTrue(mockPreferencesService.saveStateWasCalled)
        XCTAssertTrue(mockPreferencesService.savedState?.isEnabled ?? false)
    }
    
    func testToggleServiceOff() {
        // Given: Service is initially on
        viewModel.toggleService() // Turn on first
        XCTAssertTrue(viewModel.isServiceEnabled)
        mockPreferencesService.saveStateWasCalled = false // Reset flag
        
        // When: Service is toggled off
        viewModel.toggleService()
        
        // Then: Service should be disabled and state should be saved
        XCTAssertFalse(viewModel.isServiceEnabled)
        XCTAssertEqual(viewModel.connectionStatus, .disconnected)
        XCTAssertTrue(mockPreferencesService.saveStateWasCalled)
        XCTAssertFalse(mockPreferencesService.savedState?.isEnabled ?? true)
    }
    
    // MARK: - Connection Status Tests
    
    func testConnectionStatusUpdates() {
        let expectation = XCTestExpectation(description: "Connection status updates")
        
        // Given: Service is off
        XCTAssertEqual(viewModel.connectionStatus, .disconnected)
        
        // When: Service is toggled on
        viewModel.toggleService()
        
        // Then: Should transition through connecting to connected
        XCTAssertEqual(viewModel.connectionStatus, .connecting)
        
        // Simulate connection success after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.viewModel.updateConnectionStatus(.connected)
            XCTAssertEqual(self.viewModel.connectionStatus, .connected)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testConnectionError() {
        // Given: Service is trying to connect
        viewModel.toggleService()
        XCTAssertEqual(viewModel.connectionStatus, .connecting)
        
        // When: Connection fails
        viewModel.updateConnectionStatus(.error)
        
        // Then: Status should show error and service should be disabled
        XCTAssertEqual(viewModel.connectionStatus, .error)
        XCTAssertFalse(viewModel.isServiceEnabled)
    }
    
    // MARK: - Statistics Tests
    
    func testUpdateStatistics() {
        // Given: Service is enabled
        viewModel.toggleService()
        
        // When: Statistics are updated
        viewModel.updateStatistics(callsScreened: 10, spamBlocked: 3)
        
        // Then: Statistics should be updated and saved
        XCTAssertEqual(viewModel.callsScreenedToday, 10)
        XCTAssertEqual(viewModel.spamCallsBlocked, 3)
        XCTAssertTrue(mockPreferencesService.saveStateWasCalled)
    }
    
    func testResetDailyStatistics() {
        // Given: Service has some statistics
        viewModel.updateStatistics(callsScreened: 5, spamBlocked: 2)
        XCTAssertEqual(viewModel.callsScreenedToday, 5)
        XCTAssertEqual(viewModel.spamCallsBlocked, 2)
        
        // When: Daily statistics are reset (simulating new day)
        viewModel.resetDailyStatistics()
        
        // Then: Statistics should be reset to zero
        XCTAssertEqual(viewModel.callsScreenedToday, 0)
        XCTAssertEqual(viewModel.spamCallsBlocked, 0)
        XCTAssertTrue(mockPreferencesService.saveStateWasCalled)
    }
    
    // MARK: - Status Message Tests
    
    func testStatusMessages() {
        // Test different status messages based on connection state
        
        // Disabled state
        XCTAssertEqual(viewModel.statusMessage, "Service disabled")
        
        // Connecting state
        viewModel.toggleService()
        XCTAssertTrue(viewModel.statusMessage.contains("Connecting"))
        
        // Connected state
        viewModel.updateConnectionStatus(.connected)
        XCTAssertTrue(viewModel.statusMessage.contains("Active"))
        
        // Error state
        viewModel.updateConnectionStatus(.error)
        XCTAssertTrue(viewModel.statusMessage.contains("Error"))
    }
}

// MARK: - Mock Classes

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