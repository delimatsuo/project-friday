import SwiftUI

/**
 * ErrorView Components
 * Comprehensive error display components with user-friendly design and recovery options
 */

// MARK: - Main Error View

struct ErrorView: View {
    @StateObject private var errorViewModel = ErrorViewModel()
    @State private var showingErrorDetails = false
    
    var body: some View {
        ZStack {
            // Background overlay when error is shown
            if errorViewModel.isShowingError {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        errorViewModel.dismissError()
                    }
                
                ErrorModalView(
                    error: errorViewModel.currentError,
                    isRetrying: errorViewModel.isRetrying,
                    onRetry: {
                        Task {
                            await errorViewModel.retryOperation()
                        }
                    },
                    onDismiss: {
                        errorViewModel.dismissError()
                    },
                    onShowDetails: {
                        showingErrorDetails = true
                    }
                )
                .transition(.asymmetric(
                    insertion: .scale.combined(with: .opacity),
                    removal: .opacity
                ))
                .animation(.spring(response: 0.5, dampingFraction: 0.8), value: errorViewModel.isShowingError)
            }
        }
        .sheet(isPresented: $showingErrorDetails) {
            ErrorDetailsView(
                error: errorViewModel.currentError,
                errorHistory: errorViewModel.errorHistory
            )
        }
    }
}

// MARK: - Error Modal View

struct ErrorModalView: View {
    let error: DisplayableError?
    let isRetrying: Bool
    let onRetry: () -> Void
    let onDismiss: () -> Void
    let onShowDetails: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            if let error = error {
                VStack(spacing: 16) {
                    // Error Icon and Title
                    VStack(spacing: 8) {
                        Image(systemName: error.severityIcon)
                            .font(.system(size: 40))
                            .foregroundColor(error.severityColor)
                        
                        Text(error.title)
                            .font(.headline)
                            .fontWeight(.semibold)
                            .multilineTextAlignment(.center)
                    }
                    
                    // Error Message
                    Text(error.message)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                    
                    // Recovery Suggestions
                    if !error.suggestions.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Try these steps:")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            ForEach(Array(error.suggestions.enumerated()), id: \.offset) { index, suggestion in
                                HStack(alignment: .top, spacing: 8) {
                                    Text("\(index + 1).")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    Text(suggestion)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    Spacer()
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                    }
                    
                    // Action Buttons
                    HStack(spacing: 12) {
                        // Dismiss Button
                        Button("Dismiss") {
                            onDismiss()
                        }
                        .buttonStyle(.bordered)
                        
                        // Retry Button
                        if error.canRetry {
                            Button(action: onRetry) {
                                HStack {
                                    if isRetrying {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                            .scaleEffect(0.8)
                                    }
                                    Text(isRetrying ? "Retrying..." : "Try Again")
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(isRetrying)
                        }
                    }
                    
                    // Details Button
                    Button("View Details") {
                        onShowDetails()
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
                .padding(24)
            }
        }
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
        .padding(.horizontal, 40)
    }
}

// MARK: - Error Banner View

struct ErrorBannerView: View {
    let error: DisplayableError
    let onRetry: () -> Void
    let onDismiss: () -> Void
    
    @State private var isVisible = true
    
    var body: some View {
        if isVisible {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    // Error Icon
                    Image(systemName: error.severityIcon)
                        .font(.system(size: 16))
                        .foregroundColor(error.severityColor)
                    
                    // Error Message
                    VStack(alignment: .leading, spacing: 2) {
                        Text(error.title)
                            .font(.caption)
                            .fontWeight(.medium)
                        
                        Text(error.message)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                    
                    Spacer()
                    
                    // Action Buttons
                    HStack(spacing: 8) {
                        if error.canRetry {
                            Button("Retry") {
                                onRetry()
                            }
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(error.severityColor)
                            .foregroundColor(.white)
                            .cornerRadius(4)
                        }
                        
                        Button(action: {
                            withAnimation(.easeOut(duration: 0.3)) {
                                isVisible = false
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                onDismiss()
                            }
                        }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color(.systemGray6))
            .overlay(
                Rectangle()
                    .frame(height: 2)
                    .foregroundColor(error.severityColor),
                alignment: .top
            )
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

// MARK: - Error Toast View

struct ErrorToastView: View {
    let error: DisplayableError
    let onDismiss: () -> Void
    
    @State private var isVisible = false
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: error.severityIcon)
                .font(.system(size: 16))
                .foregroundColor(error.severityColor)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(error.title)
                    .font(.caption)
                    .fontWeight(.medium)
                
                if error.severity != .low {
                    Text(error.message)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
        .offset(y: isVisible ? 0 : -100)
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                isVisible = true
            }
            
            // Auto-dismiss after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                withAnimation(.easeOut(duration: 0.3)) {
                    isVisible = false
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    onDismiss()
                }
            }
        }
    }
}

// MARK: - Network Status View

struct NetworkStatusView: View {
    @StateObject private var errorViewModel = ErrorViewModel()
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(errorViewModel.getNetworkStatusColor())
                .frame(width: 8, height: 8)
            
            Text(errorViewModel.getNetworkStatusMessage())
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Offline Mode View

struct OfflineModeView: View {
    let isOffline: Bool
    let onTryAgain: () -> Void
    
    var body: some View {
        if isOffline {
            VStack(spacing: 16) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 48))
                    .foregroundColor(.orange)
                
                VStack(spacing: 8) {
                    Text("You're Offline")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text("Some features are limited while offline. We'll sync your changes when you reconnect.")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                
                Button("Try Again") {
                    onTryAgain()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(32)
        }
    }
}

// MARK: - Error Details View

struct ErrorDetailsView: View {
    let error: DisplayableError?
    let errorHistory: [DisplayableError]
    
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Current Error Details
                    if let error = error {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Current Error")
                                .font(.headline)
                                .fontWeight(.semibold)
                            
                            ErrorDetailCard(error: error, showFullDetails: true)
                        }
                    }
                    
                    // Error History
                    if !errorHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Recent Errors")
                                .font(.headline)
                                .fontWeight(.semibold)
                            
                            ForEach(errorHistory) { historicalError in
                                ErrorDetailCard(error: historicalError, showFullDetails: false)
                            }
                        }
                    }
                    
                    // Troubleshooting Tips
                    TroubleshootingTipsView()
                }
                .padding(20)
            }
            .navigationTitle("Error Details")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Error Detail Card

struct ErrorDetailCard: View {
    let error: DisplayableError
    let showFullDetails: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: error.severityIcon)
                    .font(.system(size: 20))
                    .foregroundColor(error.severityColor)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(error.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(error.timestamp.formatted(.dateTime.hour().minute().second()))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if showFullDetails {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(error.severity.rawValue.capitalized)
                            .font(.caption2)
                            .fontWeight(.medium)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(error.severityColor.opacity(0.2))
                            .foregroundColor(error.severityColor)
                            .cornerRadius(4)
                        
                        Text(error.category.rawValue.capitalized)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            if showFullDetails {
                VStack(alignment: .leading, spacing: 8) {
                    Text(error.message)
                        .font(.body)
                        .foregroundColor(.primary)
                    
                    if !error.suggestions.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Recovery Suggestions:")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.secondary)
                            
                            ForEach(Array(error.suggestions.enumerated()), id: \.offset) { index, suggestion in
                                HStack(alignment: .top, spacing: 4) {
                                    Text("•")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    Text(suggestion)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Troubleshooting Tips View

struct TroubleshootingTipsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Troubleshooting Tips")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 12) {
                TroubleshootingTipRow(
                    icon: "wifi",
                    title: "Check Your Connection",
                    description: "Ensure you have a stable internet connection."
                )
                
                TroubleshootingTipRow(
                    icon: "arrow.clockwise",
                    title: "Force Close and Restart",
                    description: "Close the app completely and reopen it."
                )
                
                TroubleshootingTipRow(
                    icon: "iphone.and.arrow.forward",
                    title: "Update the App",
                    description: "Make sure you're using the latest version."
                )
                
                TroubleshootingTipRow(
                    icon: "person.circle",
                    title: "Contact Support",
                    description: "If problems persist, reach out to our support team."
                )
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
        .cornerRadius(12)
    }
}

// MARK: - Troubleshooting Tip Row

struct TroubleshootingTipRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.blue)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Error View Modifiers

extension View {
    func errorHandling<T>(
        _ binding: Binding<T?>,
        with errorViewModel: ErrorViewModel,
        retryAction: (() async throws -> Void)? = nil
    ) -> some View where T: Error {
        self.onChange(of: binding.wrappedValue) { error in
            if let error = error {
                errorViewModel.presentError(error, retryAction: retryAction)
                binding.wrappedValue = nil
            }
        }
    }
    
    func errorBanner(
        error: Binding<DisplayableError?>,
        onRetry: @escaping () -> Void = {},
        onDismiss: @escaping () -> Void = {}
    ) -> some View {
        ZStack(alignment: .top) {
            self
            
            if let displayError = error.wrappedValue {
                ErrorBannerView(
                    error: displayError,
                    onRetry: onRetry,
                    onDismiss: {
                        error.wrappedValue = nil
                        onDismiss()
                    }
                )
                .zIndex(1)
            }
        }
    }
    
    func errorToast(
        error: Binding<DisplayableError?>,
        onDismiss: @escaping () -> Void = {}
    ) -> some View {
        ZStack(alignment: .top) {
            self
            
            if let displayError = error.wrappedValue {
                VStack {
                    ErrorToastView(
                        error: displayError,
                        onDismiss: {
                            error.wrappedValue = nil
                            onDismiss()
                        }
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    
                    Spacer()
                }
                .zIndex(1)
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ErrorView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Error Modal Preview
            ErrorModalView(
                error: DisplayableError(
                    id: UUID(),
                    title: "Connection Failed",
                    message: "Unable to connect to the server. Please check your internet connection and try again.",
                    suggestions: [
                        "Check your WiFi connection",
                        "Try switching to cellular data",
                        "Restart the app if the problem persists"
                    ],
                    severity: .high,
                    category: .network,
                    canRetry: true,
                    timestamp: Date()
                ),
                isRetrying: false,
                onRetry: {},
                onDismiss: {},
                onShowDetails: {}
            )
            .previewDisplayName("Error Modal")
            
            // Error Banner Preview
            ErrorBannerView(
                error: DisplayableError(
                    id: UUID(),
                    title: "Sync Failed",
                    message: "Could not sync your data. Your changes are saved locally.",
                    suggestions: [],
                    severity: .medium,
                    category: .network,
                    canRetry: true,
                    timestamp: Date()
                ),
                onRetry: {},
                onDismiss: {}
            )
            .previewDisplayName("Error Banner")
            
            // Network Status Preview
            NetworkStatusView()
                .previewDisplayName("Network Status")
            
            // Offline Mode Preview
            OfflineModeView(
                isOffline: true,
                onTryAgain: {}
            )
            .previewDisplayName("Offline Mode")
        }
    }
}
#endif