import WidgetKit
import SwiftUI

/// Main widget entry point
struct ProjectFridayWidget: Widget {
    let kind: String = "ProjectFridayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ServiceStatusTimelineProvider()) { entry in
            ServiceStatusWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Service Status")
        .description("Monitor and control your call screening service.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

/// Widget bundle for multiple widget types
@main
struct ProjectFridayWidgetBundle: WidgetBundle {
    var body: some Widget {
        ProjectFridayWidget()
        if #available(iOS 16.0, *) {
            ServiceToggleWidget()
        }
    }
}

/// Interactive toggle widget (iOS 16+ only)
@available(iOS 16.0, *)
struct ServiceToggleWidget: Widget {
    let kind: String = "ServiceToggleWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ServiceStatusTimelineProvider()) { entry in
            ServiceToggleWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Service Toggle")
        .description("Quick toggle for your call screening service.")
        .supportedFamilies([.systemSmall])
    }
}