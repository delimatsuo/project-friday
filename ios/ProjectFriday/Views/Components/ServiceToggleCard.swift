import SwiftUI
import WidgetKit

struct ServiceToggleCard: View {
    @ObservedObject var viewModel: ServiceToggleViewModel
    @State private var showingConnectionDetails = false
    
    var body: some View {
        VStack(spacing: 16) {
            // Main Toggle Section
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Call Screening")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        if viewModel.isToggling {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                    }
                    
                    Text(serviceStatusText)
                        .font(.caption)
                        .foregroundColor(serviceStatusColor)
                    
                    Text(viewModel.statusMessage)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                VStack(spacing: 8) {
                    // Enhanced Toggle Button
                    Button(action: {
                        withAnimation(.spring()) {
                            viewModel.toggleService()
                            
                            // Refresh widgets when state changes
                            WidgetCenter.shared.reloadAllTimelines()
                        }
                    }) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(viewModel.isServiceEnabled ? .green : .gray)
                                .frame(width: 60, height: 32)
                            
                            Circle()
                                .fill(.white)
                                .frame(width: 28, height: 28)
                                .offset(x: viewModel.isServiceEnabled ? 14 : -14)
                                .shadow(radius: 2)
                        }
                    }
                    .disabled(viewModel.isToggling)
                    .scaleEffect(viewModel.isToggling ? 0.95 : 1.0)
                    .animation(.spring(), value: viewModel.isServiceEnabled)
                    
                    // Connection Status Indicator
                    connectionStatusIndicator
                }
            }
            
            // Expanded Information
            if viewModel.isServiceEnabled {
                VStack(alignment: .leading, spacing: 12) {
                    // Service Information
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Your AI assistant is actively screening incoming calls and will notify you of important ones.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        // Connection Details
                        HStack {
                            connectionStatusIcon
                                .font(.caption)
                            
                            Text(connectionStatusText)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            Button("Details") {
                                showingConnectionDetails = true
                            }
                            .font(.caption)
                            .foregroundColor(.blue)
                        }
                    }
                    
                    // Real-time Statistics (if service is active)
                    if viewModel.isServiceActive {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Active Session")
                                    .font(.caption2)
                                    .fontWeight(.medium)
                                    .foregroundColor(.green)
                                
                                Text("Monitoring all incoming calls")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            HStack(spacing: 16) {
                                if viewModel.callsScreenedToday > 0 {
                                    VStack {
                                        Text("\(viewModel.callsScreenedToday)")
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(.blue)
                                        Text("Screened")
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                
                                if viewModel.spamCallsBlocked > 0 {
                                    VStack {
                                        Text("\(viewModel.spamCallsBlocked)")
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(.red)
                                        Text("Blocked")
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                        .padding(8)
                        .background(Color(.systemGray6).opacity(0.5))
                        .cornerRadius(8)
                    }
                }
            } else {
                // Service disabled information
                HStack {
                    Image(systemName: "info.circle")
                        .foregroundColor(.orange)
                        .font(.caption)
                    
                    Text("Enable call screening to protect against unwanted calls")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
        .sheet(isPresented: $showingConnectionDetails) {
            ConnectionDetailsView(viewModel: viewModel)
        }
        .onAppear {
            // Refresh service state when view appears
            viewModel.refreshServiceState()
        }
    }
    
    // MARK: - Computed Properties
    
    private var serviceStatusText: String {
        switch (viewModel.isServiceEnabled, viewModel.connectionStatus) {
        case (true, .connected):
            return "Active & Connected"
        case (true, .connecting):
            return "Connecting..."
        case (true, .error):
            return "Connection Error"
        case (true, .disconnected):
            return "Enabled - Offline"
        case (false, _):
            return "Disabled"
        }
    }
    
    private var serviceStatusColor: Color {
        switch (viewModel.isServiceEnabled, viewModel.connectionStatus) {
        case (true, .connected):
            return .green
        case (true, .connecting):
            return .orange
        case (true, .error):
            return .red
        case (true, .disconnected):
            return .yellow
        case (false, _):
            return .gray
        }
    }
    
    private var connectionStatusIcon: Image {
        switch viewModel.connectionStatus {
        case .connected:
            return Image(systemName: "checkmark.circle.fill")
        case .connecting:
            return Image(systemName: "ellipsis.circle")
        case .error:
            return Image(systemName: "exclamationmark.triangle.fill")
        case .disconnected:
            return Image(systemName: "xmark.circle")
        }
    }
    
    private var connectionStatusText: String {
        switch viewModel.connectionStatus {
        case .connected:
            return "Connected to backend service"
        case .connecting:
            return "Establishing connection..."
        case .error:
            return "Unable to connect - Check network"
        case .disconnected:
            return "Not connected"
        }
    }
    
    private var connectionStatusIndicator: some View {
        VStack {
            Circle()
                .fill(serviceStatusColor)
                .frame(width: 8, height: 8)
                .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), 
                          value: viewModel.connectionStatus == .connecting)
            
            Text(viewModel.connectionStatus.displayName)
                .font(.caption2)
                .foregroundColor(serviceStatusColor)
        }
    }
}

// MARK: - Connection Details View

struct ConnectionDetailsView: View {
    @ObservedObject var viewModel: ServiceToggleViewModel
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            List {
                Section("Service Status") {
                    StatusRow(title: "Service State", 
                             value: viewModel.isServiceEnabled ? "Enabled" : "Disabled",
                             color: viewModel.isServiceEnabled ? .green : .gray)
                    
                    StatusRow(title: "Connection", 
                             value: viewModel.connectionStatus.displayName,
                             color: connectionColor)
                    
                    StatusRow(title: "Last Updated", 
                             value: formatLastUpdated(),
                             color: .secondary)
                }
                
                Section("Today's Activity") {
                    StatRow(title: "Calls Screened", 
                           value: viewModel.callsScreenedToday,
                           color: .blue)
                    
                    StatRow(title: "Spam Calls Blocked", 
                           value: viewModel.spamCallsBlocked,
                           color: .red)
                    
                    StatRow(title: "Legitimate Calls", 
                           value: max(0, viewModel.callsScreenedToday - viewModel.spamCallsBlocked),
                           color: .green)
                }
                
                Section("Actions") {
                    Button("Refresh Status") {
                        viewModel.refreshServiceState()
                    }
                    
                    Button("Reset Daily Statistics") {
                        viewModel.resetDailyStatistics()
                    }
                    .foregroundColor(.orange)
                }
            }
            .navigationTitle("Connection Details")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: 
                Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
    
    private var connectionColor: Color {
        switch viewModel.connectionStatus {
        case .connected: return .green
        case .connecting: return .orange
        case .error: return .red
        case .disconnected: return .gray
        }
    }
    
    private func formatLastUpdated() -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: Date(), relativeTo: Date())
    }
}

// MARK: - Supporting Views

struct StatusRow: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack {
            Text(title)
                .foregroundColor(.primary)
            Spacer()
            Text(value)
                .foregroundColor(color)
                .fontWeight(.medium)
        }
    }
}

struct StatRow: View {
    let title: String
    let value: Int
    let color: Color
    
    var body: some View {
        HStack {
            Text(title)
                .foregroundColor(.primary)
            Spacer()
            Text("\(value)")
                .foregroundColor(color)
                .fontWeight(.bold)
        }
    }
}

// MARK: - Preview

#Preview {
    ServiceToggleCard(viewModel: ServiceToggleViewModel())
        .padding()
        .background(Color(.systemBackground))
}