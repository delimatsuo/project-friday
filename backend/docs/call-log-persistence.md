# Call Log Persistence Documentation

## Overview
This document describes the call log persistence system that saves call transcripts, summaries, and metadata to Firestore for Project Friday's AI call screening service.

## Architecture

### Components

1. **FirestoreService** (`src/services/firestoreService.js`)
   - Manages all Firestore database operations
   - Handles call log creation, retrieval, and updates
   - Maintains user statistics with atomic transactions
   - Provides search and analytics capabilities

2. **StreamHandler Integration** (`src/handlers/streamHandler.js`)
   - Captures call metadata from Twilio
   - Collects transcripts during conversation
   - Triggers persistence on call termination
   - Extracts caller information from conversation

## Data Model

### CallLogDocument Schema

```javascript
{
  id: string,                    // Auto-generated document ID
  callSid: string,              // Twilio call identifier
  userId: string,               // User who owns the phone number
  phoneNumber: string,          // Caller's phone number
  
  // Timestamps
  callStartTime: Date,          // When call started
  callEndTime: Date,            // When call ended
  createdAt: Date,              // Document creation time
  updatedAt: Date,              // Last update time
  
  // Call Details
  duration: number,             // Call duration in seconds
  transcripts: [{               // Array of conversation transcripts
    text: string,
    timestamp: string,
    isFinal: boolean,
    isAI: boolean,
    confidence: number
  }],
  
  // AI Analysis
  aiSummary: string,            // Generated summary from Gemini
  callerName: string,           // Extracted caller name
  callPurpose: string,          // Extracted call purpose
  urgency: string,              // low/medium/high
  sentiment: string,            // positive/neutral/negative
  actionRequired: boolean,      // Needs follow-up action
  followUpNeeded: boolean,      // Requires callback
  
  // Metadata
  metadata: {
    streamSid: string,
    audioBufferSize: number,
    ...additionalData
  },
  
  // Versioning
  version: number,              // For optimistic locking
  deleted: boolean              // Soft delete flag
}
```

### User Statistics Schema

```javascript
{
  userId: string,               // User identifier
  totalCalls: number,          // Total calls received
  totalDuration: number,       // Total call duration
  lastCallAt: Date,           // Last call timestamp
  createdAt: Date,
  updatedAt: Date
}
```

## Implementation Flow

### 1. Call Initialization
```javascript
// When call connects via WebSocket
1. Extract phone number from Twilio parameters
2. Set userId based on phone ownership
3. Initialize transcript collection
4. Record call start time
```

### 2. During Call
```javascript
// For each transcript
1. Store transcript with metadata
2. Mark AI responses vs user speech
3. Track confidence scores
4. Maintain conversation context
```

### 3. Call Termination
```javascript
// When call ends
1. Stop speech services
2. Calculate call duration
3. Generate AI summary (Gemini)
4. Analyze conversation (sentiment, urgency)
5. Extract caller information
6. Save to Firestore
7. Update user statistics
8. Log completion status
```

## Integration Details

### Twilio Webhook Parameters

The system captures call metadata through TwiML Stream parameters:

```xml
<Stream url="wss://your-server/media-stream">
  <Parameter name="from" value="+1234567890" />
  <Parameter name="callSid" value="CA123..." />
  <Parameter name="userId" value="user_123" />
</Stream>
```

### Caller Information Extraction

The system uses pattern matching to extract:

**Name Detection:**
- "My name is [NAME]"
- "This is [NAME]"
- "I'm [NAME]"
- "I am [NAME]"

**Purpose Detection:**
- "Calling about [PURPOSE]"
- "Regarding [PURPOSE]"
- "Need help with [PURPOSE]"
- "Question about [PURPOSE]"

## Features

### Core Functionality

1. **Automatic Persistence**
   - Saves all calls with transcripts
   - No manual intervention required
   - Handles failures gracefully

2. **AI Enhancement**
   - Automatic summary generation
   - Sentiment analysis
   - Urgency detection
   - Action item extraction

3. **User Statistics**
   - Track call volume
   - Monitor call duration
   - Maintain call history
   - Support analytics

4. **Search Capabilities**
   - Search by phone number
   - Search by transcript text
   - Filter by date range
   - Query by urgency/sentiment

## Error Handling

### Graceful Degradation

1. **Missing AI Service**
   - Saves call without summary
   - Uses default values for analysis
   - Logs continue to be persisted

2. **Firestore Errors**
   - Logs error for monitoring
   - Doesn't interrupt call flow
   - Retries available for critical data

3. **Missing Call Data**
   - Skips persistence if no callSid
   - Uses "Unknown" for missing fields
   - Maintains data integrity

## Testing

### Unit Tests (42 tests)
Located in `tests/firestoreService.test.js`:
- CRUD operations
- Transaction handling
- Error scenarios
- Data validation

### Integration Tests
Located in `tests/integration/callPersistence.test.js`:
- End-to-end persistence flow
- Metadata extraction
- Duration calculation
- Error recovery

## Performance Considerations

### Optimization Strategies

1. **Asynchronous Operations**
   - Non-blocking saves
   - Background processing
   - Parallel API calls

2. **Transaction Management**
   - Atomic user stats updates
   - Consistent data state
   - Optimistic locking

3. **Data Efficiency**
   - Indexed fields for queries
   - Pagination support
   - Selective field retrieval

## Security

### Access Control

1. **User Isolation**
   - Calls scoped to userId
   - No cross-user access
   - Privacy maintained

2. **Data Sanitization**
   - Input validation
   - XSS prevention
   - SQL injection protection

3. **Audit Trail**
   - All operations logged
   - Timestamps tracked
   - Version control

## Monitoring

### Key Metrics

1. **Success Rate**
   ```javascript
   saved_calls / total_calls * 100
   ```

2. **Average Save Time**
   ```javascript
   sum(save_duration) / count(saves)
   ```

3. **Error Rate**
   ```javascript
   failed_saves / total_attempts * 100
   ```

### Logging

```javascript
// Success
console.log('Call log saved to Firestore:', savedLog.id);

// Error
console.error('Error saving call log to Firestore:', error);

// Analytics
console.log('Session summary:', {
  callSid, phoneNumber, duration, saved
});
```

## Database Queries

### Common Queries

```javascript
// Get user's recent calls
const calls = await firestoreService.getUserCalls(userId, {
  limit: 10,
  orderBy: 'callStartTime',
  direction: 'desc'
});

// Search by phone number
const results = await firestoreService.searchCalls('+1234567890');

// Get call analytics
const analytics = await firestoreService.getCallAnalytics({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  userId: 'user_123'
});
```

## Future Enhancements

1. **Real-time Updates**
   - WebSocket notifications
   - Live transcript streaming
   - Progress indicators

2. **Advanced Analytics**
   - Call patterns analysis
   - Peak time detection
   - Caller relationship mapping

3. **Export Capabilities**
   - CSV/PDF export
   - Bulk data download
   - API access

4. **Retention Policies**
   - Automatic archival
   - Data lifecycle management
   - GDPR compliance

## Troubleshooting

### Common Issues

1. **Calls not being saved**
   - Verify Firestore initialization
   - Check callSid presence
   - Review error logs

2. **Missing caller information**
   - Enhance extraction patterns
   - Add NLP processing
   - Validate transcript quality

3. **Slow persistence**
   - Check network latency
   - Optimize batch operations
   - Review index configuration

### Debug Commands

```bash
# Check Firestore connection
firebase firestore:databases:list

# View recent calls
firebase firestore:export gs://backup-bucket

# Monitor real-time
firebase functions:log --only handleCallWithStream
```

## References

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/twiml/stream)
- [Transaction Best Practices](https://firebase.google.com/docs/firestore/manage-data/transactions)