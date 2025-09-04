# Project Friday iOS App

An iOS application that uses AI (Gemini 2.5 Flash) to intelligently screen phone calls, acting as a personal assistant to filter interruptions while ensuring important calls are never missed.

## Project Structure

```
ios/
├── ProjectFriday.xcodeproj/          # Xcode project file
├── ProjectFriday/                    # Main app directory
│   ├── ProjectFridayApp.swift       # Main app entry point
│   ├── ContentView.swift            # Root content view
│   ├── Models/                      # Data models
│   │   └── User.swift              # User model
│   ├── Services/                    # Service layer
│   │   └── FirebaseService.swift   # Firebase integration
│   ├── ViewModels/                  # MVVM view models
│   │   └── AuthenticationViewModel.swift
│   ├── Views/                       # SwiftUI views
│   │   ├── Authentication/         # Auth-related views
│   │   │   ├── SignInView.swift
│   │   │   ├── SignUpView.swift
│   │   │   └── PasswordResetView.swift
│   │   └── MainView.swift          # Main app interface
│   ├── Assets.xcassets/            # App icons and assets
│   ├── GoogleService-Info.plist    # Firebase configuration
│   └── Info.plist                  # App configuration
├── Package.swift                    # Swift Package Manager dependencies
└── README.md                       # This file
```

## Features

### Authentication
- Email/Password authentication via Firebase Auth
- Google Sign-In integration
- Apple Sign-In integration
- Password reset functionality
- User profile management

### Call Screening (Planned)
- AI-powered call screening
- Spam call blocking
- Important call identification
- Call transcription and summaries
- Push notifications for screened calls

## Tech Stack

- **UI Framework**: SwiftUI (iOS 15+)
- **Architecture**: MVVM (Model-View-ViewModel)
- **Backend**: Firebase (Auth, Firestore, Cloud Messaging)
- **Authentication**: Firebase Auth with Google/Apple Sign-In
- **Dependencies**: Swift Package Manager

## Setup Instructions

### Prerequisites
1. Xcode 15.0 or later
2. iOS 15.0+ deployment target
3. Firebase project setup (project-friday-471118)

### Firebase Configuration
1. Replace the placeholder values in `GoogleService-Info.plist` with your actual Firebase project configuration
2. Ensure the bundle identifier matches your Firebase app: `com.projectfriday.app`
3. Update the `REVERSED_CLIENT_ID` in the URL scheme for Google Sign-In

### Required API Keys
The following keys need to be configured in Firebase Console:
- Google Sign-In client ID
- Apple Sign-In configuration
- Firebase API keys
- Push notification certificates

### Building the Project
1. Open `ProjectFriday.xcodeproj` in Xcode
2. Select your development team in the project settings
3. Update the bundle identifier if needed
4. Build and run on simulator or device

## Dependencies

The project uses Swift Package Manager for dependencies:

- **Firebase SDK** (10.18.0+)
  - FirebaseAuth
  - FirebaseFirestore
  - FirebaseFirestoreSwift
  - FirebaseMessaging
  - FirebaseAnalytics
- **GoogleSignIn-iOS** (7.0.0+)

## Architecture

The app follows MVVM (Model-View-ViewModel) architecture:

- **Models**: Data structures (`User`)
- **Views**: SwiftUI views for the user interface
- **ViewModels**: Business logic and state management (`AuthenticationViewModel`)
- **Services**: External service integrations (`FirebaseService`)

## Key Files

- `ProjectFridayApp.swift`: Main app entry point with Firebase configuration
- `AuthenticationViewModel.swift`: Handles all authentication logic
- `FirebaseService.swift`: Firebase integration and API calls
- `SignInView.swift`: Email/password sign-in with social login options
- `MainView.swift`: Post-authentication main app interface

## Development Notes

- The app uses `@StateObject` and `@EnvironmentObject` for state management
- Authentication state is managed globally through `AuthenticationViewModel`
- All views support both light and dark mode
- The UI is optimized for iPhone (portrait orientation)

## Next Steps

1. Integrate with Twilio for call handling
2. Implement AI call screening with Gemini
3. Add call log and transcript views
4. Implement push notifications
5. Add settings and preferences
6. Create onboarding flow

## Firebase Project

- Project ID: `project-friday-471118`
- Bundle ID: `com.projectfriday.app`
- Platform: iOS