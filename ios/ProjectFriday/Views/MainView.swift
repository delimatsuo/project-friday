import SwiftUI

struct MainView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Home/Dashboard Tab
            HomeView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Home")
                }
                .tag(0)
            
            // Call Log Tab
            CallLogView()
                .tabItem {
                    Image(systemName: "phone.fill")
                    Text("Calls")
                }
                .tag(1)
            
            // Settings Tab
            SettingsView()
                .tabItem {
                    Image(systemName: "gearshape.fill")
                    Text("Settings")
                }
                .tag(2)
        }
        .accentColor(.blue)
    }
}

// MARK: - Home View

struct HomeView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    @State private var isCallScreeningEnabled = true
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Welcome Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Welcome back")
                                    .font(.title2)
                                    .foregroundColor(.secondary)
                                
                                Text(authViewModel.currentUser?.displayName ?? "User")
                                    .font(.largeTitle)
                                    .fontWeight(.bold)
                            }
                            
                            Spacer()
                            
                            // Profile Image Placeholder
                            Circle()
                                .fill(Color.blue.opacity(0.2))
                                .frame(width: 60, height: 60)
                                .overlay(
                                    Text(authViewModel.currentUser?.displayName?.prefix(1).uppercased() ?? "U")
                                        .font(.title2)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.blue)
                                )
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    
                    // Call Screening Toggle Card
                    VStack(spacing: 16) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Call Screening")
                                    .font(.headline)
                                    .fontWeight(.semibold)
                                
                                Text(isCallScreeningEnabled ? "Active" : "Disabled")
                                    .font(.caption)
                                    .foregroundColor(isCallScreeningEnabled ? .green : .red)
                            }
                            
                            Spacer()
                            
                            Toggle("", isOn: $isCallScreeningEnabled)
                                .toggleStyle(SwitchToggleStyle(tint: .blue))
                        }
                        
                        if isCallScreeningEnabled {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Your AI assistant is screening incoming calls and will notify you of important ones.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                        .font(.caption)
                                    Text("Connected to Twilio")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)
                    .padding(.horizontal)
                    
                    // Quick Stats
                    HStack(spacing: 16) {
                        StatCard(title: "Calls Screened", value: "24", subtitle: "This week", color: .blue)
                        StatCard(title: "Spam Blocked", value: "8", subtitle: "This week", color: .red)
                    }
                    .padding(.horizontal)
                    
                    // Recent Activity
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Recent Activity")
                                .font(.headline)
                                .fontWeight(.semibold)
                            
                            Spacer()
                            
                            Button("View All") {
                                // Navigate to call log
                            }
                            .font(.caption)
                            .foregroundColor(.blue)
                        }
                        
                        VStack(spacing: 8) {
                            RecentCallRow(
                                callerName: "John Smith",
                                time: "2 hours ago",
                                status: .allowed,
                                reason: "Known contact"
                            )
                            
                            RecentCallRow(
                                callerName: "Unknown Number",
                                time: "Yesterday",
                                status: .screened,
                                reason: "Potential spam"
                            )
                            
                            RecentCallRow(
                                callerName: "Dr. Johnson",
                                time: "2 days ago",
                                status: .allowed,
                                reason: "Medical appointment"
                            )
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer(minLength: 100)
                }
            }
            .navigationTitle("")
            .navigationBarHidden(true)
        }
    }
}

// MARK: - Call Log View

struct CallLogView: View {
    var body: some View {
        NavigationStack {
            List {
                ForEach(0..<10) { index in
                    RecentCallRow(
                        callerName: "Caller \(index + 1)",
                        time: "\(index + 1) hours ago",
                        status: index % 3 == 0 ? .blocked : (index % 2 == 0 ? .screened : .allowed),
                        reason: "Sample reason"
                    )
                }
            }
            .navigationTitle("Call Log")
        }
    }
}

// MARK: - Settings View

struct SettingsView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    
    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    HStack {
                        Text("Email")
                        Spacer()
                        Text(authViewModel.currentUser?.email ?? "")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Display Name")
                        Spacer()
                        Text(authViewModel.currentUser?.displayName ?? "Not set")
                            .foregroundColor(.secondary)
                    }
                }
                
                Section("Call Screening") {
                    NavigationLink("Screening Settings") {
                        Text("Screening Settings")
                    }
                    
                    NavigationLink("Blocked Numbers") {
                        Text("Blocked Numbers")
                    }
                    
                    NavigationLink("Allowed Contacts") {
                        Text("Allowed Contacts")
                    }
                }
                
                Section("Notifications") {
                    NavigationLink("Push Notifications") {
                        Text("Push Notifications")
                    }
                }
                
                Section("Support") {
                    NavigationLink("Help & FAQ") {
                        Text("Help & FAQ")
                    }
                    
                    NavigationLink("Contact Support") {
                        Text("Contact Support")
                    }
                }
                
                Section {
                    Button("Sign Out") {
                        authViewModel.signOut()
                    }
                    .foregroundColor(.red)
                }
            }
            .navigationTitle("Settings")
        }
    }
}

// MARK: - Supporting Views

struct StatCard: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(subtitle)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct RecentCallRow: View {
    let callerName: String
    let time: String
    let status: CallStatus
    let reason: String
    
    var body: some View {
        HStack {
            // Status Icon
            Circle()
                .fill(status.color.opacity(0.2))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: status.iconName)
                        .foregroundColor(status.color)
                        .font(.system(size: 16))
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text(callerName)
                    .font(.body)
                    .fontWeight(.medium)
                
                Text(reason)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(time)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(status.displayName)
                    .font(.caption2)
                    .foregroundColor(status.color)
            }
        }
        .padding(.vertical, 4)
    }
}

enum CallStatus {
    case allowed, blocked, screened
    
    var color: Color {
        switch self {
        case .allowed: return .green
        case .blocked: return .red
        case .screened: return .orange
        }
    }
    
    var iconName: String {
        switch self {
        case .allowed: return "checkmark.circle.fill"
        case .blocked: return "xmark.circle.fill"
        case .screened: return "exclamationmark.triangle.fill"
        }
    }
    
    var displayName: String {
        switch self {
        case .allowed: return "Allowed"
        case .blocked: return "Blocked"
        case .screened: return "Screened"
        }
    }
}

#Preview {
    MainView()
        .environmentObject(AuthenticationViewModel())
}