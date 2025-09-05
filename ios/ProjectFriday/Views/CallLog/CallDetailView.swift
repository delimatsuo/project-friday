import SwiftUI
import AVFoundation
import Firebase

struct CallDetailView: View {
    let callLog: CallLog
    @EnvironmentObject private var authViewModel: AuthenticationViewModel
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CallLogViewModel()
    
    // Audio player state
    @State private var audioPlayer: AVAudioPlayer?
    @State private var isPlaying = false
    @State private var playbackProgress: Double = 0
    @State private var playbackDuration: Double = 0
    
    // UI State
    @State private var showingShareSheet = false
    @State private var showingContactSheet = false
    @State private var showingBlockAlert = false
    @State private var showingDeleteAlert = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header info
                    headerSection
                    
                    // Audio player section
                    if callLog.audioRecordingUrl != nil {
                        audioPlayerSection
                    }
                    
                    // AI Summary
                    summarySection
                    
                    // Full transcript
                    transcriptSection
                    
                    // Action buttons
                    actionButtonsSection
                }
                .padding()
            }
            .navigationTitle("Call Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("Share") {
                            showingShareSheet = true
                        }
                        
                        Button("Delete", role: .destructive) {
                            showingDeleteAlert = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .onAppear {
            markAsReadIfNeeded()
            setupAudioPlayer()
        }
        .onDisappear {
            stopAudioPlayback()
        }
        .sheet(isPresented: $showingShareSheet) {
            ShareSheet(items: [shareText])
        }
        .alert("Block Number", isPresented: $showingBlockAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Block", role: .destructive) {
                blockNumber()
            }
        } message: {
            Text("Are you sure you want to block \(callLog.displayName)? Future calls from this number will be automatically rejected.")
        }
        .alert("Delete Call", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteCall()
            }
        } message: {
            Text("Are you sure you want to delete this call log? This action cannot be undone.")
        }
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(callLog.displayName)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text(callLog.formattedCallerId)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(formatTimestamp(callLog.timestamp))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    HStack {
                        Image(systemName: "clock")
                            .font(.caption)
                        Text(callLog.formattedDuration)
                            .font(.caption)
                    }
                    .foregroundColor(.secondary)
                }
            }
            
            // Status badges
            HStack {
                if !callLog.isRead {
                    Label("Unread", systemImage: "circle.fill")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.blue.opacity(0.2))
                        .foregroundColor(.blue)
                        .clipShape(Capsule())
                }
                
                if callLog.audioRecordingUrl != nil {
                    Label("Recording Available", systemImage: "waveform")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.green.opacity(0.2))
                        .foregroundColor(.green)
                        .clipShape(Capsule())
                }
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Audio Player Section
    
    private var audioPlayerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Call Recording")
                .font(.headline)
            
            VStack(spacing: 16) {
                // Progress bar
                ProgressView(value: playbackProgress, total: playbackDuration)
                    .progressViewStyle(LinearProgressViewStyle())
                
                // Time labels
                HStack {
                    Text(formatTime(playbackProgress))
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text(formatTime(playbackDuration))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                // Play controls
                HStack {
                    Spacer()
                    
                    Button(action: togglePlayback) {
                        Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                            .font(.system(size: 50))
                            .foregroundColor(.blue)
                    }
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Summary Section
    
    private var summarySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("AI Summary")
                .font(.headline)
            
            Text(callLog.aiSummary)
                .font(.body)
                .padding()
                .background(.blue.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
    
    // MARK: - Transcript Section
    
    private var transcriptSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Full Transcript")
                .font(.headline)
            
            ScrollView {
                Text(callLog.fullTranscript)
                    .font(.body)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.regularMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .frame(maxHeight: 200)
        }
    }
    
    // MARK: - Action Buttons Section
    
    private var actionButtonsSection: some View {
        VStack(spacing: 16) {
            // Primary actions
            HStack(spacing: 16) {
                Button(action: callBack) {
                    Label("Call Back", systemImage: "phone.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                
                Button(action: { showingContactSheet = true }) {
                    Label("Add Contact", systemImage: "person.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            }
            
            // Secondary actions
            HStack(spacing: 16) {
                Button(action: { showingShareSheet = true }) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                
                Button(action: { showingBlockAlert = true }) {
                    Label("Block", systemImage: "hand.raised.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .foregroundColor(.red)
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private var shareText: String {
        """
        Call from \(callLog.displayName)
        Number: \(callLog.formattedCallerId)
        Date: \(formatTimestamp(callLog.timestamp))
        Duration: \(callLog.formattedDuration)
        
        Summary: \(callLog.aiSummary)
        
        Full Transcript:
        \(callLog.fullTranscript)
        """
    }
    
    private func markAsReadIfNeeded() {
        guard !callLog.isRead else { return }
        
        Task {
            let userId = authViewModel.currentUser?.id ?? ""
            await viewModel.markAsRead(callLog, userId: userId)
        }
    }
    
    private func callBack() {
        let phoneNumber = callLog.callerId
        if let url = URL(string: "tel://\(phoneNumber)"),
           UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }
    
    private func blockNumber() {
        // TODO: Implement block number functionality
        // This would typically update the user's blocked numbers list
        print("Block number: \(callLog.callerId)")
    }
    
    private func deleteCall() {
        Task {
            let userId = authViewModel.currentUser?.id ?? ""
            await viewModel.deleteCallLog(callLog, userId: userId)
            dismiss()
        }
    }
    
    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func formatTime(_ seconds: Double) -> String {
        let minutes = Int(seconds) / 60
        let remainingSeconds = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, remainingSeconds)
    }
    
    // MARK: - Audio Player Methods
    
    private func setupAudioPlayer() {
        guard let audioUrlString = callLog.audioRecordingUrl,
              let audioUrl = URL(string: audioUrlString) else { return }
        
        // For demo purposes, we'll use a placeholder
        // In production, you'd download or stream the audio file
        print("Setting up audio player for: \(audioUrl)")
    }
    
    private func togglePlayback() {
        if isPlaying {
            stopAudioPlayback()
        } else {
            startAudioPlayback()
        }
    }
    
    private func startAudioPlayback() {
        // Placeholder implementation
        // In production, implement actual audio playback
        isPlaying = true
        playbackDuration = Double(callLog.duration)
        
        // Simulate playback progress
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            if playbackProgress < playbackDuration && isPlaying {
                playbackProgress += 0.1
            } else {
                timer.invalidate()
                isPlaying = false
                playbackProgress = 0
            }
        }
    }
    
    private func stopAudioPlayback() {
        isPlaying = false
        audioPlayer?.stop()
        audioPlayer = nil
    }
}

// MARK: - ShareSheet

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#if DEBUG
struct CallDetailView_Previews: PreviewProvider {
    static var previews: some View {
        let sampleCall = CallLog(
            id: "preview-1",
            userId: "preview-user",
            callerId: "+1234567890",
            callerName: "John Doe",
            timestamp: Date().addingTimeInterval(-3600),
            duration: 120,
            fullTranscript: "Hello, this is John calling about the project meeting tomorrow. I wanted to confirm the time and location. I'll be available all morning and was hoping we could discuss the budget as well. Let me know if 10 AM works for everyone.",
            aiSummary: "John called to confirm project meeting details and discuss budget",
            audioRecordingUrl: "https://example.com/audio.mp3",
            isRead: false
        )
        
        CallDetailView(callLog: sampleCall)
            .environmentObject(AuthenticationViewModel())
    }
}
#endif