# Speech Services Integration

## Overview
This document describes the Google Speech-to-Text (STT) and Text-to-Speech (TTS) integration with Twilio for Project Friday's AI call screening functionality.

## Architecture

### Components

1. **Twilio Voice Webhook** (`handleCallWithStream`)
   - Receives incoming call webhooks from Twilio
   - Returns TwiML with `<Connect><Stream>` to establish WebSocket connection
   - Routes audio to WebSocket server for processing

2. **WebSocket Server** (`StreamHandler`)
   - Manages bidirectional WebSocket connections with Twilio
   - Handles Twilio Media Stream protocol
   - Coordinates STT and TTS services

3. **Speech Service** (`SpeechService`)
   - Integrates with Google Cloud Speech-to-Text API
   - Integrates with Google Cloud Text-to-Speech API
   - Manages audio format conversion (μ-law 8kHz)

## Implementation Details

### Audio Format
- **Codec**: μ-law (G.711)
- **Sample Rate**: 8000 Hz
- **Channels**: Mono
- **Encoding**: Base64 for transport over WebSocket

### Speech-to-Text Configuration
```javascript
{
  encoding: 'MULAW',
  sampleRateHertz: 8000,
  languageCode: 'en-US',
  model: 'phone_call',
  useEnhanced: true,
  enableAutomaticPunctuation: true
}
```

### Text-to-Speech Configuration
```javascript
{
  voice: {
    languageCode: 'en-US',
    ssmlGender: 'FEMALE',
    name: 'en-US-Neural2-F'
  },
  audioConfig: {
    audioEncoding: 'MULAW',
    sampleRateHertz: 8000
  }
}
```

## Deployment Options

### Option 1: Integrated with Cloud Functions
Deploy the WebSocket server alongside Cloud Functions:
```bash
firebase deploy --only functions
```

**Limitations**: Cloud Functions have limited WebSocket support, may timeout.

### Option 2: Separate WebSocket Server (Recommended)
Deploy WebSocket server on Google Cloud Run or Compute Engine:
```bash
# Start standalone WebSocket server
npm run serve:websocket

# Use ngrok for local testing
ngrok http 8081
```

### Option 3: Local Development
For testing with ngrok:
```bash
# Terminal 1: Start WebSocket server
npm run serve:websocket

# Terminal 2: Expose via ngrok
ngrok http 8081

# Terminal 3: Start Cloud Function locally
npm run serve:stream
```

## Testing

### 1. Test WebSocket Server
```bash
npm run test:websocket
```

### 2. Test with Twilio
Update Twilio webhook to point to:
- Production: `https://[region]-[project].cloudfunctions.net/handleCallWithStream`
- Development: `https://[your-ngrok].ngrok.io/handleCallWithStream`

### 3. Manual Testing
Call the configured Twilio number and verify:
1. Initial greeting plays
2. WebSocket connection established
3. Speech is transcribed
4. TTS responses are generated
5. Audio plays back to caller

## Environment Variables

Required environment variables:

```bash
# Google Cloud credentials (automatically set in Cloud Functions)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# WebSocket configuration
WEBSOCKET_URL=wss://your-websocket-server.com/media-stream
CUSTOM_WEBSOCKET_URL=wss://your-ngrok.ngrok.io/media-stream
WS_PORT=8081

# Twilio credentials (stored in Secret Manager)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
```

## API Usage and Costs

### Google Speech-to-Text
- **Pricing**: $0.006 per 15 seconds of audio (standard model)
- **Enhanced Phone Call Model**: $0.009 per 15 seconds
- **Free Tier**: 60 minutes per month

### Google Text-to-Speech
- **Standard Voices**: $4 per 1 million characters
- **WaveNet Voices**: $16 per 1 million characters
- **Neural2 Voices**: $16 per 1 million characters
- **Free Tier**: 1 million characters per month (standard), 0.25 million (WaveNet/Neural2)

### Twilio
- **Incoming Calls**: $0.0085 per minute
- **Media Streams**: No additional charge
- **Phone Number**: $1.15 per month

## Monitoring

### Logging
All events are logged to Cloud Logging:
- Connection events
- Transcription results
- TTS generation
- Error conditions

### Metrics to Track
- WebSocket connection count
- Average transcription latency
- TTS generation time
- Call duration
- Error rate

## Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**
   - Check firewall rules allow WebSocket traffic
   - Verify TwiML points to correct WebSocket URL
   - Check Cloud Function logs for errors

2. **No Audio Transcription**
   - Verify Google Cloud credentials are set
   - Check Speech-to-Text API is enabled
   - Ensure audio format matches configuration

3. **TTS Not Playing**
   - Verify Text-to-Speech API is enabled
   - Check audio encoding matches Twilio requirements
   - Monitor WebSocket for audio packet transmission

### Debug Commands

```bash
# View Cloud Function logs
firebase functions:log --only handleCallWithStream

# Test WebSocket connectivity
wscat -c wss://your-server/media-stream

# Check API quotas
gcloud services list --enabled
gcloud monitoring metrics-descriptors list --filter="metric.type=speech.googleapis.com"
```

## Security Considerations

1. **Authentication**: Implement webhook validation for Twilio requests
2. **Rate Limiting**: Implement rate limiting on WebSocket connections
3. **Encryption**: Always use WSS (WebSocket Secure) in production
4. **Secrets**: Store credentials in Google Secret Manager
5. **CORS**: Configure appropriate CORS policies

## Future Enhancements

1. **Gemini AI Integration**: Replace simple echo with AI-powered responses
2. **Call Recording**: Store audio for training and quality assurance
3. **Multi-language Support**: Add support for multiple languages
4. **Voice Customization**: Allow users to select TTS voice preferences
5. **Real-time Analytics**: Stream metrics to dashboard
6. **Adaptive Quality**: Adjust audio quality based on network conditions

## References

- [Twilio Media Streams Documentation](https://www.twilio.com/docs/voice/twiml/stream)
- [Google Speech-to-Text Documentation](https://cloud.google.com/speech-to-text/docs)
- [Google Text-to-Speech Documentation](https://cloud.google.com/text-to-speech/docs)
- [WebSocket Protocol RFC 6455](https://tools.ietf.org/html/rfc6455)