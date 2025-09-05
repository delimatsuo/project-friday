import Foundation
import Combine

/// ViewModel responsible for managing call screening service toggle state
@MainActor
class ServiceToggleViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    /// Whether the call screening service is currently enabled
    @Published var isServiceEnabled: Bool = false
    
    /// Current connection status to the backend service
    @Published var connectionStatus: ConnectionStatus = .disconnected
    
    /// Number of calls screened today
    @Published var callsScreenedToday: Int = 0
    
    /// Number of spam calls blocked today
    @Published var spamCallsBlocked: Int = 0
    
    /// User-friendly status message
    @Published var statusMessage: String = "Service disabled"
    
    /// Whether the service is currently in a transition state
    @Published var isToggling: Bool = false
    
    // MARK: - Private Properties
    
    private let preferencesService: SharedPreferencesService
    private var cancellables = Set<AnyCancellable>()
    private var connectionTimer: Timer?
    
    // MARK: - Initialization
    
    init(preferencesService: SharedPreferencesService = SharedPreferencesService.shared) {
        self.preferencesService = preferencesService
        loadCurrentState()
        setupStateObservers()
    }
    
    // MARK: - Public Methods
    
    /// Toggle the call screening service on/off
    func toggleService() {
        isToggling = true
        
        let newState = !isServiceEnabled
        isServiceEnabled = newState
        
        if newState {
            enableService()
        } else {
            disableService()
        }
        
        saveCurrentState()
        
        // Reset toggling state after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.isToggling = false
        }
    }
    
    /// Update connection status (typically called from network layer)
    func updateConnectionStatus(_ status: ConnectionStatus) {
        connectionStatus = status
        updateStatusMessage()
        
        // If connection fails, disable service
        if status == .error {
            isServiceEnabled = false
        }
        
        saveCurrentState()
    }
    
    /// Update daily statistics
    func updateStatistics(callsScreened: Int, spamBlocked: Int) {
        callsScreenedToday = callsScreened
        spamCallsBlocked = spamBlocked
        saveCurrentState()
    }
    
    /// Reset daily statistics (called at start of new day)
    func resetDailyStatistics() {
        callsScreenedToday = 0
        spamCallsBlocked = 0
        saveCurrentState()
    }
    
    /// Refresh service state from backend
    func refreshServiceState() {
        guard isServiceEnabled else { return }
        
        connectionStatus = .connecting
        updateStatusMessage()
        
        // Simulate API call to check service status
        simulateBackendCheck()
    }
    
    // MARK: - Private Methods
    
    private func loadCurrentState() {
        let state = preferencesService.loadServiceState()
        
        isServiceEnabled = state.isEnabled
        connectionStatus = state.connectionStatus
        callsScreenedToday = state.callsScreenedToday
        spamCallsBlocked = state.spamCallsBlocked
        statusMessage = state.statusMessage
        
        // If service was enabled but app was closed, check connection
        if isServiceEnabled && connectionStatus == .connected {
            refreshServiceState()
        }
    }
    
    private func saveCurrentState() {
        let state = ServiceState(
            isEnabled: isServiceEnabled,
            lastUpdated: Date(),
            callsScreenedToday: callsScreenedToday,
            spamCallsBlocked: spamCallsBlocked,
            connectionStatus: connectionStatus,
            statusMessage: statusMessage
        )
        
        preferencesService.saveServiceState(state)
    }
    
    private func enableService() {
        connectionStatus = .connecting
        updateStatusMessage()
        
        // Simulate connection process
        simulateConnection()
    }
    
    private func disableService() {
        connectionStatus = .disconnected
        updateStatusMessage()
        
        // Cancel any ongoing connection attempts
        connectionTimer?.invalidate()
        connectionTimer = nil
    }
    
    private func simulateConnection() {
        // Simulate connection delay
        connectionTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.connectionStatus = .connected
                self?.updateStatusMessage()
                self?.saveCurrentState()
            }
        }
    }
    
    private func simulateBackendCheck() {
        // Simulate backend status check
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // In real implementation, this would make an API call
            self.connectionStatus = .connected
            self.updateStatusMessage()
            self.saveCurrentState()
        }
    }
    
    private func updateStatusMessage() {
        switch (isServiceEnabled, connectionStatus) {
        case (false, _):
            statusMessage = "Service disabled"
        case (true, .connecting):
            statusMessage = "Connecting to service..."
        case (true, .connected):
            statusMessage = "Service active - Screening calls"
        case (true, .error):
            statusMessage = "Connection error - Check network"
        case (true, .disconnected):
            statusMessage = "Service offline"
        }
    }
    
    private func setupStateObservers() {
        // Observe changes to update status message
        $isServiceEnabled
            .combineLatest($connectionStatus)
            .sink { [weak self] _, _ in
                self?.updateStatusMessage()
            }
            .store(in: &cancellables)
        
        // Auto-reset daily stats at midnight
        setupMidnightTimer()
    }
    
    private func setupMidnightTimer() {
        let calendar = Calendar.current
        let now = Date()
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: now)!
        let midnight = calendar.startOfDay(for: tomorrow)
        
        let timer = Timer(fireAt: midnight, interval: 24 * 60 * 60, target: self, selector: #selector(midnightReset), userInfo: nil, repeats: true)
        RunLoop.main.add(timer, forMode: .common)
    }
    
    @objc private func midnightReset() {
        resetDailyStatistics()
    }
    
    // MARK: - Computed Properties
    
    /// Whether the service is currently active and connected
    var isServiceActive: Bool {
        return isServiceEnabled && connectionStatus == .connected
    }
    
    /// Progress indicator value (0.0 to 1.0)
    var connectionProgress: Double {
        switch connectionStatus {
        case .disconnected:
            return 0.0
        case .connecting:
            return 0.5
        case .connected:
            return 1.0
        case .error:
            return 0.0
        }
    }
    
    /// Service status for widget display
    var serviceStatusForWidget: String {
        if isServiceEnabled {
            return connectionStatus.displayName
        } else {
            return "Disabled"
        }
    }
}

// MARK: - Extensions

extension ServiceToggleViewModel {
    /// Get current state for widget
    func getCurrentStateForWidget() -> ServiceState {
        return ServiceState(
            isEnabled: isServiceEnabled,
            lastUpdated: Date(),
            callsScreenedToday: callsScreenedToday,
            spamCallsBlocked: spamCallsBlocked,
            connectionStatus: connectionStatus,
            statusMessage: statusMessage
        )
    }
}