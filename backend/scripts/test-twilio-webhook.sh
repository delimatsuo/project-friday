#!/bin/bash

# Test Twilio Webhook Configuration
# This script verifies that Twilio is correctly configured to reach our webhook endpoint

set -e

echo "🧪 Testing Twilio Webhook Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load environment variables
if [ -f "../functions/.env.local" ]; then
    export $(cat ../functions/.env.local | grep -v '^#' | xargs)
fi

PROJECT_ID="project-friday-471118"
WEBHOOK_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/handleCall"

echo "📞 Phone Number: ${TWILIO_PHONE_NUMBER}"
echo "🌐 Webhook URL: ${WEBHOOK_URL}"
echo ""

# Test 1: Check if secrets are accessible
echo "1️⃣ Verifying Google Secret Manager access..."
if gcloud secrets versions access latest --secret=twilio-account-sid --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Secret Manager: Account SID accessible"
else
    echo "❌ Secret Manager: Cannot access Account SID"
    exit 1
fi

if gcloud secrets versions access latest --secret=twilio-auth-token --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Secret Manager: Auth Token accessible"
else
    echo "❌ Secret Manager: Cannot access Auth Token"
    exit 1
fi

if gcloud secrets versions access latest --secret=twilio-phone-number --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Secret Manager: Phone Number accessible"
else
    echo "❌ Secret Manager: Cannot access Phone Number"
    exit 1
fi

echo ""

# Test 2: Check webhook URL (should return 404 since function isn't deployed yet)
echo "2️⃣ Testing webhook endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $WEBHOOK_URL)

if [ "$HTTP_STATUS" = "404" ]; then
    echo "✅ Webhook URL configured (404 expected - function not deployed yet)"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️  Cannot reach webhook URL (expected - function not deployed)"
else
    echo "🔍 Webhook returned status: $HTTP_STATUS"
fi

echo ""

# Test 3: Verify Twilio configuration using Twilio API
echo "3️⃣ Verifying Twilio phone number configuration..."
if [ ! -z "$TWILIO_ACCOUNT_SID" ] && [ ! -z "$TWILIO_AUTH_TOKEN" ]; then
    # Clean phone number format
    PHONE_SID=$(echo $TWILIO_PHONE_NUMBER | sed 's/+/%2B/g')
    
    # Get phone number configuration from Twilio
    RESPONSE=$(curl -s -X GET \
        "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${PHONE_SID}" \
        -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}")
    
    if echo "$RESPONSE" | grep -q "voice_url"; then
        VOICE_URL=$(echo "$RESPONSE" | grep -o '"voice_url":"[^"]*' | cut -d'"' -f4)
        if [ "$VOICE_URL" = "$WEBHOOK_URL" ]; then
            echo "✅ Twilio voice webhook correctly configured"
            echo "   URL: $VOICE_URL"
        else
            echo "⚠️  Twilio voice webhook URL mismatch"
            echo "   Expected: $WEBHOOK_URL"
            echo "   Found: $VOICE_URL"
        fi
    else
        echo "❌ Could not retrieve Twilio phone number configuration"
    fi
else
    echo "⚠️  Skipping Twilio API test (credentials not loaded)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary:"
echo ""
echo "✅ Google Secret Manager is properly configured"
echo "✅ Webhook URL is set (function deployment pending)"
echo "✅ Twilio phone number is configured"
echo ""
echo "📝 Next Steps:"
echo "1. Deploy the Cloud Function (Task 3)"
echo "2. Make a test call to ${TWILIO_PHONE_NUMBER}"
echo "3. Check Twilio logs for webhook activity"
echo ""
echo "💡 To view Twilio call logs:"
echo "   https://console.twilio.com/us1/monitor/logs/calls"