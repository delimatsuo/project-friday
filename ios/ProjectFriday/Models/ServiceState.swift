import Foundation

/// Represents the current state of the call screening service
struct ServiceState: Codable {
    /// Whether the call screening service is enabled
    let isEnabled: Bool
    
    /// Last time the service status was updated
    let lastUpdated: Date
    
    /// Number of calls screened today
    let callsScreenedToday: Int
    
    /// Number of spam calls blocked today
    let spamCallsBlocked: Int
    
    /// Current connection status to the backend service
    let connectionStatus: ConnectionStatus
    
    /// User-friendly status message
    let statusMessage: String
    
    init(
        isEnabled: Bool = false,
        lastUpdated: Date = Date(),
        callsScreenedToday: Int = 0,
        spamCallsBlocked: Int = 0,
        connectionStatus: ConnectionStatus = .disconnected,
        statusMessage: String = "Service disabled"
    ) {
        self.isEnabled = isEnabled
        self.lastUpdated = lastUpdated
        self.callsScreenedToday = callsScreenedToday
        self.spamCallsBlocked = spamCallsBlocked
        self.connectionStatus = connectionStatus
        self.statusMessage = statusMessage
    }
}

/// Connection status to the backend service
enum ConnectionStatus: String, Codable, CaseIterable {
    case connected = "connected"
    case connecting = "connecting"
    case disconnected = "disconnected"
    case error = "error"
    
    var displayName: String {
        switch self {
        case .connected:
            return "Connected"
        case .connecting:
            return "Connecting..."
        case .disconnected:
            return "Disconnected"
        case .error:
            return "Connection Error"
        }
    }
    
    var isActive: Bool {
        switch self {
        case .connected, .connecting:
            return true
        case .disconnected, .error:
            return false
        }
    }
}

/// Service to manage shared user preferences between app and widget
class SharedPreferencesService {
    static let shared = SharedPreferencesService()
    
    // App Group identifier for sharing data between app and widget
    private let appGroupIdentifier = "group.com.projectfriday.app"
    private let serviceStateKey = "service_state"
    
    private init() {}
    
    /// UserDefaults instance for the app group
    private var userDefaults: UserDefaults? {
        return UserDefaults(suiteName: appGroupIdentifier)
    }
    
    /// Save the current service state
    func saveServiceState(_ state: ServiceState) {
        guard let userDefaults = userDefaults else {
            print("Failed to access app group UserDefaults")
            return
        }
        
        do {
            let data = try JSONEncoder().encode(state)
            userDefaults.set(data, forKey: serviceStateKey)
            print("Service state saved successfully")
        } catch {
            print("Failed to save service state: \(error)")
        }
    }
    
    /// Load the current service state
    func loadServiceState() -> ServiceState {
        guard let userDefaults = userDefaults,
              let data = userDefaults.data(forKey: serviceStateKey) else {
            print("No saved service state found, returning default state")
            return ServiceState()
        }
        
        do {
            let state = try JSONDecoder().decode(ServiceState.self, from: data)
            return state
        } catch {
            print("Failed to load service state: \(error), returning default state")
            return ServiceState()
        }
    }
    
    /// Clear all saved data
    func clearServiceState() {
        guard let userDefaults = userDefaults else {
            return
        }
        userDefaults.removeObject(forKey: serviceStateKey)
        print("Service state cleared")
    }
}