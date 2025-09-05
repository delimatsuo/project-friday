import XCTest
import CoreTelephony
@testable import ProjectFriday

final class CallForwardingServiceTests: XCTestCase {
    var callForwardingService: CallForwardingService!
    var mockCarrierName: String?
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        callForwardingService = CallForwardingService()
    }
    
    override func tearDownWithError() throws {
        callForwardingService = nil
        mockCarrierName = nil
        try super.tearDownWithError()
    }
    
    // MARK: - Carrier Detection Tests
    
    func testDetectVerizonCarrier() throws {
        // Given
        let verizonCarrierNames = ["Verizon", "VZW", "Verizon Wireless"]
        
        for carrierName in verizonCarrierNames {
            // When
            let detectedCarrier = callForwardingService.detectCarrier(from: carrierName)
            
            // Then
            XCTAssertEqual(detectedCarrier, .verizon, "Failed to detect Verizon for carrier name: \(carrierName)")
        }
    }
    
    func testDetectATTCarrier() throws {
        // Given
        let attCarrierNames = ["AT&T", "ATT", "AT&T Mobility"]
        
        for carrierName in attCarrierNames {
            // When
            let detectedCarrier = callForwardingService.detectCarrier(from: carrierName)
            
            // Then
            XCTAssertEqual(detectedCarrier, .att, "Failed to detect AT&T for carrier name: \(carrierName)")
        }
    }
    
    func testDetectTMobileCarrier() throws {
        // Given
        let tmobileCarrierNames = ["T-Mobile", "T-Mobile USA", "TMO"]
        
        for carrierName in tmobileCarrierNames {
            // When
            let detectedCarrier = callForwardingService.detectCarrier(from: carrierName)
            
            // Then
            XCTAssertEqual(detectedCarrier, .tmobile, "Failed to detect T-Mobile for carrier name: \(carrierName)")
        }
    }
    
    func testDetectSprintCarrier() throws {
        // Given
        let sprintCarrierNames = ["Sprint", "Sprint Spectrum"]
        
        for carrierName in sprintCarrierNames {
            // When
            let detectedCarrier = callForwardingService.detectCarrier(from: carrierName)
            
            // Then
            XCTAssertEqual(detectedCarrier, .sprint, "Failed to detect Sprint for carrier name: \(carrierName)")
        }
    }
    
    func testDetectUnknownCarrier() throws {
        // Given
        let unknownCarrierNames = ["Unknown Carrier", "Test Network", ""]
        
        for carrierName in unknownCarrierNames {
            // When
            let detectedCarrier = callForwardingService.detectCarrier(from: carrierName)
            
            // Then
            XCTAssertEqual(detectedCarrier, .unknown, "Should detect unknown for carrier name: \(carrierName)")
        }
    }
    
    // MARK: - MMI Code Generation Tests
    
    func testVerizonEnableForwardingMMICode() throws {
        // Given
        let forwardingNumber = "+15551234567"
        let expectedCode = "*72+15551234567"
        
        // When
        let mmiCode = callForwardingService.generateEnableForwardingCode(
            carrier: .verizon,
            forwardingNumber: forwardingNumber
        )
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    func testVerizonDisableForwardingMMICode() throws {
        // Given
        let expectedCode = "*73"
        
        // When
        let mmiCode = callForwardingService.generateDisableForwardingCode(carrier: .verizon)
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    func testATTEnableForwardingMMICode() throws {
        // Given
        let forwardingNumber = "+15551234567"
        let expectedCode = "**21*+15551234567#"
        
        // When
        let mmiCode = callForwardingService.generateEnableForwardingCode(
            carrier: .att,
            forwardingNumber: forwardingNumber
        )
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    func testATTDisableForwardingMMICode() throws {
        // Given
        let expectedCode = "##21#"
        
        // When
        let mmiCode = callForwardingService.generateDisableForwardingCode(carrier: .att)
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    func testTMobileEnableForwardingMMICode() throws {
        // Given
        let forwardingNumber = "+15551234567"
        let expectedCode = "*72+15551234567"
        
        // When
        let mmiCode = callForwardingService.generateEnableForwardingCode(
            carrier: .tmobile,
            forwardingNumber: forwardingNumber
        )
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    func testTMobileDisableForwardingMMICode() throws {
        // Given
        let expectedCode = "*73"
        
        // When
        let mmiCode = callForwardingService.generateDisableForwardingCode(carrier: .tmobile)
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    func testSprintEnableConditionalForwardingMMICode() throws {
        // Given
        let forwardingNumber = "+15551234567"
        let expectedCode = "*28+15551234567"
        
        // When
        let mmiCode = callForwardingService.generateEnableConditionalForwardingCode(
            carrier: .sprint,
            forwardingNumber: forwardingNumber
        )
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    func testSprintDisableConditionalForwardingMMICode() throws {
        // Given
        let expectedCode = "*38"
        
        // When
        let mmiCode = callForwardingService.generateDisableConditionalForwardingCode(carrier: .sprint)
        
        // Then
        XCTAssertEqual(mmiCode, expectedCode)
    }
    
    // MARK: - Forwarding State Management Tests
    
    func testSetForwardingNumber() throws {
        // Given
        let testNumber = "+15551234567"
        
        // When
        callForwardingService.setForwardingNumber(testNumber)
        
        // Then
        let storedNumber = callForwardingService.getForwardingNumber()
        XCTAssertEqual(storedNumber, testNumber)
    }
    
    func testGetForwardingNumberWhenNotSet() throws {
        // Given - no forwarding number set
        
        // When
        let forwardingNumber = callForwardingService.getForwardingNumber()
        
        // Then
        XCTAssertNil(forwardingNumber)
    }
    
    func testSetForwardingEnabled() throws {
        // Given
        let isEnabled = true
        
        // When
        callForwardingService.setForwardingEnabled(isEnabled)
        
        // Then
        let storedState = callForwardingService.isForwardingEnabled()
        XCTAssertEqual(storedState, isEnabled)
    }
    
    func testSetForwardingDisabled() throws {
        // Given
        let isEnabled = false
        
        // When
        callForwardingService.setForwardingEnabled(isEnabled)
        
        // Then
        let storedState = callForwardingService.isForwardingEnabled()
        XCTAssertEqual(storedState, isEnabled)
    }
    
    func testDefaultForwardingState() throws {
        // Given - fresh service instance
        let freshService = CallForwardingService()
        
        // When
        let defaultState = freshService.isForwardingEnabled()
        
        // Then
        XCTAssertFalse(defaultState, "Default forwarding state should be disabled")
    }
    
    // MARK: - Phone Number Formatting Tests
    
    func testFormatPhoneNumberWithCountryCode() throws {
        // Given
        let inputNumbers = [
            "15551234567",
            "+15551234567",
            "1-555-123-4567",
            "(555) 123-4567"
        ]
        let expectedOutput = "+15551234567"
        
        for inputNumber in inputNumbers {
            // When
            let formattedNumber = callForwardingService.formatPhoneNumber(inputNumber)
            
            // Then
            XCTAssertEqual(formattedNumber, expectedOutput, "Failed to format: \(inputNumber)")
        }
    }
    
    func testFormatInvalidPhoneNumber() throws {
        // Given
        let invalidNumbers = ["", "123", "abc123def", "1234567890123456"]
        
        for invalidNumber in invalidNumbers {
            // When
            let formattedNumber = callForwardingService.formatPhoneNumber(invalidNumber)
            
            // Then
            XCTAssertNil(formattedNumber, "Should return nil for invalid number: \(invalidNumber)")
        }
    }
    
    // MARK: - Integration Tests
    
    func testCompleteForwardingSetupFlow() throws {
        // Given
        let forwardingNumber = "+15551234567"
        let carrier = Carrier.verizon
        
        // When - Setup forwarding
        callForwardingService.setForwardingNumber(forwardingNumber)
        callForwardingService.setForwardingEnabled(true)
        let enableCode = callForwardingService.generateEnableForwardingCode(
            carrier: carrier,
            forwardingNumber: forwardingNumber
        )
        
        // Then
        XCTAssertEqual(callForwardingService.getForwardingNumber(), forwardingNumber)
        XCTAssertTrue(callForwardingService.isForwardingEnabled())
        XCTAssertEqual(enableCode, "*72+15551234567")
        
        // When - Disable forwarding
        callForwardingService.setForwardingEnabled(false)
        let disableCode = callForwardingService.generateDisableForwardingCode(carrier: carrier)
        
        // Then
        XCTAssertFalse(callForwardingService.isForwardingEnabled())
        XCTAssertEqual(disableCode, "*73")
    }
    
    // MARK: - Error Handling Tests
    
    func testGenerateCodeWithEmptyForwardingNumber() throws {
        // Given
        let emptyNumber = ""
        
        // When
        let mmiCode = callForwardingService.generateEnableForwardingCode(
            carrier: .verizon,
            forwardingNumber: emptyNumber
        )
        
        // Then
        XCTAssertEqual(mmiCode, "*72", "Should handle empty forwarding number gracefully")
    }
    
    func testGenerateCodeForUnknownCarrier() throws {
        // Given
        let forwardingNumber = "+15551234567"
        
        // When
        let enableCode = callForwardingService.generateEnableForwardingCode(
            carrier: .unknown,
            forwardingNumber: forwardingNumber
        )
        let disableCode = callForwardingService.generateDisableForwardingCode(carrier: .unknown)
        
        // Then
        XCTAssertEqual(enableCode, "*72+15551234567", "Should use default GSM codes for unknown carrier")
        XCTAssertEqual(disableCode, "*73", "Should use default GSM codes for unknown carrier")
    }
    
    // MARK: - Performance Tests
    
    func testCarrierDetectionPerformance() throws {
        // Given
        let carrierName = "Verizon Wireless"
        
        // Then
        measure {
            // When
            _ = callForwardingService.detectCarrier(from: carrierName)
        }
    }
    
    func testMMICodeGenerationPerformance() throws {
        // Given
        let forwardingNumber = "+15551234567"
        let carrier = Carrier.verizon
        
        // Then
        measure {
            // When
            _ = callForwardingService.generateEnableForwardingCode(
                carrier: carrier,
                forwardingNumber: forwardingNumber
            )
        }
    }
}

// MARK: - Test Helpers

extension CallForwardingServiceTests {
    func createMockCarrier(name: String) -> CTCarrier {
        // This would be used if we needed to mock CTCarrier
        // For now, we'll test with string-based carrier detection
        return CTCarrier()
    }
}