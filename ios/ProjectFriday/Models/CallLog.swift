import Foundation
import Firebase
import FirebaseFirestore

struct CallLog: Identifiable, Codable {
    let id: String
    let userId: String
    let callerId: String
    let callerName: String?
    let timestamp: Date
    let duration: Int // Duration in seconds
    let fullTranscript: String
    let aiSummary: String
    let audioRecordingUrl: String?
    var isRead: Bool
    
    // Additional computed properties for UI display
    var displayName: String {
        if let callerName = callerName, !callerName.isEmpty {
            return callerName
        }
        return formattedCallerId
    }
    
    var formattedCallerId: String {
        // Format phone number for display
        let cleaned = callerId.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        
        if cleaned.count == 10 {
            // US format: (XXX) XXX-XXXX
            let areaCode = String(cleaned.prefix(3))
            let firstThree = String(cleaned.dropFirst(3).prefix(3))
            let lastFour = String(cleaned.suffix(4))
            return "(\(areaCode)) \(firstThree)-\(lastFour)"
        } else if cleaned.count == 11 && cleaned.hasPrefix("1") {
            // US format with country code: +1 (XXX) XXX-XXXX
            let number = String(cleaned.dropFirst())
            let areaCode = String(number.prefix(3))
            let firstThree = String(number.dropFirst(3).prefix(3))
            let lastFour = String(number.suffix(4))
            return "+1 (\(areaCode)) \(firstThree)-\(lastFour)"
        }
        
        return callerId // Return original if can't format
    }
    
    var formattedDuration: String {
        let minutes = duration / 60
        let seconds = duration % 60
        
        if minutes > 0 {
            return String(format: "%d:%02d", minutes, seconds)
        } else {
            return String(format: "0:%02d", seconds)
        }
    }
    
    var relativeTimeString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: timestamp, relativeTo: Date())
    }
    
    // Coding keys for Firestore serialization
    enum CodingKeys: String, CodingKey {
        case id
        case userId
        case callerId
        case callerName
        case timestamp
        case duration
        case fullTranscript
        case aiSummary
        case audioRecordingUrl
        case isRead
    }
    
    init(id: String, userId: String, callerId: String, callerName: String? = nil, 
         timestamp: Date, duration: Int, fullTranscript: String, aiSummary: String, 
         audioRecordingUrl: String? = nil, isRead: Bool = false) {
        self.id = id
        self.userId = userId
        self.callerId = callerId
        self.callerName = callerName
        self.timestamp = timestamp
        self.duration = duration
        self.fullTranscript = fullTranscript
        self.aiSummary = aiSummary
        self.audioRecordingUrl = audioRecordingUrl
        self.isRead = isRead
    }
    
    // Custom decoder to handle Firestore Timestamp
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decode(String.self, forKey: .userId)
        callerId = try container.decode(String.self, forKey: .callerId)
        callerName = try container.decodeIfPresent(String.self, forKey: .callerName)
        duration = try container.decode(Int.self, forKey: .duration)
        fullTranscript = try container.decode(String.self, forKey: .fullTranscript)
        aiSummary = try container.decode(String.self, forKey: .aiSummary)
        audioRecordingUrl = try container.decodeIfPresent(String.self, forKey: .audioRecordingUrl)
        isRead = try container.decode(Bool.self, forKey: .isRead)
        
        // Handle timestamp - could be Date or Firestore Timestamp
        if let date = try? container.decode(Date.self, forKey: .timestamp) {
            timestamp = date
        } else {
            // Fallback to current date if decoding fails
            timestamp = Date()
        }
    }
    
    // Custom encoder for Firestore
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(userId, forKey: .userId)
        try container.encode(callerId, forKey: .callerId)
        try container.encodeIfPresent(callerName, forKey: .callerName)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(duration, forKey: .duration)
        try container.encode(fullTranscript, forKey: .fullTranscript)
        try container.encode(aiSummary, forKey: .aiSummary)
        try container.encodeIfPresent(audioRecordingUrl, forKey: .audioRecordingUrl)
        try container.encode(isRead, forKey: .isRead)
    }
    
    // Convert to dictionary for Firestore
    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "id": id,
            "userId": userId,
            "callerId": callerId,
            "timestamp": Timestamp(date: timestamp),
            "duration": duration,
            "fullTranscript": fullTranscript,
            "aiSummary": aiSummary,
            "isRead": isRead
        ]
        
        if let callerName = callerName {
            dict["callerName"] = callerName
        }
        
        if let audioRecordingUrl = audioRecordingUrl {
            dict["audioRecordingUrl"] = audioRecordingUrl
        }
        
        return dict
    }
    
    // Create from Firestore dictionary
    static func fromDictionary(_ data: [String: Any]) throws -> CallLog {
        guard let id = data["id"] as? String,
              let userId = data["userId"] as? String,
              let callerId = data["callerId"] as? String,
              let duration = data["duration"] as? Int,
              let fullTranscript = data["fullTranscript"] as? String,
              let aiSummary = data["aiSummary"] as? String else {
            throw CallLogError.invalidData
        }
        
        let callerName = data["callerName"] as? String
        let audioRecordingUrl = data["audioRecordingUrl"] as? String
        let isRead = data["isRead"] as? Bool ?? false
        
        // Handle timestamp conversion from Firestore
        var timestamp = Date()
        if let firestoreTimestamp = data["timestamp"] as? Timestamp {
            timestamp = firestoreTimestamp.dateValue()
        } else if let date = data["timestamp"] as? Date {
            timestamp = date
        }
        
        return CallLog(
            id: id,
            userId: userId,
            callerId: callerId,
            callerName: callerName,
            timestamp: timestamp,
            duration: duration,
            fullTranscript: fullTranscript,
            aiSummary: aiSummary,
            audioRecordingUrl: audioRecordingUrl,
            isRead: isRead
        )
    }
    
    // Mark call as read
    mutating func markAsRead() {
        isRead = true
    }
}

// MARK: - CallLog Extensions

extension CallLog {
    // For sorting by timestamp (newest first)
    static func sortByNewest(lhs: CallLog, rhs: CallLog) -> Bool {
        return lhs.timestamp > rhs.timestamp
    }
    
    // Check if call matches search text
    func matchesSearch(_ searchText: String) -> Bool {
        guard !searchText.isEmpty else { return true }
        
        let lowercasedSearch = searchText.lowercased()
        
        return displayName.lowercased().contains(lowercasedSearch) ||
               callerId.contains(searchText) ||
               aiSummary.lowercased().contains(lowercasedSearch) ||
               fullTranscript.lowercased().contains(lowercasedSearch)
    }
}

// MARK: - CallLog Errors

enum CallLogError: LocalizedError {
    case invalidData
    case firestoreError(Error)
    case networkError
    
    var errorDescription: String? {
        switch self {
        case .invalidData:
            return "Invalid call log data received"
        case .firestoreError(let error):
            return "Database error: \(error.localizedDescription)"
        case .networkError:
            return "Network connection failed. Please check your internet connection."
        }
    }
}