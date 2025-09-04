#!/bin/bash

# Setup Twilio Secrets in Google Secret Manager
# Usage: ./setup-twilio-secrets.sh

set -e

PROJECT_ID="project-friday-471118"
REGION="us-central1"

echo "🔐 Setting up Twilio credentials in Google Secret Manager"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Enable Secret Manager API if not already enabled
echo "📦 Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

# Function to create or update a secret
create_or_update_secret() {
    SECRET_NAME=$1
    SECRET_VALUE=$2
    
    # Check if secret exists
    if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID &>/dev/null; then
        echo "✅ Updating existing secret: $SECRET_NAME"
        echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=- --project=$PROJECT_ID
    else
        echo "✨ Creating new secret: $SECRET_NAME"
        echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME --data-file=- --replication-policy=automatic --project=$PROJECT_ID
    fi
}

# Prompt for Twilio credentials
echo ""
echo "📋 Please provide your Twilio credentials:"
echo "(You can find these in your Twilio Console: https://console.twilio.com)"
echo ""

read -p "Enter your Twilio Account SID: " TWILIO_ACCOUNT_SID
read -s -p "Enter your Twilio Auth Token: " TWILIO_AUTH_TOKEN
echo ""
read -p "Enter your Twilio Phone Number (with country code, e.g., +14155551234): " TWILIO_PHONE_NUMBER

# Validate inputs
if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ] || [ -z "$TWILIO_PHONE_NUMBER" ]; then
    echo "❌ Error: All fields are required"
    exit 1
fi

# Store secrets in Secret Manager
echo ""
echo "🚀 Storing secrets in Google Secret Manager..."

create_or_update_secret "twilio-account-sid" "$TWILIO_ACCOUNT_SID"
create_or_update_secret "twilio-auth-token" "$TWILIO_AUTH_TOKEN"
create_or_update_secret "twilio-phone-number" "$TWILIO_PHONE_NUMBER"

# Grant Cloud Functions service account access to secrets
echo ""
echo "🔑 Granting Cloud Functions access to secrets..."

# Get the default service account for Cloud Functions
SERVICE_ACCOUNT="$PROJECT_ID@appspot.gserviceaccount.com"

# Grant access to each secret
for SECRET in "twilio-account-sid" "twilio-auth-token" "twilio-phone-number"; do
    gcloud secrets add-iam-policy-binding $SECRET \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID \
        --quiet
done

# Create local .env file for development (optional)
echo ""
read -p "Would you like to create a local .env file for development? (y/n): " CREATE_ENV

if [ "$CREATE_ENV" = "y" ] || [ "$CREATE_ENV" = "Y" ]; then
    cat > ../functions/.env.local << EOF
# Twilio Configuration (Development Only - DO NOT COMMIT)
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER

# Google Cloud
PROJECT_ID=$PROJECT_ID
REGION=$REGION
EOF
    echo "✅ Created .env.local file in functions directory"
    echo "⚠️  Remember: Never commit .env.local to version control!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Twilio credentials successfully stored in Secret Manager!"
echo ""
echo "📝 Next steps:"
echo "1. Configure your Twilio phone number webhook to:"
echo "   https://us-central1-$PROJECT_ID.cloudfunctions.net/handleCall"
echo "2. The Cloud Functions can now access these secrets securely"
echo "3. Test the configuration with: npm run test:twilio"
echo ""
echo "🔍 To verify secrets were created:"
echo "   gcloud secrets list --project=$PROJECT_ID"
echo ""
echo "📖 To view a secret value (for debugging):"
echo "   gcloud secrets versions access latest --secret=twilio-account-sid --project=$PROJECT_ID"