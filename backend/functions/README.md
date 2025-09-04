# Project Friday - Cloud Functions

This directory contains the Firebase Cloud Functions for Project Friday's AI-powered call handling system.

## Architecture Overview

The Cloud Functions handle:
- **Call Processing**: Twilio webhook integration for incoming/outgoing calls
- **AI Conversation**: Real-time conversation with Google Gemini 2.5 Flash
- **Data Persistence**: Call transcripts, summaries, and user data in Firestore
- **Push Notifications**: FCM integration for call notifications

## Project Structure

```
functions/
├── index.js                    # Main entry point and webhook handlers
├── package.json               # Dependencies and scripts
├── .eslintrc.js              # ESLint configuration
├── .babelrc                  # Babel configuration for ES6 modules
├── .env.example              # Environment variables template
└── src/
    ├── services/
    │   ├── twilioService.js   # Twilio API integration
    │   ├── geminiService.js   # Gemini AI integration
    │   └── firestoreService.js # Firestore operations
    └── utils/
        └── logger.js          # Structured logging utility
```

## Key Features

### Call Handling Flow
1. Twilio webhook receives incoming call
2. TwiML response initiates speech-to-text
3. User speech sent to Gemini AI for processing
4. AI response converted to speech via TwiML
5. Conversation continues until completion
6. Call transcript and summary stored in Firestore

### Services

#### TwilioService
- Webhook signature validation
- TwiML response generation
- Call management (make, hangup, status updates)
- Recording management
- SMS functionality

#### GeminiService  
- Conversational AI with Google Gemini 2.5 Flash
- Context-aware responses optimized for voice
- Call summarization
- Conversation analysis and sentiment detection
- Response optimization for text-to-speech

#### FirestoreService
- Call record management (CRUD operations)
- User profile management
- Analytics and reporting
- Settings management
- Batch operations and cleanup

### Logger Utility
- Structured logging for Cloud Functions
- Request/response correlation
- Performance timing
- Cloud Logging integration
- Development-friendly local logging

## Development Setup

### Quick Setup

For a complete setup guide, see **[docs/setup/README.md](../../docs/setup/README.md)**.

**Automated Setup (Recommended):**
```bash
# From project root
./scripts/setup.sh
```

**Manual Setup:**

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys and configuration
   # See docs/setup/ENVIRONMENT_VARIABLES.md for details
   ```

3. **Validate Setup**
   ```bash
   # From project root
   ./scripts/validate-setup.sh
   ```

4. **Start Local Emulator**
   ```bash
   npm run serve
   ```

5. **Run Linting**
   ```bash
   npm run lint
   npm run lint:fix
   ```

6. **Run Tests**
   ```bash
   npm test
   npm run test:watch
   ```

### Setup Documentation

- **[Firebase Setup Guide](../../docs/setup/FIREBASE_SETUP_GUIDE.md)** - Complete Firebase/GCP setup
- **[Environment Variables Guide](../../docs/setup/ENVIRONMENT_VARIABLES.md)** - All configuration options
- **[Setup Validation Test](./test/setup.test.js)** - Automated setup testing

## Deployment

1. **Deploy Functions**
   ```bash
   npm run deploy
   ```

2. **View Logs**
   ```bash
   npm run logs
   ```

## Configuration

### Required Environment Variables

- `TWILIO_ACCOUNT_SID`: Twilio account identifier
- `TWILIO_AUTH_TOKEN`: Twilio authentication token  
- `TWILIO_PHONE_NUMBER`: Twilio phone number for calls
- `GEMINI_API_KEY`: Google Gemini API key

### Optional Configuration

- `MAX_CALL_DURATION`: Maximum call duration in seconds (default: 900)
- `LOG_LEVEL`: Logging level (debug/info/warn/error, default: info)
- `ENABLE_ANALYTICS`: Enable call analytics (default: true)
- `CORS_ORIGINS`: Allowed CORS origins

## API Endpoints

### Webhook Endpoints
- `POST /webhooks/handleCall` - Main Twilio call webhook
- `POST /webhooks/callStatus` - Call status updates
- `POST /webhooks/processAudio` - Speech-to-text processing

### Callable Functions
- `getCallHistory(userId, limit, offset)` - Retrieve user call history
- `getCallDetails(callSid)` - Get specific call details

### Health Check
- `GET /webhooks/health` - Service health status

## Security Features

- Twilio webhook signature validation
- CORS configuration
- Rate limiting
- Input validation with Joi
- Helmet.js security headers
- Firebase Authentication integration

## Monitoring & Observability

- Structured logging with Cloud Logging
- Request correlation IDs
- Performance timing metrics
- Error tracking and alerts
- Database health monitoring

## Testing

The functions include comprehensive test coverage for:
- Webhook request/response handling
- AI response generation
- Database operations  
- Error scenarios
- Security validations

Run tests with:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
```

## Performance Considerations

- Response caching for frequent requests
- Batch database operations
- Connection pooling for external APIs
- Timeout handling for long operations
- Memory optimization for large payloads

## Error Handling

The system includes robust error handling:
- Graceful degradation for API failures
- Fallback responses for AI errors
- Retry logic for transient failures
- Comprehensive error logging
- User-friendly error messages

## Best Practices

1. **Code Quality**: ESLint configuration enforces consistent code style
2. **Security**: All inputs validated, signatures verified
3. **Performance**: Efficient database queries, appropriate caching
4. **Monitoring**: Comprehensive logging and metrics
5. **Testing**: Unit and integration test coverage
6. **Documentation**: Inline JSDoc comments for all functions