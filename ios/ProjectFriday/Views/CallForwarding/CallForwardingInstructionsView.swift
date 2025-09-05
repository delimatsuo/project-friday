import SwiftUI

struct CallForwardingInstructionsView: View {
    @ObservedObject var viewModel: CallForwardingViewModel
    @State private var selectedTab: InstructionTab = .enable
    
    enum InstructionTab: String, CaseIterable {
        case enable = "Enable"
        case disable = "Disable"
        
        var icon: String {
            switch self {
            case .enable:
                return "phone.arrow.right"
            case .disable:
                return "phone.arrow.down.left"
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 20) {
            // Step header
            StepHeaderView(
                title: viewModel.setupStep.title,
                description: viewModel.setupStep.description,
                icon: "list.clipboard"
            )
            
            // Tab selector
            tabSelector
            
            // Instructions content
            instructionsContent
            
            // Carrier-specific notes
            carrierNotesSection
        }
    }
    
    // MARK: - Tab Selector
    
    private var tabSelector: some View {
        HStack(spacing: 0) {
            ForEach(InstructionTab.allCases, id: \.self) { tab in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 16))
                        Text(tab.rawValue)
                            .fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        selectedTab == tab ?
                        Color.blue : Color.clear
                    )
                    .foregroundColor(
                        selectedTab == tab ?
                        .white : .blue
                    )
                }
            }
        }
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(UIColor.separator), lineWidth: 1)
        )
    }
    
    // MARK: - Instructions Content
    
    @ViewBuilder
    private var instructionsContent: some View {
        switch selectedTab {
        case .enable:
            enableInstructions
        case .disable:
            disableInstructions
        }
    }
    
    // MARK: - Enable Instructions
    
    private var enableInstructions: some View {
        VStack(spacing: 16) {
            // MMI Code Card
            MMICodeCard(
                title: "Enable Call Forwarding",
                code: viewModel.enableMMICode,
                description: "Dial this code to enable call forwarding to \(viewModel.formatPhoneNumberForDisplay(viewModel.forwardingNumber))",
                color: .green,
                onCopy: { viewModel.copyMMICodeToClipboard($0) },
                onDial: { viewModel.dialMMICode($0) }
            )
            
            // Step-by-step instructions
            InstructionStepsView(
                title: "How to Enable",
                steps: viewModel.carrierInstructions,
                icon: "checkmark.circle.fill",
                color: .green
            )
        }
    }
    
    // MARK: - Disable Instructions
    
    private var disableInstructions: some View {
        VStack(spacing: 16) {
            // MMI Code Card
            MMICodeCard(
                title: "Disable Call Forwarding",
                code: viewModel.disableMMICode,
                description: "Dial this code to disable call forwarding",
                color: .red,
                onCopy: { viewModel.copyMMICodeToClipboard($0) },
                onDial: { viewModel.dialMMICode($0) }
            )
            
            // Disable-specific instructions
            InstructionStepsView(
                title: "How to Disable",
                steps: [
                    "1. Dial the disable MMI code or copy it to your dialer",
                    "2. Press the call button to execute the code",
                    "3. Wait for confirmation message or tone",
                    "4. Call forwarding is now disabled"
                ],
                icon: "xmark.circle.fill",
                color: .red
            )
        }
    }
    
    // MARK: - Carrier Notes Section
    
    private var carrierNotesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "info.circle.fill")
                    .foregroundColor(.blue)
                Text("Important Notes")
                    .font(.headline)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                ForEach(viewModel.carrierNotes, id: \.self) { note in
                    HStack(alignment: .top, spacing: 8) {
                        Text("•")
                            .foregroundColor(.blue)
                            .fontWeight(.bold)
                        Text(note)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer()
                    }
                }
            }
        }
        .padding(16)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
}

// MARK: - Supporting Views

struct MMICodeCard: View {
    let title: String
    let code: String
    let description: String
    let color: Color
    let onCopy: (String) -> Void
    let onDial: (String) -> Void
    
    @State private var showingCopyConfirmation = false
    
    var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Image(systemName: "phone.fill")
                    .foregroundColor(color)
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
                Spacer()
            }
            
            // MMI Code display
            VStack(spacing: 8) {
                Text(code)
                    .font(.title2)
                    .fontFamily(.monospaced)
                    .fontWeight(.bold)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color(UIColor.tertiarySystemGroupedBackground))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(color.opacity(0.3), lineWidth: 2)
                    )
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            // Action buttons
            HStack(spacing: 12) {
                Button(action: {
                    onCopy(code)
                    showCopyConfirmation()
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: showingCopyConfirmation ? "checkmark" : "doc.on.doc")
                        Text(showingCopyConfirmation ? "Copied!" : "Copy")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .foregroundColor(showingCopyConfirmation ? .green : .primary)
                    .cornerRadius(8)
                }
                .buttonStyle(PlainButtonStyle())
                
                Button(action: {
                    onDial(code)
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "phone.fill")
                        Text("Dial")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(color)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(16)
        .background(color.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.2), lineWidth: 1)
        )
    }
    
    private func showCopyConfirmation() {
        withAnimation(.easeInOut(duration: 0.2)) {
            showingCopyConfirmation = true
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.easeInOut(duration: 0.2)) {
                showingCopyConfirmation = false
            }
        }
    }
}

struct InstructionStepsView: View {
    let title: String
    let steps: [String]
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
                Spacer()
            }
            
            // Steps
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    InstructionStepRow(
                        step: step,
                        stepNumber: index + 1,
                        isLastStep: index == steps.count - 1,
                        color: color
                    )
                }
            }
        }
        .padding(16)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
}

struct InstructionStepRow: View {
    let step: String
    let stepNumber: Int
    let isLastStep: Bool
    let color: Color
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Step number circle
            ZStack {
                Circle()
                    .fill(color.opacity(0.1))
                    .frame(width: 24, height: 24)
                
                Text("\(stepNumber)")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(color)
            }
            
            // Step text
            VStack(alignment: .leading, spacing: 4) {
                Text(step)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                
                if !isLastStep {
                    Rectangle()
                        .fill(color.opacity(0.2))
                        .frame(width: 1, height: 16)
                        .offset(x: -12)
                }
            }
            
            Spacer()
        }
    }
}

// MARK: - Visual Instruction Components

struct VisualDialerGuide: View {
    let mmiCode: String
    
    var body: some View {
        VStack(spacing: 16) {
            Text("Visual Guide")
                .font(.headline)
                .fontWeight(.bold)
            
            // Mock phone dialer
            VStack(spacing: 8) {
                // Display
                HStack {
                    Text(mmiCode)
                        .font(.title2)
                        .fontFamily(.monospaced)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.black)
                        .foregroundColor(.green)
                        .cornerRadius(4)
                    
                    Spacer()
                    
                    Button(action: {}) {
                        Image(systemName: "phone.fill")
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Color.green)
                            .clipShape(Circle())
                    }
                    .disabled(true)
                }
                
                Text("Enter the code in your phone's dialer, then tap call")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(16)
            .background(Color(UIColor.tertiarySystemGroupedBackground))
            .cornerRadius(12)
        }
    }
}

struct TroubleshootingSection: View {
    let carrier: Carrier
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "wrench.and.screwdriver.fill")
                    .foregroundColor(.orange)
                Text("Troubleshooting")
                    .font(.headline)
                    .fontWeight(.bold)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                TroubleshootingItem(
                    issue: "Code doesn't work",
                    solution: "Try waiting 5-10 minutes and test again, or contact your carrier"
                )
                
                TroubleshootingItem(
                    issue: "No confirmation message",
                    solution: "Some carriers don't send confirmations. Test by having someone call you"
                )
                
                TroubleshootingItem(
                    issue: "Forwarding not working",
                    solution: "Make sure the forwarding number is correct and can receive calls"
                )
                
                if carrier == .unknown {
                    TroubleshootingItem(
                        issue: "Carrier not recognized",
                        solution: "Contact your carrier for specific call forwarding codes and instructions"
                    )
                }
            }
        }
        .padding(16)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
}

struct TroubleshootingItem: View {
    let issue: String
    let solution: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("•")
                    .foregroundColor(.orange)
                    .fontWeight(.bold)
                Text(issue)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            
            Text(solution)
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.leading, 12)
        }
    }
}

// MARK: - Preview

#Preview {
    CallForwardingInstructionsView(
        viewModel: CallForwardingViewModel()
    )
    .padding()
}