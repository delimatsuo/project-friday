# Product Requirements Document: Project Friday

**Version:** 1.1 (Detailed for Development)  
**Status:** Draft for Development Team  
**Target Release:** V1.0 - The Personal Assistant

# Overview

Project Friday is an iOS application that gives individuals back their time and peace of mind by intelligently managing their phone calls. The app uses a sophisticated AI assistant, powered by Gemini 2.5 Flash, to screen incoming calls on the user's behalf through a server-side architecture.

**Problem:** Busy professionals and focused individuals are constantly interrupted by unwanted calls, but they risk missing important calls from unknown numbers (doctor's office, new clients, emergencies).

**Solution:** An AI-powered call screening service that handles calls server-side via Twilio, using advanced conversation AI to determine call importance and provide intelligent summaries to users.

**Value:** Users reclaim their focus time while never missing truly important calls, with AI handling the screening process professionally and transparently.

# Core Features

## 1. Intelligent Call Screening
- **What:** AI assistant powered by Gemini 2.5 Flash conducts real-time conversations with callers
- **Why:** Filters out spam/sales calls while identifying legitimate important calls
- **How:** Server-side processing through Cloud Functions integrated with Twilio voice webhooks

## 2. Call Log Management
- **What:** Complete call history with AI-generated summaries and full transcripts
- **Why:** Users can review what they missed and take appropriate follow-up actions
- **How:** Real-time Firestore database with structured call data and search capabilities

## 3. One-Touch Call Forwarding Setup
- **What:** Guided setup for conditional call forwarding with carrier-specific instructions
- **Why:** Seamless activation without technical complexity for users
- **How:** Pre-configured MMI codes with copy/dial functionality in iOS app

## 4. Smart Notifications
- **What:** Instant push notifications with AI call summaries when screening completes
- **Why:** Users stay informed of important calls without constant phone checking
- **How:** Firebase Cloud Messaging with intelligent summary generation

## 5. Service Toggle Control
- **What:** Home screen widget and in-app controls to enable/disable call screening
- **Why:** Users need quick control over when the service is active
- **How:** Real-time sync with Firestore user preferences and backend logic

# User Experience

## User Personas
**Primary:** The Busy Professional & The Focused Individual
- Frequently interrupted by unwanted calls
- Values deep work and concentration
- Needs to filter noise while avoiding missed opportunities
- Uses iPhone as primary communication device

## Key User Flows

### Onboarding Flow
1. Account creation (Email/Password, Google, Apple Sign-in)
2. Permissions walkthrough (Push Notifications, Contacts)
3. Call forwarding setup with carrier-specific MMI codes
4. Service activation and testing

### Daily Usage Flow
1. User declines incoming call → triggers call forwarding
2. AI assistant handles conversation with caller server-side
3. User receives push notification with AI summary
4. User reviews call log and takes action (call back, block, add contact)

### Call Review Flow
1. Access call log inbox with recent calls at top
2. Tap call for full transcript and details
3. Use action buttons (Call Back, Add to Contacts, Block Number)
4. Optional audio playback of recorded conversation

## UI/UX Considerations
- Clean, iOS-native design patterns
- Minimal setup friction with clear permission explanations
- Quick access controls via widget and in-app toggles
- Intuitive call log interface with clear visual hierarchy

# Technical Architecture

## System Components

### iOS App (Swift)
- Firebase Authentication integration
- Firestore real-time listeners for call logs
- Firebase Cloud Messaging for push notifications
- Home Screen Widget (WidgetKit)
- CallKit integration for forwarding setup

### Backend Services (Google Cloud)
- **Cloud Functions:** Handle Twilio voice webhooks
- **Firestore:** User profiles and call logs storage
- **Firebase Cloud Messaging:** Push notification delivery
- **Cloud Storage:** Audio recording storage (optional)

### Third-Party Integrations
- **Twilio:** Phone number provisioning and voice handling
- **Gemini 2.5 Flash API:** Conversational AI processing
- **Google Speech-to-Text:** Audio transcription
- **Google Text-to-Speech:** AI response synthesis

## Data Models

### User Document (Firestore)
```json
{
  "userId": "string",
  "twilioNumber": "string", 
  "isScreeningActive": "boolean",
  "createdAt": "timestamp"
}
```

### Call Log Document (Firestore)
```json
{
  "callerId": "string",
  "timestamp": "timestamp",
  "duration": "number",
  "fullTranscript": "string",
  "aiSummary": "string",
  "audioRecordingUrl": "string",
  "userId": "string"
}
```

## APIs and Integrations
- **Firebase Authentication:** Multi-provider auth
- **Firestore REST API:** Real-time data sync
- **Twilio Voice API:** Telephony handling and webhooks
- **Gemini API:** Direct server-side AI processing
- **Google Speech APIs:** Audio transcription and synthesis
- **FCM API:** Push notification delivery

## Infrastructure Requirements
- **Google Cloud Project:** Firebase-enabled with billing
- **Twilio Account:** Phone number pool and voice capabilities
- **Gemini API Access:** Server-side integration for Cloud Functions
- **App Store Developer Account:** iOS app distribution

# Development Roadmap

## MVP Requirements (V1.0)

### Phase 1: Core Infrastructure
- Firebase project setup and authentication
- Twilio account configuration and number provisioning
- Basic Cloud Function for call handling
- Firestore schema and security rules

### Phase 2: AI Call Screening Engine
- Gemini 2.5 Flash integration for conversational AI
- Google Speech-to-Text for transcription
- Google Text-to-Speech for responses
- Call data persistence and push notifications

### Phase 3: iOS Application
- User onboarding and authentication screens
- Permissions walkthrough implementation
- Call forwarding setup with MMI codes
- Call log interface with real-time updates

### Phase 4: Production Readiness
- Comprehensive error handling and edge cases
- Performance optimization for <1.5s latency
- Security hardening and rate limiting
- Load testing and scalability verification

## Future Enhancements (V2.0+)
- Custom screening scripts and personalization
- Advanced scheduling integration
- Siri integration and voice commands
- Android application
- Detailed analytics and reporting
- Professional assistant features

# Logical Dependency Chain

## Foundation Layer (Build First)
1. **Firebase Setup:** Project configuration, authentication, and Firestore schema
2. **Twilio Integration:** Account setup, phone number provisioning, webhook configuration
3. **Basic iOS App:** Minimal UI for testing authentication and setup flow

## Core Service Layer (Build Second)
4. **Call Handling Function:** Basic Cloud Function to receive Twilio webhooks
5. **AI Integration:** Gemini API integration with transcription and synthesis
6. **Data Persistence:** Call logging to Firestore with push notifications

## User Interface Layer (Build Third)
7. **Onboarding Flow:** Complete user setup experience with permissions
8. **Call Log Interface:** Display and interact with screened calls
9. **Service Controls:** Toggle functionality and widget implementation

## Production Polish (Build Last)
10. **Error Handling:** Comprehensive edge case coverage
11. **Performance Optimization:** Latency reduction and reliability improvements
12. **Security & Scalability:** Production-grade security and load testing

**Atomic Development Approach:** Each phase delivers a working, testable component that can be built upon. Phase 1 establishes authentication and data flow, Phase 2 creates the core screening engine, Phase 3 provides user interface, and Phase 4 ensures production readiness.

# Risks and Mitigations

## Technical Challenges

### AI Latency Requirements
- **Risk:** Achieving <1.5 second response time for natural conversation
- **Mitigation:** Use Gemini 2.5 Flash (optimized for speed), implement streaming responses, optimize Cloud Function cold starts

### Telephony Integration Complexity
- **Risk:** Complex audio streaming and bidirectional communication with Twilio
- **Mitigation:** Start with basic call handling, incrementally add streaming, extensive testing with various call scenarios

### iOS Call Forwarding Setup
- **Risk:** Carrier-specific differences in call forwarding codes and setup
- **Mitigation:** Comprehensive carrier database, fallback to manual instructions, user testing across carriers

## MVP Strategy

### Core MVP Definition
- **Minimum Viable:** Call screening that works reliably for basic scenarios
- **Essential Features:** Authentication, call forwarding setup, basic AI screening, call log viewing
- **Success Criteria:** 90%+ successful call interception and basic conversation handling

### Iterative Improvement Path
1. **V1.0:** Reliable basic screening with simple conversation patterns
2. **V1.1:** Enhanced AI conversation quality and edge case handling
3. **V1.2:** Advanced features like custom responses and improved UI

## Resource Constraints

### API Costs and Scaling
- **Risk:** Gemini API and Twilio costs scaling with user growth
- **Mitigation:** Implement usage monitoring, tiered pricing strategy, cost optimization through efficient API usage

### iOS Development Expertise
- **Risk:** Complex iOS integrations (CallKit, WidgetKit, permissions)
- **Mitigation:** Focus on proven patterns, extensive testing on real devices, gradual feature rollout

### Infrastructure Reliability
- **Risk:** Service downtime affecting critical call screening
- **Mitigation:** Redundant infrastructure, graceful degradation, comprehensive monitoring and alerting

# Appendix

## Success Metrics (V1.0)
- **User Adoption:** 10,000 Monthly Active Users within 6 months
- **User Satisfaction:** 4.5+ App Store rating average
- **Core Functionality:** >98% call screening success rate
- **Performance:** <5 seconds from call completion to push notification

## Non-Functional Requirements
- **Performance:** <1.5 second AI response latency for natural conversation
- **Security:** TLS encryption, Firestore security rules, API key protection
- **Scalability:** Serverless architecture supporting growth without manual intervention
- **Error Handling:** Graceful handling of dropped calls, API failures, silent callers

## Technical Specifications
- **iOS Target:** iOS 15+ for modern widget and CallKit support
- **Backend:** Google Cloud Platform with Firebase services
- **AI Model:** Gemini 2.5 Flash for optimal speed/quality balance
- **Telephony:** Twilio Voice API for call handling and streaming

## Out of Scope for V1.0
- V2.0 Professional Assistant features (custom scripts, advanced scheduling)
- Automated quoting systems
- Android application
- Detailed in-app analytics
- Siri integration (moved to V1.1)

