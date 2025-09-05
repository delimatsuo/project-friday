import Foundation
import Firebase
import FirebaseFirestore
import Combine

protocol CallLogServiceProtocol {
    func fetchCallLogs(for userId: String) async throws -> [CallLog]
    func addRealTimeListener(for userId: String, completion: @escaping ([CallLog]?, Error?) -> Void) -> ListenerRegistration
    func removeListener(_ listener: ListenerRegistration)
    func markAsRead(callLogId: String, userId: String) async throws
    func deleteCallLog(callLogId: String, userId: String) async throws
    func searchCallLogs(_ callLogs: [CallLog], searchText: String) -> [CallLog]
}

class CallLogService: CallLogServiceProtocol, ObservableObject {
    
    private let db = Firestore.firestore()
    private var listeners: [String: ListenerRegistration] = [:]
    
    init() {
        configureFirestore()
    }
    
    private func configureFirestore() {
        #if DEBUG
        // Use Firestore emulator in debug mode
        let settings = Firestore.firestore().settings
        if settings.host == "localhost:8080" {
            // Already configured for emulator
        } else {
            settings.host = "localhost:8080"
            settings.isSSLEnabled = false
            db.settings = settings
        }
        #endif
    }
    
    // MARK: - Fetch Call Logs
    
    func fetchCallLogs(for userId: String) async throws -> [CallLog] {
        do {
            let snapshot = try await db.collection("call_logs")
                .whereField("userId", isEqualTo: userId)
                .order(by: "timestamp", descending: true)
                .getDocuments()
            
            let callLogs = try snapshot.documents.compactMap { document -> CallLog? in
                let data = document.data()
                return try? CallLog.fromDictionary(data)
            }
            
            return callLogs
        } catch {
            throw CallLogError.firestoreError(error)
        }
    }
    
    // MARK: - Real-time Listener
    
    func addRealTimeListener(for userId: String, completion: @escaping ([CallLog]?, Error?) -> Void) -> ListenerRegistration {
        let listener = db.collection("call_logs")
            .whereField("userId", isEqualTo: userId)
            .order(by: "timestamp", descending: true)
            .addSnapshotListener { querySnapshot, error in
                
                if let error = error {
                    completion(nil, CallLogError.firestoreError(error))
                    return
                }
                
                guard let documents = querySnapshot?.documents else {
                    completion([], nil)
                    return
                }
                
                let callLogs = documents.compactMap { document -> CallLog? in
                    let data = document.data()
                    return try? CallLog.fromDictionary(data)
                }
                
                DispatchQueue.main.async {
                    completion(callLogs, nil)
                }
            }
        
        // Store listener for cleanup
        listeners[userId] = listener
        return listener
    }
    
    func removeListener(_ listener: ListenerRegistration) {
        listener.remove()
        
        // Remove from stored listeners
        listeners = listeners.filter { $0.value !== listener }
    }
    
    func removeAllListeners() {
        listeners.values.forEach { $0.remove() }
        listeners.removeAll()
    }
    
    // MARK: - Update Operations
    
    func markAsRead(callLogId: String, userId: String) async throws {
        do {
            let docRef = db.collection("call_logs").document(callLogId)
            
            // Verify the document belongs to the user before updating
            let document = try await docRef.getDocument()
            guard document.exists,
                  let data = document.data(),
                  let docUserId = data["userId"] as? String,
                  docUserId == userId else {
                throw CallLogError.invalidData
            }
            
            try await docRef.updateData([
                "isRead": true,
                "updatedAt": Timestamp(date: Date())
            ])
        } catch {
            throw CallLogError.firestoreError(error)
        }
    }
    
    func deleteCallLog(callLogId: String, userId: String) async throws {
        do {
            let docRef = db.collection("call_logs").document(callLogId)
            
            // Verify the document belongs to the user before deleting
            let document = try await docRef.getDocument()
            guard document.exists,
                  let data = document.data(),
                  let docUserId = data["userId"] as? String,
                  docUserId == userId else {
                throw CallLogError.invalidData
            }
            
            try await docRef.delete()
        } catch {
            throw CallLogError.firestoreError(error)
        }
    }
    
    // MARK: - Search and Filter
    
    func searchCallLogs(_ callLogs: [CallLog], searchText: String) -> [CallLog] {
        guard !searchText.isEmpty else {
            return callLogs
        }
        
        return callLogs.filter { $0.matchesSearch(searchText) }
    }
    
    func filterUnreadCallLogs(_ callLogs: [CallLog]) -> [CallLog] {
        return callLogs.filter { !$0.isRead }
    }
    
    func groupCallLogsByDate(_ callLogs: [CallLog]) -> [(String, [CallLog])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: callLogs) { callLog in
            calendar.startOfDay(for: callLog.timestamp)
        }
        
        let sortedKeys = grouped.keys.sorted(by: >)
        
        return sortedKeys.map { date in
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            
            let title: String
            if calendar.isDateInToday(date) {
                title = "Today"
            } else if calendar.isDateInYesterday(date) {
                title = "Yesterday"
            } else {
                title = formatter.string(from: date)
            }
            
            return (title, grouped[date] ?? [])
        }
    }
    
    // MARK: - Helper Methods
    
    func getUnreadCount(for userId: String) async throws -> Int {
        do {
            let snapshot = try await db.collection("call_logs")
                .whereField("userId", isEqualTo: userId)
                .whereField("isRead", isEqualTo: false)
                .getDocuments()
            
            return snapshot.documents.count
        } catch {
            throw CallLogError.firestoreError(error)
        }
    }
    
    deinit {
        removeAllListeners()
    }
}

// MARK: - CallLogService Extensions

extension CallLogService {
    
    // Bulk operations
    func markAllAsRead(for userId: String) async throws {
        do {
            let snapshot = try await db.collection("call_logs")
                .whereField("userId", isEqualTo: userId)
                .whereField("isRead", isEqualTo: false)
                .getDocuments()
            
            let batch = db.batch()
            
            for document in snapshot.documents {
                batch.updateData([
                    "isRead": true,
                    "updatedAt": Timestamp(date: Date())
                ], forDocument: document.reference)
            }
            
            try await batch.commit()
        } catch {
            throw CallLogError.firestoreError(error)
        }
    }
    
    func deleteAllCallLogs(for userId: String) async throws {
        do {
            let snapshot = try await db.collection("call_logs")
                .whereField("userId", isEqualTo: userId)
                .getDocuments()
            
            let batch = db.batch()
            
            for document in snapshot.documents {
                batch.deleteDocument(document.reference)
            }
            
            try await batch.commit()
        } catch {
            throw CallLogError.firestoreError(error)
        }
    }
}