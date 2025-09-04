# Product Requirements Document: Project Friday (V1.0)

**Version:** 1.1 (Detailed for Development)  
**Status:** Draft for Development Team  
**Project:** Project Friday (Placeholder)  
**Target Release:** V1.0 - The Personal Assistant

## 1. Introduction & Vision

**Vision:** To give individuals back their time and peace of mind by intelligently managing their phone calls. Project Friday is an iOS application that uses a sophisticated AI assistant, powered by Gemini 2.5 Flash, to screen incoming calls on the user's behalf.

## 2. Product Goals & Success Metrics (V1.0)

- **User Adoption:** Achieve 10,000 Monthly Active Users (MAU) within 6 months of launch.
- **User Satisfaction:** Maintain an average App Store rating of 4.5+ stars.
- **Core Functionality:** Achieve a core call screening success rate of > 98% (successful interception, processing, and notification).
- **Performance:** Ensure the average time from call completion to push notification delivery is under 5 seconds.

## 3. Target Audience (V1.0)

**The Busy Professional & The Focused Individual:** Users who are frequently interrupted, value deep work, and want to filter out noise without the risk of missing important calls from unknown numbers (e.g., a doctor's office, a new client).

## 4. Core Epics & User Stories for V1.0

This section details the required work for the initial launch.

### EPIC 1: 🚀 User Onboarding & Setup

**Goal:** To provide a seamless and foolproof setup experience that builds user trust.

#### Story 1.1: Account Creation & Authentication

**As a new user, I want to create an account using Email/Password, Sign in with Google, or Sign in with Apple so I can log in securely.**

- **AC 1.1.1:** Firebase Authentication is integrated for all three methods.
- **AC 1.1.2:** A successful sign-up/login directs the user to the start of the permissions walkthrough.
- **AC 1.1.3:** UI is clean and follows standard iOS practices for login screens.

#### Story 1.2: Permissions Walkthrough

**As a new user, I want to be guided through a step-by-step process to grant necessary system permissions (Push Notifications, Contacts).**

- **AC 1.2.1:** The app presents a clear, concise explanation of why each permission is needed before triggering the native iOS prompt.
- **AC 1.2.2:** The app correctly checks the status of each permission and can guide the user to the Settings app if they initially decline.

#### Story 1.3: Conditional Call Forwarding (CCF) Configuration

**As a first-time user, I want the app to provide me with the exact instructions and codes to set up call forwarding with my mobile carrier.**

- **AC 1.3.1:** The app provides a screen dedicated to CCF setup.
- **AC 1.3.2:** The screen displays the correct MMI code (e.g., *004*<YourTwilioNumber>#) for the user to activate CCF when they decline a call.
- **AC 1.3.3:** The UI includes a "Copy Code to Clipboard" button and a button that attempts to dial the code directly.
- **AC 1.3.4:** The screen includes instructions on how to deactivate CCF.

### EPIC 2: 🧠 Real-Time Call Screening (Backend)

**Goal:** To build the core serverless engine that powers the conversational AI screening.

#### Story 2.1: Inbound Call Handling

**As the system, when a call is forwarded to the provisioned Twilio number, I want a Cloud Function to be triggered to handle the live call.**

- **AC 2.1.1:** A pool of Twilio phone numbers is available for provisioning to new users.
- **AC 2.1.2:** The Twilio number's voice webhook is configured to point to the handleCall Cloud Function URL.

#### Story 2.2: Conversational AI Logic

**As the system, I want to manage a real-time, turn-by-turn conversation with the caller using the Gemini 2.5 Flash model.**

- **AC 2.2.1:** The Cloud Function establishes a bidirectional stream with Twilio to receive audio and send back synthesized speech.
- **AC 2.2.2:** The function accurately transcribes caller audio to text.
- **AC 2.2.3:** The function maintains conversation history and makes sequential calls to the Gemini API to generate responses.
- **AC 2.2.4:** The AI's text response is converted to speech (using Google Text-to-Speech) and streamed back to the caller with minimal latency.

#### Story 2.3: Call Finalization & Data Persistence

**As the system, when a call ends, I want to process the conversation and save the relevant data to Firestore.**

- **AC 2.3.1:** A final call is made to the Gemini API with the full transcript to generate a one-sentence summary.
- **AC 2.3.2:** A new document is created in the user's call_logs collection in Firestore.
- **AC 2.3.3:** The document contains: callerId, timestamp, duration, fullTranscript, aiSummary, and audioRecordingUrl (from Twilio).
- **AC 2.3.4:** The function triggers a push notification (via FCM) to the user's device with the aiSummary.

### EPIC 3: 📱 User Experience (iOS App)

**Goal:** To provide the user with an intuitive and actionable interface to review their screened calls.

#### Story 3.1: Call Log Inbox

**As a user, I want to see a list of my screened calls on the app's main screen, with the most recent at the top.**

- **AC 3.1.1:** The main view fetches and displays the call_logs collection from Firestore in real-time.
- **AC 3.1.2:** Each list item clearly displays the Caller ID (or number), the timestamp, and the AI-generated summary.

#### Story 3.2: Call Detail View

**As a user, I want to tap on a call in my log to see the full details of the conversation.**

- **AC 3.2.1:** The detail view displays the full, formatted call transcript.
- **AC 3.2.2:** The view provides action buttons: "Call Back," "Add to Contacts," and "Block Number."
- **AC 3.2.3:** (Optional V1) An embedded audio player allows the user to listen to the call recording.

#### Story 3.3: App Controls

**As a user, I want a Home Screen Widget to quickly toggle the call screening service on and off.**

- **AC 3.3.1:** The widget's state is synced with a user setting in Firestore (e.g., isScreeningActive).
- **AC 3.3.2:** The backend logic checks this flag before initiating the AI screening, otherwise it can simply hang up or play a standard voicemail prompt.

## 5. Non-Functional Requirements

- **Performance:** AI conversational latency (time from when the user stops speaking to when the AI starts responding) must average under 1.5 seconds to feel natural.
- **Security:** All communication between the app, backend, and APIs must use TLS. Sensitive data in Firestore must be protected by security rules.
- **Scalability:** The serverless architecture should be able to handle initial user growth without manual intervention. Load testing should be performed.
- **Error Handling:** The system must gracefully handle dropped calls, empty/silent calls, failed API requests, and callers who do not respond.

## 6. Out of Scope for V1.0

- All V2.0 Professional Assistant features (custom scripts, advanced scheduling, etc.).
- Automated quoting.
- Android App.
- Detailed in-app analytics.
- Siri Integration (can be moved to V1.1 to simplify initial release).
