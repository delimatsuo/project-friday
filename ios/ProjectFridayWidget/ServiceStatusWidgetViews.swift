import SwiftUI
import WidgetKit

// MARK: - Main Widget Entry View

struct ServiceStatusWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme
    
    var entry: ServiceStatusEntry
    
    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                SmallWidgetView(entry: entry)
            case .systemMedium:
                MediumWidgetView(entry: entry)
            case .systemLarge:
                LargeWidgetView(entry: entry)
            default:
                SmallWidgetView(entry: entry)
            }
        }
        .widgetBackground()
    }
}

// MARK: - Small Widget View

struct SmallWidgetView: View {
    let entry: ServiceStatusEntry
    
    var body: some View {
        VStack(spacing: 8) {
            // Status Icon
            ZStack {
                Circle()
                    .fill(statusColor.opacity(0.2))
                    .frame(width: 40, height: 40)
                
                Image(systemName: statusIcon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(statusColor)
            }
            
            // Service Status
            Text(serviceStatusText)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.primary)
                .multilineTextAlignment(.center)
            
            // Connection Status
            if entry.serviceState.isEnabled {
                Text(entry.serviceState.connectionStatus.displayName)
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.secondary)
            } else {
                Text("Tap to enable")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.secondary)
            }
        }
        .padding(12)
        .widgetURL(URL(string: "projectfriday://toggle-service"))
    }
    
    private var statusColor: Color {
        switch (entry.serviceState.isEnabled, entry.serviceState.connectionStatus) {
        case (true, .connected):
            return .green
        case (true, .connecting):
            return .orange
        case (true, .error):
            return .red
        case (false, _):
            return .gray
        default:
            return .gray
        }
    }
    
    private var statusIcon: String {
        switch (entry.serviceState.isEnabled, entry.serviceState.connectionStatus) {
        case (true, .connected):
            return "shield.checkered"
        case (true, .connecting):
            return "shield"
        case (true, .error):
            return "shield.slash"
        case (false, _):
            return "shield.slash.fill"
        default:
            return "shield.slash.fill"
        }
    }
    
    private var serviceStatusText: String {
        if entry.serviceState.isEnabled {
            return "Call Screening\nActive"
        } else {
            return "Call Screening\nDisabled"
        }
    }
}

// MARK: - Medium Widget View

struct MediumWidgetView: View {
    let entry: ServiceStatusEntry
    
    var body: some View {
        HStack(spacing: 16) {
            // Status Section
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: statusIcon)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(statusColor)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Call Screening")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                        
                        Text(entry.serviceState.isEnabled ? "Active" : "Disabled")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(statusColor)
                    }
                }
                
                Text(entry.serviceState.connectionStatus.displayName)
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.secondary)
                
                if entry.serviceState.isEnabled {
                    Text("Last updated: \(formatTime(entry.serviceState.lastUpdated))")
                        .font(.system(size: 9, weight: .regular))
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Statistics Section
            VStack(alignment: .trailing, spacing: 8) {
                StatisticView(
                    title: "Calls Screened",
                    value: "\(entry.serviceState.callsScreenedToday)",
                    color: .blue
                )
                
                StatisticView(
                    title: "Spam Blocked",
                    value: "\(entry.serviceState.spamCallsBlocked)",
                    color: .red
                )
            }
        }
        .padding(16)
        .widgetURL(URL(string: "projectfriday://open-app"))
    }
    
    private var statusColor: Color {
        switch (entry.serviceState.isEnabled, entry.serviceState.connectionStatus) {
        case (true, .connected):
            return .green
        case (true, .connecting):
            return .orange
        case (true, .error):
            return .red
        case (false, _):
            return .gray
        default:
            return .gray
        }
    }
    
    private var statusIcon: String {
        switch (entry.serviceState.isEnabled, entry.serviceState.connectionStatus) {
        case (true, .connected):
            return "shield.checkered"
        case (true, .connecting):
            return "shield"
        case (true, .error):
            return "shield.slash"
        case (false, _):
            return "shield.slash.fill"
        default:
            return "shield.slash.fill"
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Large Widget View

struct LargeWidgetView: View {
    let entry: ServiceStatusEntry
    
    var body: some View {
        VStack(spacing: 16) {
            // Header Section
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "phone.circle.fill")
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(.blue)
                        
                        Text("Project Friday")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.primary)
                    }
                    
                    Text("AI Call Screening Service")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text(formatDate(entry.date))
                        .font(.system(size: 10, weight: .regular))
                        .foregroundColor(.secondary)
                    
                    Text(formatTime(entry.date))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.primary)
                }
            }
            
            // Status Card
            HStack(spacing: 16) {
                // Status Icon and Info
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(statusColor.opacity(0.2))
                            .frame(width: 50, height: 50)
                        
                        Image(systemName: statusIcon)
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(statusColor)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Service Status")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.secondary)
                        
                        Text(entry.serviceState.isEnabled ? "Active" : "Disabled")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.primary)
                        
                        Text(entry.serviceState.connectionStatus.displayName)
                            .font(.system(size: 11, weight: .regular))
                            .foregroundColor(statusColor)
                    }
                }
                
                Spacer()
                
                // Toggle Indicator
                if entry.serviceState.isEnabled {
                    VStack(spacing: 4) {
                        Circle()
                            .fill(.green)
                            .frame(width: 8, height: 8)
                        
                        Text("ON")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.green)
                    }
                } else {
                    VStack(spacing: 4) {
                        Circle()
                            .fill(.red)
                            .frame(width: 8, height: 8)
                        
                        Text("OFF")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.red)
                    }
                }
            }
            .padding(12)
            .background(Color(.systemGray6))
            .cornerRadius(12)
            
            // Statistics Section
            VStack(spacing: 8) {
                Text("Today's Activity")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                HStack(spacing: 16) {
                    DetailedStatisticView(
                        title: "Calls Screened",
                        value: "\(entry.serviceState.callsScreenedToday)",
                        subtitle: "Total calls processed",
                        color: .blue,
                        icon: "phone.arrow.down.left"
                    )
                    
                    DetailedStatisticView(
                        title: "Spam Blocked",
                        value: "\(entry.serviceState.spamCallsBlocked)",
                        subtitle: "Unwanted calls stopped",
                        color: .red,
                        icon: "hand.raised.fill"
                    )
                }
            }
            
            Spacer()
            
            // Footer
            Text(entry.serviceState.statusMessage)
                .font(.system(size: 11, weight: .regular))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(16)
        .widgetURL(URL(string: "projectfriday://open-app"))
    }
    
    private var statusColor: Color {
        switch (entry.serviceState.isEnabled, entry.serviceState.connectionStatus) {
        case (true, .connected):
            return .green
        case (true, .connecting):
            return .orange
        case (true, .error):
            return .red
        case (false, _):
            return .gray
        default:
            return .gray
        }
    }
    
    private var statusIcon: String {
        switch (entry.serviceState.isEnabled, entry.serviceState.connectionStatus) {
        case (true, .connected):
            return "shield.checkered"
        case (true, .connecting):
            return "shield"
        case (true, .error):
            return "shield.slash"
        case (false, _):
            return "shield.slash.fill"
        default:
            return "shield.slash.fill"
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Interactive Toggle Widget (iOS 16+)

@available(iOS 16.0, *)
struct ServiceToggleWidgetView: View {
    let entry: ServiceStatusEntry
    
    var body: some View {
        VStack(spacing: 8) {
            // Toggle Button
            Button(intent: ToggleServiceIntent()) {
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(entry.serviceState.isEnabled ? .green : .gray)
                        .frame(height: 40)
                    
                    HStack {
                        Image(systemName: entry.serviceState.isEnabled ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(.white)
                        
                        Text(entry.serviceState.isEnabled ? "ON" : "OFF")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
            }
            .buttonStyle(.plain)
            
            // Status Text
            Text("Call Screening")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.primary)
            
            if entry.serviceState.isEnabled {
                Text(entry.serviceState.connectionStatus.displayName)
                    .font(.system(size: 10, weight: .regular))
                    .foregroundColor(.secondary)
            }
        }
        .padding(12)
    }
}

// MARK: - Supporting Views

struct StatisticView: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(color)
            
            Text(title)
                .font(.system(size: 9, weight: .regular))
                .foregroundColor(.secondary)
        }
    }
}

struct DetailedStatisticView: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    let icon: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(color)
                
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.primary)
            }
            
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(color)
            
            Text(subtitle)
                .font(.system(size: 9, weight: .regular))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
}

// MARK: - Widget Background Extension

extension View {
    func widgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            return containerBackground(.fill.tertiary, for: .widget)
        } else {
            return background()
        }
    }
}

// MARK: - Widget Previews

struct ServiceStatusWidgetEntryView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Small Widget - Disabled
            ServiceStatusWidgetEntryView(entry: ServiceStatusEntry.placeholder())
                .previewContext(WidgetPreviewContext(family: .systemSmall))
                .previewDisplayName("Small - Disabled")
            
            // Small Widget - Enabled
            ServiceStatusWidgetEntryView(entry: ServiceStatusEntry.sample())
                .previewContext(WidgetPreviewContext(family: .systemSmall))
                .previewDisplayName("Small - Enabled")
            
            // Medium Widget - Enabled
            ServiceStatusWidgetEntryView(entry: ServiceStatusEntry.sample())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
                .previewDisplayName("Medium - Enabled")
            
            // Large Widget - Enabled
            ServiceStatusWidgetEntryView(entry: ServiceStatusEntry.sample())
                .previewContext(WidgetPreviewContext(family: .systemLarge))
                .previewDisplayName("Large - Enabled")
        }
    }
}