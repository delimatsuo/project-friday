import Foundation
import CoreTelephony
import UserNotifications

// MARK: - Carrier Enum
enum Carrier: String, CaseIterable {
    case verizon = "Verizon"
    case att = "AT&T"
    case tmobile = "T-Mobile"
    case sprint = "Sprint"
    case unknown = "Unknown"
    
    var displayName: String {
        return self.rawValue
    }
}

// MARK: - Call Forwarding State
enum CallForwardingState {
    case disabled
    case enabled(forwardingNumber: String)
    case unknown
}

// MARK: - Call Forwarding Service
class CallForwardingService: ObservableObject {
    
    // MARK: - Private Properties
    private let userDefaults = UserDefaults.standard
    private let telephonyNetworkInfo = CTTelephonyNetworkInfo()
    
    // MARK: - UserDefaults Keys
    private enum UserDefaultsKeys {
        static let forwardingNumber = "call_forwarding_number"
        static let forwardingEnabled = "call_forwarding_enabled"
        static let detectedCarrier = "detected_carrier"
    }
    
    // MARK: - Initialization
    init() {
        setupInitialState()
    }
    
    // MARK: - Public Methods
    
    /// Detects the current carrier from the device
    func getCurrentCarrier() -> Carrier {
        guard let carrier = telephonyNetworkInfo.subscriberCellularProvider else {
            return .unknown
        }
        
        guard let carrierName = carrier.carrierName else {
            return .unknown
        }
        
        let detectedCarrier = detectCarrier(from: carrierName)
        
        // Cache the detected carrier
        userDefaults.set(detectedCarrier.rawValue, forKey: UserDefaultsKeys.detectedCarrier)
        
        return detectedCarrier
    }
    
    /// Detects carrier from a carrier name string
    func detectCarrier(from carrierName: String) -> Carrier {
        let lowercasedName = carrierName.lowercased()
        
        if lowercasedName.contains("verizon") || lowercasedName.contains("vzw") {
            return .verizon
        } else if lowercasedName.contains("at&t") || lowercasedName.contains("att") {
            return .att
        } else if lowercasedName.contains("t-mobile") || lowercasedName.contains("tmo") {
            return .tmobile
        } else if lowercasedName.contains("sprint") {
            return .sprint
        } else {
            return .unknown
        }
    }
    
    /// Generates MMI code to enable call forwarding
    func generateEnableForwardingCode(carrier: Carrier, forwardingNumber: String) -> String {
        let formattedNumber = formatPhoneNumber(forwardingNumber) ?? forwardingNumber
        
        switch carrier {
        case .verizon:
            return "*72\(formattedNumber)"
        case .att:
            return "**21*\(formattedNumber)#"
        case .tmobile:
            return "*72\(formattedNumber)"
        case .sprint:
            return "*72\(formattedNumber)" // Unconditional forwarding
        case .unknown:
            return "*72\(formattedNumber)" // Default GSM standard
        }
    }
    
    /// Generates MMI code to disable call forwarding
    func generateDisableForwardingCode(carrier: Carrier) -> String {
        switch carrier {
        case .verizon:
            return "*73"
        case .att:
            return "##21#"
        case .tmobile:
            return "*73"
        case .sprint:
            return "*73"
        case .unknown:
            return "*73" // Default GSM standard
        }
    }
    
    /// Generates MMI code to enable conditional call forwarding (Sprint specific)
    func generateEnableConditionalForwardingCode(carrier: Carrier, forwardingNumber: String) -> String {
        let formattedNumber = formatPhoneNumber(forwardingNumber) ?? forwardingNumber
        
        switch carrier {
        case .sprint:
            return "*28\(formattedNumber)" // Conditional forwarding for busy and no answer
        case .verizon:
            return "*71\(formattedNumber)" // No Answer/Busy Transfer
        default:
            return generateEnableForwardingCode(carrier: carrier, forwardingNumber: formattedNumber)
        }
    }
    
    /// Generates MMI code to disable conditional call forwarding (Sprint specific)
    func generateDisableConditionalForwardingCode(carrier: Carrier) -> String {
        switch carrier {
        case .sprint:
            return "*38" // Disable conditional forwarding
        case .verizon:
            return "*73" // Deactivate No Answer/Busy Transfer
        default:
            return generateDisableForwardingCode(carrier: carrier)
        }
    }
    
    /// Sets the forwarding phone number
    func setForwardingNumber(_ number: String) {
        userDefaults.set(number, forKey: UserDefaultsKeys.forwardingNumber)
    }
    
    /// Gets the stored forwarding phone number
    func getForwardingNumber() -> String? {
        return userDefaults.string(forKey: UserDefaultsKeys.forwardingNumber)
    }
    
    /// Sets the forwarding enabled state
    func setForwardingEnabled(_ enabled: Bool) {
        userDefaults.set(enabled, forKey: UserDefaultsKeys.forwardingEnabled)
    }
    
    /// Gets the forwarding enabled state
    func isForwardingEnabled() -> Bool {
        return userDefaults.bool(forKey: UserDefaultsKeys.forwardingEnabled)
    }
    
    /// Gets the current call forwarding state
    func getCurrentForwardingState() -> CallForwardingState {
        if isForwardingEnabled(), let number = getForwardingNumber() {
            return .enabled(forwardingNumber: number)
        } else if !isForwardingEnabled() {
            return .disabled
        } else {
            return .unknown
        }
    }
    
    /// Formats phone number to ensure proper format for MMI codes
    func formatPhoneNumber(_ phoneNumber: String) -> String? {
        // Remove all non-digit characters
        let digitsOnly = phoneNumber.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        
        // Validate phone number
        guard digitsOnly.count >= 10 && digitsOnly.count <= 15 else {
            return nil
        }
        
        // Add country code if missing (assume US +1)
        var formattedNumber = digitsOnly
        if formattedNumber.count == 10 {
            formattedNumber = "1" + formattedNumber
        }
        
        // Add + prefix
        return "+" + formattedNumber
    }
    
    /// Validates if a phone number is valid for call forwarding
    func isValidForwardingNumber(_ phoneNumber: String) -> Bool {
        return formatPhoneNumber(phoneNumber) != nil
    }
    
    /// Gets instructions for the specific carrier
    func getCarrierInstructions(for carrier: Carrier) -> [String] {
        switch carrier {
        case .verizon:
            return [
                "1. Dial the MMI code or copy it to your dialer",
                "2. Press the call button to execute the code",
                "3. Wait for confirmation message or tone",
                "4. Test by calling your number from another phone"
            ]
        case .att:
            return [
                "1. Dial the MMI code exactly as shown",
                "2. Press the call button to execute",
                "3. Listen for confirmation tone or message",
                "4. Verify forwarding is active by testing"
            ]
        case .tmobile:
            return [
                "1. Enter the MMI code in your phone's dialer",
                "2. Press call to activate forwarding",
                "3. Wait for system confirmation",
                "4. Test the forwarding setup"
            ]
        case .sprint:
            return [
                "1. Dial the MMI code for conditional forwarding",
                "2. Press call to enable the service",
                "3. Wait for network confirmation",
                "4. Note: Charges may apply for forwarded calls"
            ]
        case .unknown:
            return [
                "1. Try the provided MMI code first",
                "2. If it doesn't work, contact your carrier",
                "3. Some carriers may require different codes",
                "4. You may need to enable this feature through customer service"
            ]
        }
    }
    
    /// Gets carrier-specific notes and warnings
    func getCarrierNotes(for carrier: Carrier) -> [String] {
        switch carrier {
        case .verizon:
            return [
                "• Call forwarding is typically free on unlimited plans",
                "• You may be charged for forwarded call minutes on older plans",
                "• Use *73 to quickly disable forwarding"
            ]
        case .att:
            return [
                "• International forwarding may not be supported",
                "• Some plans include free call forwarding",
                "• Use ##21# to disable all forwarding"
            ]
        case .tmobile:
            return [
                "• Call forwarding is usually included in plans",
                "• Works with both postpaid and prepaid accounts",
                "• Contact 611 if you encounter issues"
            ]
        case .sprint:
            return [
                "• Now part of T-Mobile network",
                "• Legacy Sprint codes may still work",
                "• Conditional forwarding may be free, unconditional may have charges"
            ]
        case .unknown:
            return [
                "• Codes may vary by carrier",
                "• Contact your carrier's customer service for specific instructions",
                "• Some MVNOs may not support call forwarding"
            ]
        }
    }
    
    // MARK: - Private Methods
    
    private func setupInitialState() {
        // Set default values if not already set
        if !userDefaults.bool(forKey: UserDefaultsKeys.forwardingEnabled + "_set") {
            userDefaults.set(false, forKey: UserDefaultsKeys.forwardingEnabled)
            userDefaults.set(true, forKey: UserDefaultsKeys.forwardingEnabled + "_set")
        }
    }
}

// MARK: - Extensions

extension CallForwardingService {
    /// Convenience method to get MMI codes for the current carrier
    func getMMICodesForCurrentCarrier(forwardingNumber: String) -> (enable: String, disable: String) {
        let carrier = getCurrentCarrier()
        let enableCode = generateEnableForwardingCode(carrier: carrier, forwardingNumber: forwardingNumber)
        let disableCode = generateDisableForwardingCode(carrier: carrier)
        return (enable: enableCode, disable: disableCode)
    }
    
    /// Convenience method to get all relevant information for the current carrier
    func getCarrierSetupInfo() -> (carrier: Carrier, instructions: [String], notes: [String]) {
        let carrier = getCurrentCarrier()
        let instructions = getCarrierInstructions(for: carrier)
        let notes = getCarrierNotes(for: carrier)
        return (carrier: carrier, instructions: instructions, notes: notes)
    }
}