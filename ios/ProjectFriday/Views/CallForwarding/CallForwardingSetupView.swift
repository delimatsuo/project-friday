import SwiftUI

struct CallForwardingSetupView: View {
    @StateObject private var viewModel = CallForwardingViewModel()
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Progress indicator
                progressBar
                
                // Main content
                ScrollView {
                    VStack(spacing: 24) {
                        stepContent
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                }
                
                // Bottom action buttons
                bottomActionButtons
            }
            .navigationTitle("Call Forwarding")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(viewModel.setupStep != .phoneNumber)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if viewModel.setupStep != .phoneNumber {
                        Button("Back") {
                            viewModel.previousStep()
                        }
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .alert("Call Forwarding", isPresented: $viewModel.showingAlert) {
            Button("OK") { }
        } message: {
            Text(viewModel.alertMessage)
        }
        .onAppear {
            viewModel.loadCurrentState()
        }
    }
    
    // MARK: - Progress Bar
    
    private var progressBar: some View {
        VStack(spacing: 8) {
            ProgressView(value: viewModel.progressValue)
                .progressViewStyle(LinearProgressViewStyle())
                .scaleEffect(x: 1, y: 2, anchor: .center)
            
            HStack {
                Text("Step \(viewModel.setupStep.rawValue + 1) of \(CallForwardingViewModel.SetupStep.allCases.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(UIColor.systemGroupedBackground))
    }
    
    // MARK: - Step Content
    
    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.setupStep {
        case .phoneNumber:
            phoneNumberStep
        case .carrierDetection:
            carrierDetectionStep
        case .instructions:
            instructionsStep
        case .completion:
            completionStep
        }
    }
    
    // MARK: - Phone Number Step
    
    private var phoneNumberStep: some View {
        VStack(spacing: 20) {
            // Step header
            StepHeaderView(
                title: viewModel.setupStep.title,
                description: viewModel.setupStep.description,
                icon: "phone.fill"
            )
            
            // Phone number input
            VStack(alignment: .leading, spacing: 12) {
                Text("Forwarding Number")
                    .font(.headline)
                
                TextField("Enter phone number", text: $viewModel.forwardingNumber)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .onChange(of: viewModel.forwardingNumber) { oldValue, newValue in
                        // Format the input as user types
                        let formatted = formatPhoneInput(newValue)
                        if formatted != newValue {
                            viewModel.forwardingNumber = formatted
                        }
                    }
                
                if !viewModel.forwardingNumber.isEmpty && !viewModel.isPhoneNumberValid {
                    Text("Please enter a valid phone number")
                        .font(.caption)
                        .foregroundColor(.red)
                }
                
                if viewModel.isPhoneNumberValid {
                    Text("✓ Valid phone number")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
            
            // Info card
            InfoCardView(
                title: "How it works",
                content: "When someone calls your number and you don't answer (busy, phone off, or no signal), the call will be automatically forwarded to this number.",
                icon: "info.circle.fill",
                color: .blue
            )
        }
    }
    
    // MARK: - Carrier Detection Step
    
    private var carrierDetectionStep: some View {
        VStack(spacing: 20) {
            StepHeaderView(
                title: viewModel.setupStep.title,
                description: viewModel.setupStep.description,
                icon: "antenna.radiowaves.left.and.right"
            )
            
            if viewModel.isLoading {
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("Detecting your carrier...")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 40)
            } else {
                // Carrier info
                CarrierInfoView(
                    carrier: viewModel.currentCarrier,
                    icon: viewModel.getCarrierIcon()
                )
                
                if viewModel.currentCarrier == .unknown {
                    InfoCardView(
                        title: "Carrier not detected",
                        content: "We couldn't automatically detect your carrier. The setup will use standard codes that work with most carriers. If you encounter issues, contact your carrier for specific instructions.",
                        icon: "exclamationmark.triangle.fill",
                        color: .orange
                    )
                    
                    Button("Retry Detection") {
                        viewModel.detectCarrier()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
            }
        }
    }
    
    // MARK: - Instructions Step
    
    private var instructionsStep: some View {
        CallForwardingInstructionsView(viewModel: viewModel)
    }
    
    // MARK: - Completion Step
    
    private var completionStep: some View {
        VStack(spacing: 24) {
            // Success header
            VStack(spacing: 16) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.green)
                
                Text("Setup Complete!")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("Call forwarding is now configured for your device.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            // Summary card
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "phone.arrow.right")
                        .foregroundColor(.blue)
                    Text("Forwarding Summary")
                        .font(.headline)
                }
                
                Divider()
                
                HStack {
                    Text("From:")
                    Spacer()
                    Text("Your number")
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("To:")
                    Spacer()
                    Text(viewModel.formatPhoneNumberForDisplay(viewModel.forwardingNumber))
                        .fontWeight(.medium)
                }
                
                HStack {
                    Text("Carrier:")
                    Spacer()
                    Text(viewModel.getCarrierDisplayName())
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("Status:")
                    Spacer()
                    Text(viewModel.isForwardingEnabled ? "Enabled" : "Ready to Enable")
                        .foregroundColor(viewModel.isForwardingEnabled ? .green : .orange)
                        .fontWeight(.medium)
                }
            }
            .padding(16)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)
            
            // Action buttons
            VStack(spacing: 12) {
                Button("Test Call Forwarding") {
                    viewModel.testCallForwarding()
                }
                .buttonStyle(SecondaryButtonStyle())
                
                Button("View Instructions Again") {
                    viewModel.setupStep = .instructions
                }
                .buttonStyle(TertiaryButtonStyle())
            }
        }
    }
    
    // MARK: - Bottom Action Buttons
    
    private var bottomActionButtons: some View {
        VStack(spacing: 12) {
            Button(viewModel.primaryButtonText) {
                handlePrimaryAction()
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!viewModel.canProceedToNextStep)
            
            if viewModel.setupStep == .completion {
                Button("Start Over") {
                    viewModel.resetSetup()
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(Color(UIColor.systemBackground))
    }
    
    // MARK: - Helper Methods
    
    private func handlePrimaryAction() {
        switch viewModel.setupStep {
        case .phoneNumber, .carrierDetection:
            viewModel.validateAndProceed()
        case .instructions:
            viewModel.completeSetup()
        case .completion:
            dismiss()
        }
    }
    
    private func formatPhoneInput(_ input: String) -> String {
        let digits = input.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        
        guard digits.count <= 11 else {
            return String(digits.prefix(11))
        }
        
        return digits
    }
}

// MARK: - Supporting Views

struct StepHeaderView: View {
    let title: String
    let description: String
    let icon: String
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundColor(.blue)
            
            VStack(spacing: 8) {
                Text(title)
                    .font(.title2)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)
                
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(nil)
            }
        }
        .padding(.vertical, 8)
    }
}

struct InfoCardView: View {
    let title: String
    let content: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title3)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(content)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
        }
        .padding(12)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct CarrierInfoView: View {
    let carrier: Carrier
    let icon: String
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundColor(.blue)
            
            VStack(spacing: 4) {
                Text("Detected Carrier")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Text(carrier.displayName)
                    .font(.title3)
                    .fontWeight(.bold)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
}

// MARK: - Button Styles

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(configuration.isPressed ? Color.blue.opacity(0.8) : Color.blue)
            .foregroundColor(.white)
            .fontWeight(.semibold)
            .cornerRadius(12)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .foregroundColor(.blue)
            .fontWeight(.medium)
            .cornerRadius(12)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct TertiaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(.blue)
            .fontWeight(.medium)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview {
    CallForwardingSetupView()
}