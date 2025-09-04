# Project Friday Setup Documentation

Welcome to the Project Friday setup documentation! This directory contains comprehensive guides to help you set up Firebase, Google Cloud Platform, and all required services for the AI-powered call screening application.

## Quick Start

For experienced developers who want to get started immediately:

```bash
# 1. Run the automated setup script
./scripts/setup.sh

# 2. Configure your environment variables
cp backend/functions/.env.example backend/functions/.env.local
# Edit .env.local with your actual API keys and configuration

# 3. Validate your setup
./scripts/validate-setup.sh

# 4. Start development
cd backend && firebase emulators:start
```

## Documentation Structure

### 📚 Setup Guides

1. **[Firebase Setup Guide](./FIREBASE_SETUP_GUIDE.md)** - Comprehensive step-by-step guide
   - Creating GCP project and enabling APIs
   - Firebase service configuration
   - Twilio integration setup
   - Security and production considerations

2. **[Environment Variables Guide](./ENVIRONMENT_VARIABLES.md)** - Detailed reference
   - All required and optional environment variables
   - Format validation and examples
   - Environment-specific configurations
   - Security best practices

### 🔧 Automation Scripts

Located in the `scripts/` directory:

1. **[setup.sh](../../scripts/setup.sh)** - Automated setup script
   - Installs dependencies and Firebase CLI
   - Configures Firebase project
   - Sets up basic project structure
   - Validates configuration

2. **[validate-setup.sh](../../scripts/validate-setup.sh)** - Comprehensive validation
   - Tests all environment variables
   - Validates API connectivity
   - Checks security configuration
   - Generates detailed reports

### 🧪 Testing

1. **[setup.test.js](../../backend/functions/test/setup.test.js)** - Jest test suite
   - Unit tests for configuration validation
   - Integration tests for external APIs
   - Security and compliance checks
   - Performance validation

## Setup Paths

Choose the setup path that best fits your experience level:

### 🟢 Beginner Path (New to Firebase/GCP)

1. **Read the complete guides first:**
   - [Firebase Setup Guide](./FIREBASE_SETUP_GUIDE.md) - Start here for complete instructions
   - [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md) - Reference for all variables

2. **Manual setup (recommended for learning):**
   - Follow step-by-step instructions
   - Understand each component
   - Configure services manually

3. **Validate your setup:**
   ```bash
   ./scripts/validate-setup.sh
   ```

### 🟡 Intermediate Path (Some Firebase experience)

1. **Use the automated setup script:**
   ```bash
   ./scripts/setup.sh
   ```

2. **Manual configuration of API keys:**
   - Set up Twilio account and phone number
   - Get Google AI API key
   - Configure environment variables

3. **Run validation and tests:**
   ```bash
   ./scripts/validate-setup.sh
   npm test -- backend/functions/test/setup.test.js
   ```

### 🔴 Advanced Path (Experienced developers)

1. **Quick automated setup:**
   ```bash
   ./scripts/setup.sh --quick
   ```

2. **Environment configuration:**
   ```bash
   cp backend/functions/.env.example backend/functions/.env.local
   # Configure all required variables
   ```

3. **Full validation suite:**
   ```bash
   ./scripts/validate-setup.sh --verbose
   cd backend/functions && npm test
   ```

## Prerequisites

Before starting any setup path, ensure you have:

### System Requirements
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (for version control)

### Accounts Needed
- **Google Account** - For Firebase/GCP access
- **Credit Card** - For GCP billing (free tier available)
- **Twilio Account** - For phone number and voice services
- **Google AI Studio Account** - For Gemini API access

### Optional but Recommended
- **gcloud CLI** - For advanced GCP management
- **Visual Studio Code** - With Firebase extensions

## Service Overview

Project Friday integrates several services:

### Core Services (Required)
- **Firebase Authentication** - User login (Email, Google, Apple)
- **Cloud Firestore** - User data and call logs storage
- **Cloud Functions** - Serverless call handling logic
- **Cloud Storage** - Audio recording storage
- **Firebase Cloud Messaging** - Push notifications

### AI/ML Services (Required)
- **Google AI (Gemini 2.5 Flash)** - Conversational AI
- **Cloud Speech-to-Text** - Audio transcription
- **Cloud Text-to-Speech** - Voice synthesis

### Communication Services (Required)
- **Twilio Voice** - Phone number and call handling
- **Twilio Programmable Voice** - Real-time audio streaming

### Optional Services
- **Cloud Monitoring** - Performance monitoring
- **Cloud Logging** - Centralized logging
- **Secret Manager** - Secure credential storage

## Configuration Files

Understanding the key configuration files:

### Firebase Configuration
- `backend/firebase.json` - Firebase services configuration
- `backend/firestore.rules` - Database security rules
- `backend/firestore.indexes.json` - Database indexes
- `backend/storage.rules` - File storage security rules

### Environment Configuration
- `backend/functions/.env.example` - Template file (committed)
- `backend/functions/.env.local` - Local development (never commit)
- `backend/functions/.env.production` - Production values (never commit)

### Application Configuration
- `backend/functions/package.json` - Dependencies and scripts
- `backend/functions/index.js` - Main application entry point

## Common Setup Issues

### Authentication Problems
```bash
# Firebase login issues
firebase logout
firebase login --reauth

# Service account permission issues
# Check IAM roles in Google Cloud Console
```

### Environment Variable Issues
```bash
# Validate environment variables
./scripts/validate-setup.sh

# Check for syntax errors
node -e "require('dotenv').config({ path: 'backend/functions/.env.local' }); console.log('✓ Environment file is valid')"
```

### API Connectivity Issues
```bash
# Test Firebase connection
firebase projects:list

# Test API endpoints
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://firebase.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID"
```

### Deployment Issues
```bash
# Check function logs
firebase functions:log

# Deploy with debug output
firebase deploy --only functions --debug
```

## Getting Help

### 📖 Documentation
- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Cloud Functions](https://cloud.google.com/functions/docs)
- [Twilio Documentation](https://www.twilio.com/docs)
- [Google AI Documentation](https://ai.google.dev/docs)

### 🔧 Troubleshooting
1. Run the validation script with verbose output:
   ```bash
   ./scripts/validate-setup.sh --verbose
   ```

2. Check the test suite results:
   ```bash
   cd backend/functions && npm test
   ```

3. Review Firebase function logs:
   ```bash
   firebase functions:log --limit 50
   ```

### 💬 Community Support
- Stack Overflow tags: `firebase`, `google-cloud-functions`, `twilio`
- Firebase Community: [firebase.community](https://firebase.community/)
- Google Cloud Community: [cloud.google.com/community](https://cloud.google.com/community)

### 🐛 Bug Reports
If you encounter issues with the setup scripts or documentation:

1. Check if the issue is known in the troubleshooting section
2. Run validation script to get detailed error information
3. Create an issue with:
   - Setup script output (with sensitive info removed)
   - Validation script results
   - System information (OS, Node.js version, etc.)

## Next Steps

After completing setup:

1. **Test Your Configuration**
   ```bash
   cd backend && firebase emulators:start
   ```

2. **Deploy to Production**
   ```bash
   cd backend && firebase deploy
   ```

3. **Set Up Monitoring**
   - Configure Cloud Monitoring alerts
   - Set up log-based metrics
   - Create uptime checks

4. **Implement iOS App**
   - Set up Xcode project
   - Configure Firebase iOS SDK
   - Implement call forwarding setup

5. **Security Hardening**
   - Review Firestore security rules
   - Set up proper IAM roles
   - Enable audit logging

## Updates and Maintenance

### Keeping Dependencies Updated
```bash
# Update Firebase CLI
npm update -g firebase-tools

# Update function dependencies
cd backend/functions && npm update

# Check for security vulnerabilities
npm audit
```

### Configuration Updates
- Regularly rotate API keys and tokens
- Update Firestore rules as needed
- Monitor quota usage and adjust limits
- Review and update environment variables

---

**Security Reminder**: Never commit API keys, tokens, or private keys to version control. Always use environment variables and secure secret management for production deployments.