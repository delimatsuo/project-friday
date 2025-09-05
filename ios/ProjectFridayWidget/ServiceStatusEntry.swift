import WidgetKit
import SwiftUI

/// Widget timeline entry containing service status information
struct ServiceStatusEntry: TimelineEntry {
    let date: Date
    let serviceState: ServiceState
    let relevance: TimelineEntryRelevance?
    
    init(date: Date, serviceState: ServiceState, relevance: TimelineEntryRelevance? = nil) {
        self.date = date
        self.serviceState = serviceState
        self.relevance = relevance
    }
    
    /// Create a placeholder entry for widget previews
    static func placeholder() -> ServiceStatusEntry {
        return ServiceStatusEntry(
            date: Date(),
            serviceState: ServiceState(
                isEnabled: false,
                callsScreenedToday: 0,
                spamCallsBlocked: 0,
                connectionStatus: .disconnected,
                statusMessage: "Service disabled"
            )
        )
    }
    
    /// Create a sample entry for widget selection UI
    static func sample() -> ServiceStatusEntry {
        return ServiceStatusEntry(
            date: Date(),
            serviceState: ServiceState(
                isEnabled: true,
                callsScreenedToday: 12,
                spamCallsBlocked: 4,
                connectionStatus: .connected,
                statusMessage: "Service active"
            )
        )
    }
}

/// Extension to provide relevance scoring for timeline entries
extension ServiceStatusEntry {
    /// Calculate relevance score based on service state
    var calculatedRelevance: TimelineEntryRelevance {
        var score: Float = 0.0
        var duration: TimeInterval = 60 * 15 // 15 minutes default
        
        // Higher relevance for active service
        if serviceState.isEnabled {
            score += 0.5
            duration = 60 * 10 // 10 minutes for active service
        }
        
        // Higher relevance for connection issues
        if serviceState.connectionStatus == .error {
            score += 0.3
            duration = 60 * 5 // 5 minutes for errors
        }
        
        // Higher relevance for recent activity
        if serviceState.callsScreenedToday > 0 {
            score += 0.2
        }
        
        return TimelineEntryRelevance(score: score, duration: duration)
    }
}