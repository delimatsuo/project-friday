import Foundation
import SwiftUI
import Combine
import CoreTelephony

@MainActor
class CallForwardingViewModel: ObservableObject {
    
    // MARK: - Published Properties
    @Published var forwardingNumber: String = ""
    @Published var isForwardingEnabled: Bool = false
    @Published var currentCarrier: Carrier = .unknown
    @Published var isLoading: Bool = false
    @Published var showingInstructions: Bool = false
    @Published var alertMessage: String = ""
    @Published var showingAlert: Bool = false
    @Published var setupStep: SetupStep = .phoneNumber
    
    // MARK: - Private Properties
    private let callForwardingService: CallForwardingService
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Setup Steps
    enum SetupStep: Int, CaseIterable {
        case phoneNumber = 0
        case carrierDetection = 1
        case instructions = 2
        case completion = 3
        
        var title: String {
            switch self {
            case .phoneNumber:
                return "Enter Forwarding Number"
            case .carrierDetection:
                return "Carrier Detection"
            case .instructions:
                return "Setup Instructions"
            case .completion:
                return "Setup Complete"
            }
        }
        
        var description: String {
            switch self {
            case .phoneNumber:
                return "Enter the phone number where calls should be forwarded when you're busy or unavailable."
            case .carrierDetection:
                return "We'll detect your carrier to provide the correct setup codes."
            case .instructions:
                return "Follow these steps to enable call forwarding on your device."
            case .completion:
                return "Call forwarding is now configured. Test it to make sure it's working properly."
            }
        }
    }
    
    // MARK: - Computed Properties
    var isPhoneNumberValid: Bool {
        callForwardingService.isValidForwardingNumber(forwardingNumber)
    }
    
    var enableMMICode: String {
        guard isPhoneNumberValid else { return "" }
        return callForwardingService.generateEnableForwardingCode(
            carrier: currentCarrier,
            forwardingNumber: forwardingNumber
        )
    }
    
    var disableMMICode: String {
        return callForwardingService.generateDisableForwardingCode(carrier: currentCarrier)
    }
    
    var carrierInstructions: [String] {
        return callForwardingService.getCarrierInstructions(for: currentCarrier)
    }
    
    var carrierNotes: [String] {
        return callForwardingService.getCarrierNotes(for: currentCarrier)
    }
    
    var progressValue: Double {
        return Double(setupStep.rawValue + 1) / Double(SetupStep.allCases.count)
    }
    
    // MARK: - Initialization
    init(callForwardingService: CallForwardingService = CallForwardingService()) {
        self.callForwardingService = callForwardingService
        loadCurrentState()
    }
    
    // MARK: - Public Methods
    
    func loadCurrentState() {
        isLoading = true
        
        // Load saved forwarding number
        if let savedNumber = callForwardingService.getForwardingNumber() {
            forwardingNumber = savedNumber
        }
        
        // Load forwarding state
        isForwardingEnabled = callForwardingService.isForwardingEnabled()
        
        // Detect current carrier
        detectCarrier()
        
        isLoading = false
    }
    
    func detectCarrier() {
        isLoading = true
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let detectedCarrier = self?.callForwardingService.getCurrentCarrier() ?? .unknown
            
            DispatchQueue.main.async {
                self?.currentCarrier = detectedCarrier
                self?.isLoading = false
                
                if detectedCarrier == .unknown {
                    self?.showAlert(message: "Could not detect your carrier automatically. You may need to contact your carrier for specific call forwarding instructions.")
                }
            }
        }
    }
    
    func validateAndProceed() {
        guard isPhoneNumberValid else {
            showAlert(message: "Please enter a valid phone number for call forwarding.")
            return
        }
        
        // Save the forwarding number
        callForwardingService.setForwardingNumber(forwardingNumber)
        
        // Move to next step
        if setupStep.rawValue < SetupStep.allCases.count - 1 {
            withAnimation(.easeInOut(duration: 0.3)) {
                setupStep = SetupStep(rawValue: setupStep.rawValue + 1) ?? .completion
            }
        }
    }
    
    func previousStep() {
        if setupStep.rawValue > 0 {
            withAnimation(.easeInOut(duration: 0.3)) {
                setupStep = SetupStep(rawValue: setupStep.rawValue - 1) ?? .phoneNumber
            }
        }
    }
    
    func copyMMICodeToClipboard(_ code: String) {
        UIPasteboard.general.string = code
        
        // Provide haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
        impactFeedback.impactOccurred()
        
        showAlert(message: "MMI code copied to clipboard! You can now paste it in your phone's dialer.")
    }
    
    func dialMMICode(_ code: String) {
        guard let url = URL(string: "tel:\(code)") else {
            showAlert(message: "Unable to open phone dialer. Please copy the code and dial manually.")
            return
        }
        
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url) { [weak self] success in
                DispatchQueue.main.async {
                    if success {
                        // The dialer opened successfully
                        self?.showAlert(message: "Opening phone dialer with MMI code...")
                    } else {
                        self?.showAlert(message: "Unable to open phone dialer. Please copy the code and dial manually.")
                    }
                }
            }
        } else {
            showAlert(message: "Phone dialer is not available on this device.")
        }
    }
    
    func enableCallForwarding() {
        guard isPhoneNumberValid else {
            showAlert(message: "Please enter a valid forwarding number first.")
            return
        }
        
        isLoading = true
        
        // Update the state
        callForwardingService.setForwardingEnabled(true)
        callForwardingService.setForwardingNumber(forwardingNumber)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.isForwardingEnabled = true
            self?.isLoading = false
            self?.showAlert(message: "Call forwarding has been enabled. Make sure to dial the MMI code to activate it on your carrier's network.")
        }
    }
    
    func disableCallForwarding() {
        isLoading = true
        
        // Update the state
        callForwardingService.setForwardingEnabled(false)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.isForwardingEnabled = false
            self?.isLoading = false
            self?.showAlert(message: "Call forwarding has been disabled. Make sure to dial the disable MMI code to deactivate it on your carrier's network.")
        }
    }
    
    func testCallForwarding() {
        showAlert(message: "To test call forwarding:\n\n1. Ask someone to call your number\n2. Don't answer the call\n3. Check if the call is forwarded to \(forwardingNumber)\n4. If it doesn't work, make sure you dialed the MMI code correctly")
    }
    
    func resetSetup() {
        withAnimation(.easeInOut(duration: 0.3)) {
            setupStep = .phoneNumber
            forwardingNumber = ""
            isForwardingEnabled = false
            currentCarrier = .unknown
        }
        
        // Clear saved data
        callForwardingService.setForwardingEnabled(false)
        callForwardingService.setForwardingNumber("")
    }
    
    func completeSetup() {
        setupStep = .completion
        showAlert(message: "Call forwarding setup is complete! Your calls will now be forwarded when you're busy or unavailable.")
    }
    
    // MARK: - Private Methods
    
    private func showAlert(message: String) {
        alertMessage = message
        showingAlert = true
    }
    
    // MARK: - Formatting Helpers
    
    func formatPhoneNumberForDisplay(_ number: String) -> String {
        let cleanNumber = number.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        
        guard cleanNumber.count >= 10 else { return number }
        
        let areaCode = String(cleanNumber.prefix(3))
        let exchange = String(cleanNumber.dropFirst(3).prefix(3))
        let number4 = String(cleanNumber.dropFirst(6).prefix(4))
        
        if cleanNumber.count == 10 {
            return "(\(areaCode)) \(exchange)-\(number4)"
        } else if cleanNumber.count == 11 && cleanNumber.first == "1" {
            let areaCode = String(cleanNumber.dropFirst(1).prefix(3))
            let exchange = String(cleanNumber.dropFirst(4).prefix(3))
            let number4 = String(cleanNumber.dropFirst(7).prefix(4))
            return "+1 (\(areaCode)) \(exchange)-\(number4)"
        }
        
        return number
    }
    
    func getCarrierDisplayName() -> String {
        return currentCarrier.displayName
    }
    
    func getCarrierIcon() -> String {
        switch currentCarrier {
        case .verizon:
            return "antenna.radiowaves.left.and.right"
        case .att:
            return "antenna.radiowaves.left.and.right.circle"
        case .tmobile:
            return "antenna.radiowaves.left.and.right.circle.fill"
        case .sprint:
            return "antenna.radiowaves.left.and.right"
        case .unknown:
            return "questionmark.circle"
        }
    }
}

// MARK: - Extensions

extension CallForwardingViewModel {
    /// Convenience method to get the current forwarding status as a user-friendly string
    var forwardingStatusText: String {
        switch callForwardingService.getCurrentForwardingState() {
        case .enabled(let number):
            return "Forwarding to \(formatPhoneNumberForDisplay(number))"
        case .disabled:
            return "Call forwarding is disabled"
        case .unknown:
            return "Call forwarding status unknown"
        }
    }
    
    /// Returns true if the setup can proceed to the next step
    var canProceedToNextStep: Bool {
        switch setupStep {
        case .phoneNumber:
            return isPhoneNumberValid
        case .carrierDetection:
            return currentCarrier != .unknown
        case .instructions:
            return true
        case .completion:
            return false
        }
    }
    
    /// Returns the appropriate button text for the current step
    var primaryButtonText: String {
        switch setupStep {
        case .phoneNumber:
            return "Continue"
        case .carrierDetection:
            return "Continue"
        case .instructions:
            return "Complete Setup"
        case .completion:
            return "Done"
        }
    }
}