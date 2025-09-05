/**
 * Test script for WebSocket streaming server
 * This simulates Twilio's media stream connection
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:8081/media-stream';
const TEST_DURATION = 10000; // 10 seconds

console.log('Testing WebSocket server at:', WS_URL);

// Create WebSocket connection
const ws = new WebSocket(WS_URL);

// Connection state
let isConnected = false;
let streamSid = 'test_stream_' + Date.now();
let sequenceNumber = 0;

/**
 * Send a message to the WebSocket server
 */
function sendMessage(event, data = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    const message = JSON.stringify({
      event,
      ...data,
    });
    ws.send(message);
    console.log('Sent:', event, data);
  }
}

/**
 * Generate sample audio data (silence in μ-law format)
 */
function generateSampleAudio() {
  // Create 160 bytes of μ-law silence (20ms at 8kHz)
  const silence = Buffer.alloc(160, 0xff);
  return silence.toString('base64');
}

/**
 * Simulate Twilio media stream
 */
function simulateMediaStream() {
  // Send start event
  sendMessage('start', {
    start: {
      streamSid: streamSid,
      accountSid: 'ACtest123',
      callSid: 'CAtest456',
      tracks: ['inbound', 'outbound'],
      mediaFormat: {
        encoding: 'audio/x-mulaw',
        sampleRate: 8000,
        channels: 1,
      },
    },
  });

  // Send media packets every 20ms
  const mediaInterval = setInterval(() => {
    if (isConnected) {
      sendMessage('media', {
        media: {
          track: 'inbound',
          chunk: sequenceNumber.toString(),
          timestamp: Date.now().toString(),
          payload: generateSampleAudio(),
        },
      });
      sequenceNumber++;
    }
  }, 20);

  // Stop after TEST_DURATION
  setTimeout(() => {
    clearInterval(mediaInterval);
    sendMessage('stop');
    
    setTimeout(() => {
      ws.close();
      console.log('Test completed');
      process.exit(0);
    }, 1000);
  }, TEST_DURATION);
}

// WebSocket event handlers
ws.on('open', () => {
  console.log('WebSocket connected');
  isConnected = true;

  // Send connected event (Twilio protocol)
  sendMessage('connected', {
    protocol: {
      version: '0.2.0',
      callSid: 'CAtest456',
    },
  });

  // Start simulating media stream
  setTimeout(simulateMediaStream, 100);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('Received:', message.event);
    
    if (message.event === 'media' && message.media) {
      console.log('Received audio response from server');
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
  process.exit(1);
});

ws.on('close', () => {
  console.log('WebSocket disconnected');
  isConnected = false;
});

console.log('Starting WebSocket test...');