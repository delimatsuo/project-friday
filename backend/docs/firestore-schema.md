# Firestore Database Schema

## Collections Overview

Project Friday uses two primary collections in Firestore to manage user data and call logs.

## 1. Users Collection

**Collection Path:** `/users/{userId}`

### Document Structure

```javascript
{
  // User Profile
  uid: string,              // Firebase Auth UID (document ID)
  email: string,            // User's email address
  displayName: string,      // User's display name
  photoURL: string?,        // Optional profile photo URL
  
  // Account Settings
  isScreeningActive: boolean,  // Whether call screening is enabled
  twilioPhoneNumber: string?,  // Assigned Twilio phone number
  fcmToken: string?,           // Firebase Cloud Messaging token for push notifications
  
  // Preferences
  preferences: {
    defaultGreeting: string?,     // Custom greeting for callers
    blockUnknownNumbers: boolean, // Block calls from unknown numbers
    businessHoursOnly: boolean,   // Only screen during business hours
    timezone: string,             // User's timezone (e.g., "America/New_York")
  },
  
  // Metadata
  createdAt: timestamp,     // Account creation timestamp
  updatedAt: timestamp,     // Last profile update
  lastActive: timestamp?,   // Last app activity
  
  // Subscription (for future use)
  subscriptionTier: string, // "free", "premium", etc.
  subscriptionExpiry: timestamp?
}
```

## 2. Call Logs Collection

**Collection Path:** `/call_logs/{logId}`

### Document Structure

```javascript
{
  // Call Identification
  logId: string,            // Auto-generated document ID
  userId: string,           // Owner's Firebase Auth UID
  twilioCallSid: string,    // Twilio's unique call identifier
  
  // Caller Information
  callerId: string,         // Caller's phone number
  callerName: string?,      // Caller's name if available
  callerLocation: string?,  // Caller's location if available
  
  // Call Details
  callStartTime: timestamp, // When the call began
  callEndTime: timestamp,   // When the call ended
  duration: number,         // Call duration in seconds
  callStatus: string,       // "completed", "no-answer", "busy", "failed"
  
  // AI Screening Results
  fullTranscript: string,   // Complete conversation transcript
  aiSummary: string,        // AI-generated one-sentence summary
  callerIntent: string?,    // AI-detected caller intent
  urgencyLevel: string?,    // "low", "medium", "high"
  
  // Actions
  wasForwarded: boolean,    // Whether call was forwarded to user
  userAction: string?,      // "callback", "blocked", "archived"
  actionTimestamp: timestamp?, // When user took action
  
  // Media
  audioRecordingUrl: string?, // Twilio recording URL
  
  // Metadata
  createdAt: timestamp,     // Document creation timestamp
  updatedAt: timestamp,     // Last update timestamp
}
```

## 3. Security Rules Structure

### Users Collection Rules
- Users can only read and write their own document
- Document ID must match the authenticated user's UID

### Call Logs Collection Rules
- Users can only read call logs where userId matches their UID
- Only authenticated Cloud Functions can write call logs
- Users can update certain fields (userAction, actionTimestamp)

## 4. Indexes Required

### Call Logs Indexes
1. **Composite Index:** userId (ASC) + callStartTime (DESC)
   - For fetching user's calls in chronological order
   
2. **Composite Index:** userId (ASC) + urgencyLevel (ASC) + callStartTime (DESC)
   - For filtering calls by urgency

## 5. Sample Documents

### Sample User Document
```javascript
{
  uid: "user123",
  email: "john.doe@example.com",
  displayName: "John Doe",
  photoURL: null,
  isScreeningActive: true,
  twilioPhoneNumber: "+14155551234",
  fcmToken: "fcm_token_here",
  preferences: {
    defaultGreeting: "Hello, John is not available right now. May I know who's calling?",
    blockUnknownNumbers: false,
    businessHoursOnly: false,
    timezone: "America/Los_Angeles"
  },
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  lastActive: Timestamp.now(),
  subscriptionTier: "free",
  subscriptionExpiry: null
}
```

### Sample Call Log Document
```javascript
{
  logId: "log456",
  userId: "user123",
  twilioCallSid: "CA1234567890abcdef",
  callerId: "+14085551234",
  callerName: "Jane Smith",
  callerLocation: "San Jose, CA",
  callStartTime: Timestamp.fromDate(new Date("2024-01-15T14:30:00Z")),
  callEndTime: Timestamp.fromDate(new Date("2024-01-15T14:32:30Z")),
  duration: 150,
  callStatus: "completed",
  fullTranscript: "AI: Hello, John is not available. May I know who's calling?\nCaller: Hi, this is Jane from ABC Company...",
  aiSummary: "Jane from ABC Company calling about a job opportunity.",
  callerIntent: "business",
  urgencyLevel: "medium",
  wasForwarded: false,
  userAction: null,
  actionTimestamp: null,
  audioRecordingUrl: "https://api.twilio.com/recordings/...",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
}
```

## Migration & Evolution

This schema is designed to be extensible. Future additions may include:
- Call categories/tags
- Multiple phone numbers per user
- Team/family account support
- Advanced AI insights
- Call scheduling preferences