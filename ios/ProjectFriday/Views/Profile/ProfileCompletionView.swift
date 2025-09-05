import SwiftUI

struct ProfileCompletionView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var displayName: String = ""
    @State private var phoneNumber: String = ""
    @State private var enableCallScreening = true
    @State private var isLoading = false
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Header
                    VStack(spacing: 16) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 60))
                            .foregroundColor(.blue)
                        
                        Text("Complete Your Profile")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        Text("Help us personalize your Project Friday experience")
                            .font(.body)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top)
                    
                    // Profile Form
                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Display Name")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            TextField("Enter your name", text: $displayName)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .textContentType(.name)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Phone Number (Optional)")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            TextField("Enter your phone number", text: $phoneNumber)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .textContentType(.telephoneNumber)
                                .keyboardType(.phonePad)
                        }
                        
                        // Call Screening Preference
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Call Screening")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Enable Call Screening")
                                        .font(.body)
                                        .fontWeight(.medium)
                                    
                                    Text("Automatically screen incoming calls using AI")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                Toggle("", isOn: $enableCallScreening)
                                    .toggleStyle(SwitchToggleStyle(tint: .blue))
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(12)
                        }
                    }
                    .padding(.horizontal)
                    
                    // Additional Preferences
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Quick Setup")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            PreferenceRow(
                                title: "Block Spam Calls",
                                description: "Automatically block known spam numbers",
                                isEnabled: .constant(true)
                            )
                            
                            PreferenceRow(
                                title: "Allow Known Contacts",
                                description: "Let calls from your contacts through without screening",
                                isEnabled: .constant(true)
                            )
                            
                            PreferenceRow(
                                title: "Business Hours Mode",
                                description: "Different screening rules during work hours",
                                isEnabled: .constant(false)
                            )
                        }
                        .padding(.horizontal)
                    }
                    
                    Spacer(minLength: 100)
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Skip") {
                        completeProfile(skipDetails: true)
                    }
                    .foregroundColor(.blue)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        completeProfile(skipDetails: false)
                    }) {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .blue))
                                    .scaleEffect(0.8)
                            } else {
                                Text("Complete")
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                    .disabled(isLoading)
                }
            }
        }
        .onAppear {
            // Pre-populate with existing user data
            if let user = authViewModel.currentUser {
                displayName = user.displayName ?? ""
                phoneNumber = user.phoneNumber ?? ""
            }
        }
    }
    
    private func completeProfile(skipDetails: Bool) {
        Task {
            isLoading = true
            
            if !skipDetails {
                // Here you would update the user profile with the new information
                // For now, we'll just complete the profile
                // TODO: Implement user profile update in FirebaseService
            }
            
            // Mark profile as completed
            if let user = authViewModel.currentUser {
                try? await FirebaseService.shared.updateProfileCompletion(uid: user.id, completed: true)
            }
            
            isLoading = false
            dismiss()
        }
    }
}

// MARK: - Supporting Views

struct PreferenceRow: View {
    let title: String
    let description: String
    @Binding var isEnabled: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.body)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Toggle("", isOn: $isEnabled)
                .toggleStyle(SwitchToggleStyle(tint: .blue))
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

#Preview {
    ProfileCompletionView()
        .environmentObject(AuthenticationViewModel())
}