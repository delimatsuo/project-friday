import AppIntents
import WidgetKit

/// App Intent for toggling service from widget (iOS 16+)
@available(iOS 16.0, *)
struct ToggleServiceIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Call Screening Service"
    static var description = IntentDescription("Toggle the call screening service on or off.")
    
    func perform() async throws -> some IntentResult {
        // Load current state
        let preferencesService = SharedPreferencesService.shared
        let currentState = preferencesService.loadServiceState()
        
        // Toggle the service state
        let newState = ServiceState(
            isEnabled: !currentState.isEnabled,
            lastUpdated: Date(),
            callsScreenedToday: currentState.callsScreenedToday,
            spamCallsBlocked: currentState.spamCallsBlocked,
            connectionStatus: !currentState.isEnabled ? .connecting : .disconnected,
            statusMessage: !currentState.isEnabled ? "Connecting to service..." : "Service disabled"
        )
        
        // Save the new state
        preferencesService.saveServiceState(newState)
        
        // Reload widget timeline
        WidgetCenter.shared.reloadAllTimelines()
        
        // Return result with confirmation message
        let message = newState.isEnabled ? "Call screening enabled" : "Call screening disabled"
        return .result(value: newState.isEnabled, dialog: IntentDialog(message))
    }
}

/// App Intent for opening the main app
@available(iOS 16.0, *)
struct OpenAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Project Friday"
    static var description = IntentDescription("Open the Project Friday app.")
    
    func perform() async throws -> some IntentResult {
        // This will open the main app
        return .result(opensIntent: OpenAppIntent())
    }
}

/// Configuration intent for widget customization
@available(iOS 16.0, *)
struct WidgetConfigurationIntent: AppIntent, WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Configure Widget"
    static var description = IntentDescription("Configure widget display options.")
    
    @Parameter(title: "Display Style")
    var displayStyle: WidgetDisplayStyle
    
    @Parameter(title: "Show Connection Status")
    var showConnectionStatus: Bool
    
    @Parameter(title: "Enable Dark Mode")
    var enableDarkMode: Bool
    
    init() {
        self.displayStyle = .withStatistics
        self.showConnectionStatus = true
        self.enableDarkMode = false
    }
    
    func perform() async throws -> some IntentResult {
        return .result()
    }
}

/// Widget display style options
@available(iOS 16.0, *)
enum WidgetDisplayStyle: String, AppEnum, CaseIterable {
    case statusOnly = "status_only"
    case withStatistics = "with_statistics"
    case detailedView = "detailed_view"
    
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(name: "Widget Display Style")
    }
    
    static var caseDisplayRepresentations: [WidgetDisplayStyle: DisplayRepresentation] {
        [
            .statusOnly: DisplayRepresentation(
                title: "Status Only",
                subtitle: "Show just the service status"
            ),
            .withStatistics: DisplayRepresentation(
                title: "With Statistics",
                subtitle: "Show status and daily stats"
            ),
            .detailedView: DisplayRepresentation(
                title: "Detailed View",
                subtitle: "Show all available information"
            )
        ]
    }
}

/// App Shortcuts for Siri integration
@available(iOS 16.0, *)
struct ProjectFridayShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ToggleServiceIntent(),
            phrases: [
                "Toggle call screening with \(.applicationName)",
                "Turn on call screening",
                "Turn off call screening",
                "Enable Project Friday",
                "Disable Project Friday"
            ],
            shortTitle: "Toggle Service",
            systemImageName: "shield.checkered"
        )
    }
}

/// Widget URL handler for deep linking
struct WidgetURLHandler {
    static func handle(url: URL) {
        guard let scheme = url.scheme, scheme == "projectfriday" else {
            return
        }
        
        switch url.host {
        case "toggle-service":
            // Handle service toggle from small widget
            toggleServiceFromWidget()
            
        case "open-app":
            // Handle opening app from medium/large widget
            // The app will handle this in AppDelegate or SceneDelegate
            break
            
        case "open-settings":
            // Handle opening settings
            break
            
        default:
            break
        }
    }
    
    private static func toggleServiceFromWidget() {
        let preferencesService = SharedPreferencesService.shared
        let currentState = preferencesService.loadServiceState()
        
        let newState = ServiceState(
            isEnabled: !currentState.isEnabled,
            lastUpdated: Date(),
            callsScreenedToday: currentState.callsScreenedToday,
            spamCallsBlocked: currentState.spamCallsBlocked,
            connectionStatus: !currentState.isEnabled ? .connecting : .disconnected,
            statusMessage: !currentState.isEnabled ? "Connecting to service..." : "Service disabled"
        )
        
        preferencesService.saveServiceState(newState)
        WidgetCenter.shared.reloadAllTimelines()
    }
}