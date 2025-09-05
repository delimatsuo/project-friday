# Gemini AI Integration Documentation

## Overview
This document describes the integration of Google's Gemini 2.5 Flash AI model into Project Friday for intelligent call screening and conversational responses.

## Architecture

### Components

1. **GeminiService** (`src/services/geminiService.js`)
   - Manages Gemini API client initialization
   - Generates conversational AI responses
   - Processes responses for voice synthesis
   - Creates call summaries and analysis
   - Handles context management and conversation history

2. **StreamHandler Integration** (`src/handlers/streamHandler.js`)
   - Integrates GeminiService with WebSocket streaming
   - Processes transcripts through AI model
   - Manages conversation flow and context
   - Generates call summaries on termination

## Implementation Details

### System Prompt
The AI acts as "Friday", a professional call screening assistant with the following characteristics:
- Professional and courteous demeanor
- Efficient information gathering
- Clear and concise communication
- Voice-optimized responses
- Context-aware conversation management

### Configuration

```javascript
// Model configuration
model: 'gemini-1.5-flash-latest'
temperature: 0.7
topK: 40
topP: 0.95
maxOutputTokens: 150  // Optimized for voice responses

// Safety settings
HARM_CATEGORY_HARASSMENT: BLOCK_NONE
HARM_CATEGORY_HATE_SPEECH: BLOCK_NONE
HARM_CATEGORY_SEXUALLY_EXPLICIT: BLOCK_NONE
HARM_CATEGORY_DANGEROUS_CONTENT: BLOCK_NONE
```

### Core Methods

#### `generateResponse(userInput, previousTranscripts)`
- Processes user speech and generates AI response
- Maintains conversation context
- Returns voice-optimized text

#### `generateSummary(transcripts)`
- Creates concise call summaries
- Extracts key information (caller, purpose, urgency)
- Provides actionable insights

#### `processResponseForVoice(text)`
- Cleans text for TTS synthesis
- Removes markdown and special formatting
- Optimizes for natural speech patterns

#### `analyzeConversation(transcripts)`
- Analyzes sentiment and engagement
- Determines call importance
- Provides metadata for prioritization

## Integration Flow

### 1. Call Initialization
```javascript
// When call connects
1. WebSocket connection established
2. GeminiService initialized with API key
3. Initial AI greeting generated
4. TTS synthesis and playback
```

### 2. Conversation Processing
```javascript
// For each user utterance
1. Speech-to-Text transcription
2. Transcript sent to Gemini AI
3. AI generates contextual response
4. Response processed for voice
5. TTS synthesis and playback
6. Conversation history updated
```

### 3. Call Termination
```javascript
// When call ends
1. Generate call summary
2. Analyze conversation sentiment
3. Store summary in database
4. Send notification to user
```

## Testing

### Unit Tests (46 tests)
Located in `tests/geminiService.test.js`:
- Constructor and initialization (4 tests)
- Response generation (11 tests)  
- Advanced features (8 tests)
- Response processing (7 tests)
- Utility methods (9 tests)
- Error handling (7 tests)

**Coverage**: 95.91% statement coverage, 85.71% branch coverage

### Integration Tests
Located in `tests/integration/callFlow.test.js`:
- End-to-end call flow simulation
- WebSocket streaming integration
- AI response generation
- Error handling and fallbacks

## API Usage and Costs

### Gemini 2.5 Flash Pricing
- **Input**: $0.075 per 1M tokens
- **Output**: $0.30 per 1M tokens
- **Free Tier**: 15 RPM, 1M TPM, 1500 RPD

### Token Optimization
- Max output tokens limited to 150 for voice responses
- Conversation history managed to stay within context limits
- Efficient prompt engineering to minimize input tokens

### Example Token Usage
- Average call: ~500 input tokens, ~100 output tokens
- Cost per call: ~$0.000067
- 10,000 calls/month: ~$0.67

## Environment Configuration

### Required Environment Variables
```bash
# Google AI API Key
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional: Custom model configuration
GEMINI_MODEL=gemini-1.5-flash-latest
GEMINI_TEMPERATURE=0.7
GEMINI_MAX_TOKENS=150
```

### Setting Up API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Add to environment variables or Secret Manager

## Error Handling

### Fallback Responses
The system includes multiple fallback layers:

1. **API Failure**: Returns polite fallback message
2. **Rate Limiting**: Queues requests or uses cached responses
3. **Invalid Input**: Requests clarification
4. **Network Issues**: Uses local fallback responses

### Error Messages
```javascript
// API Error
"I'm having trouble understanding. Could you please repeat that?"

// No API Key
"Hello, this is Friday, your AI assistant. I'm here to help screen your call."

// Rate Limited
"Just a moment, please. I'm processing your request."
```

## Performance Optimization

### Response Time
- Target: < 1.5 seconds from transcript to TTS
- Actual: ~800ms average (Gemini API + processing)

### Caching Strategy
- Common greetings cached
- Frequent responses pre-generated
- Context maintained in memory during call

### Scaling Considerations
- Connection pooling for API clients
- Request batching where possible
- Async processing for non-critical operations

## Security Considerations

1. **API Key Management**
   - Store in Google Secret Manager
   - Never commit to repository
   - Rotate regularly

2. **Content Filtering**
   - Safety settings configured
   - PII detection and masking
   - Conversation logging controls

3. **Rate Limiting**
   - Implement per-user limits
   - Queue management for bursts
   - Graceful degradation

## Monitoring and Logging

### Key Metrics
- API response times
- Token usage per call
- Error rates and types
- User satisfaction signals

### Logging
```javascript
// Success
console.log('AI Response:', response);

// Error
console.error('Error generating AI response:', error);

// Summary
console.log('Call Summary:', summary);
```

## Future Enhancements

1. **Multi-language Support**
   - Detect caller language
   - Generate responses in multiple languages
   - Localized greetings and responses

2. **Advanced Context**
   - Caller history integration
   - Business hours awareness
   - Calendar integration

3. **Personalization**
   - User-specific prompts
   - Custom screening criteria
   - Learning from feedback

4. **Voice Cloning**
   - Custom TTS voices
   - User voice matching
   - Brand voice consistency

## Troubleshooting

### Common Issues

1. **"API key not valid"**
   - Verify key in Google AI Studio
   - Check environment variable
   - Ensure key has correct permissions

2. **Slow Responses**
   - Check network latency
   - Verify token limits
   - Monitor API quotas

3. **Inappropriate Responses**
   - Review system prompt
   - Adjust safety settings
   - Add content filters

### Debug Commands
```bash
# Test API connection
node -e "require('./src/services/geminiService').testConnection()"

# Check environment
echo $GOOGLE_API_KEY

# Test WebSocket server
npm run test:websocket
```

## References

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini 2.5 Flash Model Card](https://ai.google.dev/gemini-api/docs/models/gemini)
- [Google AI Studio](https://makersuite.google.com/)
- [Best Practices for Voice AI](https://cloud.google.com/text-to-speech/docs/best-practices)