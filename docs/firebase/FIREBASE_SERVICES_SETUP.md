# Firebase Services Setup Guide

This guide documents the Firebase services enablement process for the ProjectFriday application.

## Overview

This document covers the setup and configuration of the core Firebase services required for the application:
- **Firestore Database** (Native mode) - Document database for user data and call logs
- **Cloud Functions** - Serverless functions for backend logic
- **Cloud Storage** - File storage for call recordings and user uploads

## Prerequisites

Before enabling Firebase services, ensure you have:

1. ✅ Firebase CLI installed (`npm install -g firebase-tools`)
2. ✅ Authenticated with Firebase (`firebase login`)
3. ✅ Firebase project created and initialized (from Task 1.1)
4. ✅ Google Cloud project linked to Firebase project

## Service Enablement Process

### Automated Setup

Run the automated setup script:

```bash
./scripts/enable-firebase-services.sh
```

This script will:
- Enable required Google Cloud APIs
- Deploy Firestore security rules and indexes
- Deploy Cloud Storage security rules  
- Set up Cloud Functions directory structure
- Validate service status

### Manual Steps Required

Some services require manual enablement in the Firebase Console:

#### 1. Firestore Database
1. Go to [Firebase Console → Firestore](https://console.firebase.google.com)
2. Click "Create database"
3. Select "Start in production mode" (we deploy our own rules)
4. Choose location: `us-central1` (recommended)

#### 2. Cloud Storage
1. Go to [Firebase Console → Storage](https://console.firebase.google.com)
2. Click "Get started" 
3. Accept default security rules (will be overwritten)
4. Choose location: `us-central1` (same as Firestore)

#### 3. Cloud Functions
1. Go to [Firebase Console → Functions](https://console.firebase.google.com)
2. Click "Get started"
3. **⚠️ Requires Blaze Plan upgrade** (pay-as-you-go)
4. Accept the upgrade if prompted

> **Note**: Blaze plan has a generous free tier for Cloud Functions (2M invocations/month free)

## Configuration Files

The following configuration files are created/used:

### `config/firebase.json`
Main Firebase configuration file defining:
- Functions source directory and build settings
- Firestore rules and indexes paths
- Storage rules path
- Emulator configuration

### `config/firestore.rules`
Security rules for Firestore database:
```javascript
// Users can read/write their own user document
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// Users can read/write their own call logs
match /call_logs/{document} {
  allow read, write: if request.auth != null 
    && request.auth.uid == resource.data.userId;
}
```

### `config/firestore.indexes.json`
Composite indexes for efficient querying:
- `call_logs`: userId + timestamp (descending)
- `call_logs`: userId + callerPhoneNumber + timestamp (descending)

### `config/storage.rules`
Security rules for Cloud Storage:
```javascript
// Users can access their own files
match /users/{userId}/{allPaths=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// Users can access their own call recordings  
match /call-recordings/{userId}/{allPaths=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## Validation

After setup, validate all services are working:

```bash
./scripts/validate-firebase-services.sh
```

This will test:
- ✅ Firebase CLI authentication
- ✅ Project access and permissions
- ✅ Configuration file syntax
- ✅ Service availability
- ✅ Network connectivity
- ✅ Security rules validation

## Development Workflow

### Using Firebase Emulators

For development, use Firebase emulators to test locally:

```bash
# Start all emulators
firebase emulators:start

# Start specific emulators
firebase emulators:start --only firestore,functions,storage
```

Emulator URLs:
- **Emulator UI**: http://localhost:4000
- **Firestore**: http://localhost:8080  
- **Functions**: http://localhost:5001
- **Storage**: http://localhost:9199
- **Auth**: http://localhost:9099

### Running Tests

Integration tests are available to validate Firebase configuration:

```bash
cd tests/firebase
npm install
npm test

# Run with emulators
npm run test:emulators
```

### Deploying Rules and Indexes

Deploy security rules and indexes to production:

```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy Storage rules
firebase deploy --only storage

# Deploy everything
firebase deploy
```

## Project Structure

```
project/
├── config/
│   ├── firebase.json              # Main Firebase configuration
│   ├── firestore.rules           # Firestore security rules
│   ├── firestore.indexes.json    # Firestore composite indexes
│   └── storage.rules             # Cloud Storage security rules
├── functions/                     # Cloud Functions source (created by script)
│   ├── src/
│   │   └── index.ts              # Functions entry point
│   ├── package.json              # Functions dependencies
│   └── tsconfig.json             # TypeScript configuration  
├── tests/firebase/                # Firebase integration tests
│   ├── firebase-services.test.js # Service validation tests
│   └── package.json              # Test dependencies
├── scripts/
│   ├── enable-firebase-services.sh    # Automated setup script
│   └── validate-firebase-services.sh  # Validation script
└── docs/firebase/
    └── FIREBASE_SERVICES_SETUP.md     # This guide
```

## Security Considerations

### Firestore Security
- All data access requires authentication
- Users can only access their own data
- Call logs are isolated by `userId`
- Unknown collections are completely blocked

### Storage Security  
- File access requires authentication
- Users can only access files under their `userId` path
- Call recordings are isolated by user
- No anonymous access allowed

### API Keys and Secrets
- All sensitive keys should be stored in Google Secret Manager
- Never commit API keys to version control
- Use IAM roles for service-to-service authentication

## Troubleshooting

### Common Issues

#### "Firestore rules failed to deploy"
- Check rules syntax with: `firebase firestore:rules --dry-run`
- Ensure project has Firestore enabled
- Verify authentication and permissions

#### "Functions require Blaze plan" 
- Upgrade to Blaze plan in Firebase Console
- Note: Blaze plan has generous free tier
- Required for Cloud Functions in production

#### "Storage rules failed to deploy"
- Check if Storage is enabled in Firebase Console
- Validate rules syntax
- Ensure bucket exists

#### "Permission denied" errors
- Verify user authentication
- Check security rules match your data structure
- Test with Firebase emulators first

### Getting Help

1. Check the [Firebase documentation](https://firebase.google.com/docs)
2. Use Firebase emulators for debugging: `firebase emulators:start`
3. Check the Firebase Console for error messages
4. Review logs with: `firebase functions:log`

## Next Steps

After Firebase services are enabled:

1. **Task 1.3**: Configure Firebase Authentication providers
2. **Task 4**: Set up iOS project with Firebase SDKs
3. **Task 6**: Implement Cloud Functions for call handling
4. **Task 7**: Set up call log persistence

## Changelog

- **2024-09-04**: Initial Firebase services setup
  - Created configuration files
  - Implemented security rules
  - Added validation scripts
  - Set up integration tests

---

**Status**: ✅ Firebase services enabled and configured  
**Last Updated**: September 4, 2024  
**Next Task**: Configure Firebase Authentication (Task 1.3)