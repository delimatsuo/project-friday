# Firebase/GCP Setup Guide for Project Friday

This comprehensive guide will walk you through setting up Firebase and Google Cloud Platform (GCP) for Project Friday, an AI-powered call screening application.

## Prerequisites

Before you begin, ensure you have:
- A Google account
- Node.js (version 18 or higher) installed
- Firebase CLI installed globally: `npm install -g firebase-tools@latest`
- A credit card (for GCP billing, though we'll use free tier initially)

## Step 1: Create Google Cloud Platform Project

### 1.1 Access Google Cloud Console
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Accept the terms of service if prompted

### 1.2 Create a New Project
1. Click the project dropdown at the top of the page
2. Click "New Project"
3. Enter project details:
   - **Project name**: `project-friday-[your-name]` (e.g., `project-friday-john`)
   - **Organization**: Leave blank (unless you have an organization)
   - **Location**: Leave as default
4. Click "Create"
5. Wait for the project to be created (1-2 minutes)
6. **Important**: Note your Project ID (it will be generated automatically)

### 1.3 Enable Billing
1. Go to [Billing](https://console.cloud.google.com/billing)
2. Link a billing account to your project
3. Most services we use are within free tier limits
4. Set up budget alerts:
   - Navigate to "Budgets & alerts"
   - Create budget for $10-20 monthly limit
   - Set alerts at 50%, 90%, and 100%

## Step 2: Enable Required APIs

Enable the following APIs in your GCP project:

### 2.1 Navigate to APIs & Services
1. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Enable each of the following APIs by searching and clicking "Enable":

### 2.2 Required APIs
- **Firebase Management API**
- **Cloud Functions API**
- **Cloud Firestore API**
- **Firebase Authentication API**
- **Cloud Storage API**
- **Cloud Text-to-Speech API**
- **Cloud Speech-to-Text API**
- **Vertex AI API** (for Gemini)
- **Firebase Cloud Messaging API**
- **Identity and Access Management (IAM) API**

### 2.3 Verify APIs are Enabled
Navigate to [APIs & Services > Enabled APIs](https://console.cloud.google.com/apis/dashboard) to confirm all APIs are listed.

## Step 3: Initialize Firebase Project

### 3.1 Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Select your existing GCP project
4. Continue through the setup wizard:
   - **Google Analytics**: Enable (recommended)
   - **Analytics account**: Create new or use existing

### 3.2 Configure Firebase Services

#### Authentication
1. Navigate to **Authentication > Sign-in method**
2. Enable the following providers:
   - **Email/Password**: Enable
   - **Google**: Enable (will auto-configure with your project)
   - **Apple**: Enable (requires Apple Developer account for production)

#### Firestore Database
1. Navigate to **Firestore Database**
2. Click "Create database"
3. Choose **Start in test mode** (we'll update security rules later)
4. Select a location close to your users:
   - **Recommended**: `us-central1` (Iowa)
   - **Europe**: `europe-west1` (Belgium)
   - **Asia**: `asia-northeast1` (Tokyo)

#### Cloud Storage
1. Navigate to **Storage**
2. Click "Get started"
3. Choose **Start in test mode**
4. Use the same location as your Firestore database

#### Cloud Functions
1. Navigate to **Functions**
2. Click "Get started"
3. Functions will be deployed via CLI later

## Step 4: Configure Local Development Environment

### 4.1 Install Firebase CLI and Login
```bash
# Install Firebase CLI globally
npm install -g firebase-tools@latest

# Login to Firebase
firebase login

# Verify login
firebase projects:list
```

### 4.2 Initialize Firebase in Your Project
```bash
# Navigate to your project directory
cd /path/to/project-friday

# Navigate to backend directory
cd backend

# Initialize Firebase (if not already done)
firebase init

# Select the following features:
# - Firestore: Configure security rules and indexes
# - Functions: Configure Cloud Functions
# - Hosting: Configure hosting for your site
# - Storage: Configure security rules for Cloud Storage
# - Emulators: Set up local emulators

# Select your existing project when prompted
```

### 4.3 Set Firebase Project
```bash
# Set the active project
firebase use --add

# Select your project and give it an alias (e.g., 'default')
# Verify project is set
firebase use
```

## Step 5: Set Up Environment Variables

### 5.1 Get Firebase Configuration
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click "Add app" and select **Web** (🌐)
4. Register app:
   - **App nickname**: `project-friday-web`
   - **Don't check** "Also set up Firebase Hosting"
5. Copy the Firebase config object

### 5.2 Create Environment Files
Create the following files in `backend/functions/`:

**`.env.local`** (for development):
```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_REGION=us-central1

# Gemini AI Configuration
GOOGLE_AI_API_KEY=your-gemini-api-key

# Twilio Configuration (we'll set these up later)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Environment
NODE_ENV=development
```

**`.env.production`** (for production deployment):
```env
# Same variables as above but with production values
NODE_ENV=production
# ... other production values
```

### 5.3 Generate Service Account Key
1. Go to [Google Cloud Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Find the Firebase Admin SDK service account
3. Click the email address
4. Go to **Keys** tab
5. Click **Add Key > Create new key**
6. Select **JSON** format
7. Download the key file
8. Extract the values for your environment file:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key_id` → `FIREBASE_PRIVATE_KEY_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep newlines as `\n`)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `client_id` → `FIREBASE_CLIENT_ID`
   - `client_x509_cert_url` → `FIREBASE_CLIENT_X509_CERT_URL`

## Step 6: Set Up Gemini AI API

### 6.1 Get Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key"
3. Create API key for your project
4. Copy the API key to your environment file

### 6.2 Enable Vertex AI (Alternative)
If you prefer using Vertex AI instead of Google AI Studio:
1. Go to [Vertex AI](https://console.cloud.google.com/vertex-ai)
2. Enable the API
3. Use Application Default Credentials (no API key needed)

## Step 7: Configure Twilio Integration

### 7.1 Create Twilio Account
1. Go to [Twilio](https://www.twilio.com/)
2. Sign up for a free account
3. Verify your email and phone number
4. Access the [Twilio Console](https://console.twilio.com/)

### 7.2 Get Twilio Credentials
1. From the Twilio Console dashboard, copy:
   - **Account SID**
   - **Auth Token**
2. Add these to your environment file

### 7.3 Purchase Phone Number
1. In Twilio Console, go to **Phone Numbers > Manage > Buy a number**
2. Choose a number in your country
3. Ensure it has **Voice** capabilities
4. Purchase the number
5. Add the number to your environment file

### 7.4 Configure Webhook
1. Go to **Phone Numbers > Manage > Active numbers**
2. Click on your purchased number
3. In the **Voice Configuration** section:
   - **A call comes in**: Webhook
   - **URL**: `https://us-central1-your-project-id.cloudfunctions.net/handleCall`
   - **HTTP**: POST
4. Save the configuration

## Step 8: Deploy and Test

### 8.1 Deploy Functions
```bash
# From backend directory
cd backend

# Install dependencies
npm install
cd functions && npm install && cd ..

# Deploy to Firebase
firebase deploy --only functions

# Deploy all services
firebase deploy
```

### 8.2 Test Your Setup
```bash
# Run the validation script
npm run validate-setup

# Start local emulators for testing
firebase emulators:start
```

### 8.3 Test Endpoints
1. Test the handleCall function with a POST request
2. Verify Firestore rules are working
3. Test authentication flows

## Step 9: Security Configuration

### 9.1 Update Firestore Rules
Update your `firestore.rules` file:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Call logs are private to each user
    match /users/{userId}/call_logs/{callId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 9.2 Update Storage Rules
Update your `storage.rules` file:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 9.3 Deploy Security Rules
```bash
firebase deploy --only firestore:rules,storage
```

## Step 10: Production Considerations

### 10.1 Domain Configuration
1. Set up custom domain for your functions
2. Update Twilio webhook URL to use custom domain
3. Configure CORS policies

### 10.2 Monitoring and Logging
1. Set up Cloud Monitoring alerts
2. Configure log retention policies
3. Set up error reporting

### 10.3 Backup Strategy
1. Enable automated Firestore backups
2. Set up Cloud Storage backup policies
3. Document restore procedures

## Troubleshooting

### Common Issues

#### 1. Permission Denied Errors
- Verify service account has proper roles
- Check Firestore rules are correctly deployed
- Ensure authentication is working

#### 2. Function Deployment Failures
- Verify all required APIs are enabled
- Check Node.js version compatibility
- Review function logs for specific errors

#### 3. Twilio Integration Issues
- Verify webhook URL is accessible
- Check phone number capabilities
- Ensure proper content-type headers

#### 4. Environment Variable Issues
- Verify all required variables are set
- Check for syntax errors in .env files
- Ensure private key formatting is correct

### Getting Help

1. Check [Firebase Documentation](https://firebase.google.com/docs)
2. Review [Google Cloud Functions docs](https://cloud.google.com/functions/docs)
3. Check [Twilio Documentation](https://www.twilio.com/docs)
4. Post questions on Stack Overflow with tags: `firebase`, `google-cloud-functions`, `twilio`

## Next Steps

After completing this setup:
1. Review the [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md)
2. Run the automated setup validation
3. Begin implementing your call screening logic
4. Set up monitoring and alerts
5. Plan your production deployment strategy

---

**Security Note**: Never commit API keys, tokens, or private keys to version control. Always use environment variables and secure secret management.