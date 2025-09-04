# Environment Variables Guide for Project Friday

This guide provides detailed information about all environment variables required for Project Friday's backend services.

## Overview

Project Friday uses environment variables to configure various services and API integrations. This approach keeps sensitive information secure and allows for different configurations across development, staging, and production environments.

## Environment Files Structure

```
backend/functions/
├── .env.example          # Template with all variables (committed to git)
├── .env.local           # Local development (never commit)
├── .env.development     # Development environment (never commit)
├── .env.staging         # Staging environment (never commit)
├── .env.production      # Production environment (never commit)
```

## Required Environment Variables

### Firebase Configuration

#### `FIREBASE_PROJECT_ID`
- **Description**: Your Firebase/GCP project ID
- **Format**: String (lowercase, hyphens allowed)
- **Example**: `project-friday-471118`
- **Required**: Yes
- **Where to find**: Firebase Console > Project Settings > General tab

#### `FIREBASE_PRIVATE_KEY_ID`
- **Description**: Service account private key identifier
- **Format**: String (hex characters)
- **Example**: `a1b2c3d4e5f6...`
- **Required**: Yes
- **Where to find**: Service account JSON key file (`private_key_id` field)

#### `FIREBASE_PRIVATE_KEY`
- **Description**: Service account private key for Firebase Admin SDK
- **Format**: String (PEM format with escaped newlines)
- **Example**: `"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n-----END PRIVATE KEY-----\n"`
- **Required**: Yes
- **Where to find**: Service account JSON key file (`private_key` field)
- **Important**: Must include quotes and escaped newlines (`\n`)

#### `FIREBASE_CLIENT_EMAIL`
- **Description**: Service account email address
- **Format**: Email address
- **Example**: `firebase-adminsdk-xxxxx@project-friday-471118.iam.gserviceaccount.com`
- **Required**: Yes
- **Where to find**: Service account JSON key file (`client_email` field)

#### `FIREBASE_CLIENT_ID`
- **Description**: Service account client ID
- **Format**: String (numeric)
- **Example**: `123456789012345678901`
- **Required**: Yes
- **Where to find**: Service account JSON key file (`client_id` field)

#### `FIREBASE_CLIENT_X509_CERT_URL`
- **Description**: Service account certificate URL
- **Format**: URL
- **Example**: `https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40project-friday-471118.iam.gserviceaccount.com`
- **Required**: Yes
- **Where to find**: Service account JSON key file (`client_x509_cert_url` field)

### Google Cloud Configuration

#### `GOOGLE_CLOUD_PROJECT_ID`
- **Description**: Google Cloud Project ID (usually same as Firebase)
- **Format**: String
- **Example**: `project-friday-471118`
- **Required**: Yes
- **Where to find**: GCP Console > Project selector

#### `GOOGLE_CLOUD_REGION`
- **Description**: Default region for Cloud Functions and services
- **Format**: String (region code)
- **Example**: `us-central1`
- **Required**: Yes
- **Options**: `us-central1`, `us-east1`, `us-west1`, `europe-west1`, `asia-northeast1`
- **Recommendation**: Choose region closest to your users

### AI/ML Configuration

#### `GOOGLE_AI_API_KEY`
- **Description**: API key for Google AI Studio (Gemini API)
- **Format**: String (API key)
- **Example**: `AIzaSyABC123def456GHI789jkl012MNO345pqr`
- **Required**: Yes (if using Google AI Studio)
- **Where to find**: [Google AI Studio](https://aistudio.google.com/) > Get API Key
- **Alternative**: Use Vertex AI with Application Default Credentials

#### `VERTEX_AI_ENABLED`
- **Description**: Enable Vertex AI instead of Google AI Studio
- **Format**: Boolean string
- **Example**: `true` or `false`
- **Required**: No
- **Default**: `false`

#### `GEMINI_MODEL_NAME`
- **Description**: Gemini model to use for conversations
- **Format**: String
- **Example**: `gemini-2.0-flash-exp`
- **Required**: No
- **Default**: `gemini-2.0-flash-exp`
- **Options**: `gemini-2.0-flash-exp`, `gemini-1.5-pro`, `gemini-1.5-flash`

### Twilio Configuration

#### `TWILIO_ACCOUNT_SID`
- **Description**: Twilio account identifier
- **Format**: String (starts with 'AC')
- **Example**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Required**: Yes
- **Where to find**: [Twilio Console](https://console.twilio.com/) > Dashboard

#### `TWILIO_AUTH_TOKEN`
- **Description**: Twilio authentication token
- **Format**: String (32 characters)
- **Example**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Required**: Yes
- **Where to find**: Twilio Console > Dashboard
- **Security**: This is sensitive - treat like a password

#### `TWILIO_PHONE_NUMBER`
- **Description**: Purchased Twilio phone number for call handling
- **Format**: String (E.164 format)
- **Example**: `+15551234567`
- **Required**: Yes
- **Where to find**: Twilio Console > Phone Numbers > Manage > Active Numbers

#### `TWILIO_VOICE_WEBHOOK_URL`
- **Description**: Webhook URL for incoming voice calls
- **Format**: URL
- **Example**: `https://us-central1-project-friday-471118.cloudfunctions.net/handleCall`
- **Required**: Yes
- **Format**: `https://{region}-{project-id}.cloudfunctions.net/handleCall`

### Text-to-Speech Configuration

#### `TTS_VOICE_NAME`
- **Description**: Google Cloud Text-to-Speech voice
- **Format**: String
- **Example**: `en-US-Neural2-F`
- **Required**: No
- **Default**: `en-US-Neural2-F`
- **Options**: See [TTS Voices documentation](https://cloud.google.com/text-to-speech/docs/voices)

#### `TTS_SPEAKING_RATE`
- **Description**: Speed of synthesized speech
- **Format**: Number (0.25 to 4.0)
- **Example**: `1.0`
- **Required**: No
- **Default**: `1.0`

#### `TTS_PITCH`
- **Description**: Pitch of synthesized speech
- **Format**: Number (-20.0 to 20.0)
- **Example**: `0.0`
- **Required**: No
- **Default**: `0.0`

### Application Configuration

#### `NODE_ENV`
- **Description**: Node.js environment mode
- **Format**: String
- **Example**: `development`
- **Required**: Yes
- **Options**: `development`, `staging`, `production`

#### `LOG_LEVEL`
- **Description**: Logging verbosity level
- **Format**: String
- **Example**: `info`
- **Required**: No
- **Default**: `info`
- **Options**: `error`, `warn`, `info`, `debug`

#### `CORS_ALLOWED_ORIGINS`
- **Description**: Comma-separated list of allowed CORS origins
- **Format**: String (comma-separated URLs)
- **Example**: `https://project-friday.web.app,https://project-friday.firebaseapp.com`
- **Required**: No
- **Default**: `*` (development only)

### Security Configuration

#### `JWT_SECRET`
- **Description**: Secret key for JWT token signing (if using custom JWT)
- **Format**: String (minimum 32 characters)
- **Example**: `your-super-secret-jwt-signing-key-here`
- **Required**: No (Firebase Auth handles this)
- **Security**: Generate with `openssl rand -base64 32`

#### `ENCRYPTION_KEY`
- **Description**: Key for encrypting sensitive data at rest
- **Format**: String (32 characters for AES-256)
- **Example**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Required**: No (unless implementing custom encryption)
- **Security**: Generate with `openssl rand -hex 32`

### Optional Features

#### `ENABLE_CALL_RECORDING`
- **Description**: Enable Twilio call recording
- **Format**: Boolean string
- **Example**: `true`
- **Required**: No
- **Default**: `true`
- **Legal**: Ensure compliance with local recording laws

#### `ENABLE_TRANSCRIPTION`
- **Description**: Enable Google Speech-to-Text transcription
- **Format**: Boolean string
- **Example**: `true`
- **Required**: No
- **Default**: `true`

#### `MAX_CALL_DURATION`
- **Description**: Maximum call duration in seconds
- **Format**: Number
- **Example**: `300`
- **Required**: No
- **Default**: `300` (5 minutes)

#### `WEBHOOK_TIMEOUT`
- **Description**: Timeout for webhook responses (seconds)
- **Format**: Number
- **Example**: `30`
- **Required**: No
- **Default**: `30`

### Development/Testing

#### `FIREBASE_EMULATOR_HOST`
- **Description**: Firebase emulator host for local development
- **Format**: String (host:port)
- **Example**: `localhost:8080`
- **Required**: No (development only)

#### `USE_EMULATORS`
- **Description**: Use Firebase emulators instead of production services
- **Format**: Boolean string
- **Example**: `true`
- **Required**: No
- **Default**: `false`

#### `DEBUG_MODE`
- **Description**: Enable debug logging and features
- **Format**: Boolean string
- **Example**: `true`
- **Required**: No
- **Default**: `false`

## Environment File Examples

### `.env.example` (Template)
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

# AI Configuration
GOOGLE_AI_API_KEY=your-gemini-api-key
GEMINI_MODEL_NAME=gemini-2.0-flash-exp

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info

# Optional Features
ENABLE_CALL_RECORDING=true
ENABLE_TRANSCRIPTION=true
MAX_CALL_DURATION=300
```

### `.env.local` (Development)
```env
# Copy from .env.example and fill in real values
FIREBASE_PROJECT_ID=project-friday-471118
# ... other development values

# Development-specific settings
NODE_ENV=development
LOG_LEVEL=debug
USE_EMULATORS=true
DEBUG_MODE=true
```

### `.env.production` (Production)
```env
# Copy from .env.example and fill in production values
FIREBASE_PROJECT_ID=project-friday-prod
# ... other production values

# Production-specific settings
NODE_ENV=production
LOG_LEVEL=warn
USE_EMULATORS=false
DEBUG_MODE=false
CORS_ALLOWED_ORIGINS=https://project-friday.web.app,https://project-friday.firebaseapp.com
```

## Setting Up Environment Variables

### Local Development
1. Copy `.env.example` to `.env.local`
2. Fill in all required values
3. Never commit `.env.local` to version control

### Cloud Functions Deployment
Set environment variables for Firebase Functions:

```bash
# Set individual variables
firebase functions:config:set \
  firebase.project_id="your-project-id" \
  twilio.account_sid="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  twilio.auth_token="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  google.ai_api_key="AIzaSyABC123def456GHI789jkl012MNO345pqr"

# Deploy with new configuration
firebase deploy --only functions
```

### Using Google Secret Manager (Recommended for Production)
```bash
# Create secrets
gcloud secrets create firebase-private-key --data-file=private-key.pem
gcloud secrets create twilio-auth-token --data-file=twilio-token.txt

# Grant access to Cloud Functions
gcloud secrets add-iam-policy-binding firebase-private-key \
  --member="serviceAccount:your-project@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Validation

### Required Variables Checker
Use the validation script to ensure all required variables are set:

```bash
# Run validation
npm run validate-setup

# Or use the dedicated script
./scripts/validate-setup.sh
```

### Environment-Specific Validation
```bash
# Validate development environment
NODE_ENV=development npm run validate-setup

# Validate production environment
NODE_ENV=production npm run validate-setup
```

## Security Best Practices

### 1. Secret Management
- Never commit secrets to version control
- Use different secrets for each environment
- Rotate secrets regularly
- Use Google Secret Manager for production

### 2. Access Control
- Grant minimum required permissions
- Use service accounts with specific roles
- Audit access logs regularly

### 3. Environment Separation
- Use separate projects for dev/staging/prod
- Never use production credentials in development
- Implement proper CI/CD with secret injection

### 4. Monitoring
- Monitor for leaked secrets
- Set up alerts for authentication failures
- Log configuration changes

## Troubleshooting

### Common Issues

#### Invalid Private Key Format
```bash
# Ensure private key has proper escaping
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n-----END PRIVATE KEY-----\n"
```

#### Missing Environment Variables
```bash
# Check if variables are loaded
node -e "console.log(process.env.FIREBASE_PROJECT_ID)"

# Verify .env file is in correct location
ls -la backend/functions/.env*
```

#### Firebase Admin Initialization Error
- Verify service account has proper permissions
- Check project ID matches Firebase project
- Ensure all required APIs are enabled

#### Twilio Webhook Issues
- Verify webhook URL is accessible
- Check phone number configuration
- Ensure proper HTTP method (POST)

### Getting Help
1. Check variable names for typos
2. Verify file permissions on .env files
3. Use the validation script to identify issues
4. Check Firebase Functions logs for specific errors

---

**Important**: Keep this documentation updated when adding new environment variables or changing configuration requirements.