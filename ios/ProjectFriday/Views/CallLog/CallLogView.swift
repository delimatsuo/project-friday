import SwiftUI
import Firebase

struct CallLogView: View {
    @StateObject private var viewModel = CallLogViewModel()
    @EnvironmentObject private var authViewModel: AuthenticationViewModel
    @State private var showingDetailView = false
    @State private var selectedCall: CallLog?
    @State private var showingSearchBar = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search bar
                if showingSearchBar {
                    searchBar
                        .transition(.move(edge: .top))
                }
                
                // Main content
                ZStack {
                    if viewModel.isLoading && viewModel.callLogs.isEmpty {
                        loadingView
                    } else if viewModel.isEmptyState {
                        emptyStateView
                    } else if viewModel.isSearchResultEmpty {
                        searchEmptyView
                    } else {
                        callLogsList
                    }
                }
                .refreshable {
                    await refreshData()
                }
            }
            .navigationTitle("Call Log")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    // Search button
                    Button(action: toggleSearch) {
                        Image(systemName: showingSearchBar ? "xmark.circle.fill" : "magnifyingglass")
                    }
                    
                    // Mark all as read button
                    if viewModel.hasUnreadCalls {
                        Button("Mark All Read") {
                            Task {
                                await markAllAsRead()
                            }
                        }
                        .font(.caption)
                    }
                }
            }
            .onAppear {
                setupInitialData()
            }
            .onDisappear {
                viewModel.removeListener()
            }
        }
        .alert("Error", isPresented: $viewModel.showingError) {
            Button("OK") {
                viewModel.dismissError()
            }
            Button("Retry") {
                Task {
                    await refreshData()
                }
            }
        } message: {
            Text(viewModel.errorMessage)
        }
        .sheet(item: $selectedCall) { call in
            CallDetailView(callLog: call)
                .environmentObject(authViewModel)
        }
    }
    
    // MARK: - Search Bar
    
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            
            TextField("Search calls...", text: $viewModel.searchText)
                .textFieldStyle(RoundedBorderTextFieldStyle())
            
            if !viewModel.searchText.isEmpty {
                Button(action: viewModel.clearSearch) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }
    
    // MARK: - Call Logs List
    
    private var callLogsList: some View {
        List {
            ForEach(viewModel.groupedCallLogs, id: \.0) { dateString, calls in
                Section(header: Text(dateString)) {
                    ForEach(calls) { call in
                        CallLogRowView(callLog: call) {
                            selectedCall = call
                            Task {
                                await viewModel.markAsRead(call, userId: currentUserId)
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            // Delete action
                            Button("Delete", role: .destructive) {
                                Task {
                                    await viewModel.deleteCallLog(call, userId: currentUserId)
                                }
                            }
                            
                            // Mark as read/unread action
                            Button(call.isRead ? "Mark Unread" : "Mark Read") {
                                Task {
                                    if !call.isRead {
                                        await viewModel.markAsRead(call, userId: currentUserId)
                                    }
                                }
                            }
                            .tint(.blue)
                        }
                        .swipeActions(edge: .leading) {
                            // Call back action
                            Button("Call") {
                                callPhoneNumber(call.callerId)
                            }
                            .tint(.green)
                        }
                    }
                }
            }
        }
        .listStyle(InsetGroupedListStyle())
    }
    
    // MARK: - Loading View
    
    private var loadingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading call logs...")
                .font(.headline)
                .foregroundColor(.secondary)
        }
    }
    
    // MARK: - Empty State View
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "phone.badge")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text("No Call Logs Yet")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("When someone calls your number, their conversation with your AI assistant will appear here.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            Button("Refresh") {
                Task {
                    await refreshData()
                }
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
    
    // MARK: - Search Empty View
    
    private var searchEmptyView: some View {
        VStack(spacing: 20) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 50))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text("No Results")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("No call logs match '\(viewModel.searchText)'")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            Button("Clear Search") {
                viewModel.clearSearch()
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
    
    // MARK: - Helper Methods
    
    private var currentUserId: String {
        return authViewModel.currentUser?.id ?? ""
    }
    
    private func setupInitialData() {
        let userId = currentUserId
        guard !userId.isEmpty else { return }
        
        Task {
            await viewModel.fetchCallLogs(for: userId)
            viewModel.setupRealTimeListener(for: userId)
        }
    }
    
    private func refreshData() async {
        let userId = currentUserId
        guard !userId.isEmpty else { return }
        
        await viewModel.refreshCallLogs(for: userId)
    }
    
    private func toggleSearch() {
        withAnimation(.easeInOut(duration: 0.3)) {
            showingSearchBar.toggle()
        }
        
        if !showingSearchBar {
            viewModel.clearSearch()
        }
    }
    
    private func markAllAsRead() async {
        let userId = currentUserId
        guard !userId.isEmpty else { return }
        
        await viewModel.markAllAsRead(userId: userId)
    }
    
    private func callPhoneNumber(_ phoneNumber: String) {
        if let url = URL(string: "tel://\(phoneNumber)"), 
           UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - CallLogRowView

struct CallLogRowView: View {
    let callLog: CallLog
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Call status icon
                Circle()
                    .fill(callLog.isRead ? Color.clear : Color.blue)
                    .frame(width: 8, height: 8)
                    .opacity(callLog.isRead ? 0 : 1)
                
                // Caller info
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(callLog.displayName)
                            .font(.headline)
                            .foregroundColor(.primary)
                            .lineLimit(1)
                        
                        Spacer()
                        
                        Text(callLog.relativeTimeString)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Text(callLog.formattedCallerId)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                    
                    Text(callLog.aiSummary)
                        .font(.body)
                        .foregroundColor(.primary)
                        .lineLimit(2)
                    
                    // Duration
                    HStack {
                        Image(systemName: "clock")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text(callLog.formattedDuration)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        // Audio indicator
                        if callLog.audioRecordingUrl != nil {
                            Image(systemName: "waveform")
                                .font(.caption)
                                .foregroundColor(.blue)
                        }
                    }
                }
                
                // Chevron
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Preview

#if DEBUG
struct CallLogView_Previews: PreviewProvider {
    static var previews: some View {
        CallLogView()
            .environmentObject(AuthenticationViewModel())
    }
}
#endif