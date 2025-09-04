/**
 * Test script for simple Twilio webhook
 * Tests the handleCall endpoint with simulated Twilio data
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function testWebhook() {
  try {
    // Dynamic import for fetch (Node.js 18+)
    const fetch = (await import('node-fetch')).default;
    
    const webhookUrl = 'http://localhost:8080/handleCall';
    
    // Simulate Twilio webhook payload
    const twilioPayload = {
      CallSid: 'CA1234567890abcdef1234567890abcdef',
      From: '+15551234567',
      To: '+16508442028', // Project Friday number
      CallStatus: 'in-progress',
      Direction: 'inbound',
      AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      CallerName: 'Test Caller'
    };

    console.log('🧪 Testing handleCall webhook...');
    console.log('📞 Webhook URL:', webhookUrl);
    console.log('📱 Payload:', JSON.stringify(twilioPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Twilio-Signature': 'test-signature'
      },
      body: JSON.stringify(twilioPayload)
    });

    console.log('\n📋 Response Status:', response.status);
    console.log('📋 Content-Type:', response.headers.get('content-type'));

    const responseBody = await response.text();
    console.log('\n📝 TwiML Response:');
    console.log(responseBody);

    // Validate TwiML structure
    if (responseBody.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
      console.log('\n✅ Valid XML format');
    } else {
      console.log('\n❌ Invalid XML format');
    }

    if (responseBody.includes('Hello from Project Friday')) {
      console.log('✅ Contains required message');
    } else {
      console.log('❌ Missing required message');
    }

    if (responseBody.includes('<Hangup/>')) {
      console.log('✅ Properly ends call with hangup');
    } else {
      console.log('❌ Missing hangup instruction');
    }

    console.log('\n🎉 Webhook test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Test health endpoint too
async function testHealthEndpoint() {
  try {
    const fetch = (await import('node-fetch')).default;
    const healthUrl = 'http://localhost:8080/health';

    console.log('\n🏥 Testing health endpoint...');
    const response = await fetch(healthUrl);
    const healthData = await response.json();

    console.log('📋 Health Status:', response.status);
    console.log('📊 Health Data:', JSON.stringify(healthData, null, 2));

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting Project Friday webhook tests...\n');
  
  // Test health first, then webhook
  testHealthEndpoint().then(() => {
    setTimeout(testWebhook, 1000);
  });
}

export { testWebhook, testHealthEndpoint };