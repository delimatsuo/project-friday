#!/bin/bash

# Enable Firebase Services Script
# This script enables core Firebase services and deploys configuration

set -e

echo "🚀 Enabling Firebase Services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Firebase CLI is installed and user is logged in
print_status "Checking Firebase CLI installation and authentication..."
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI not found. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    print_error "Not logged into Firebase. Please login first:"
    echo "firebase login"
    exit 1
fi

# Check if .firebaserc exists (project is initialized)
if [ ! -f ".firebaserc" ]; then
    print_error ".firebaserc not found. Please initialize Firebase first:"
    echo "firebase init"
    exit 1
fi

# Get the project ID
PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)
if [ -z "$PROJECT_ID" ]; then
    print_error "Could not determine Firebase project ID from .firebaserc"
    exit 1
fi

print_status "Working with Firebase project: $PROJECT_ID"

# Enable required APIs
print_status "Enabling required Google Cloud APIs..."

# Check if gcloud is available for API enablement
if command -v gcloud &> /dev/null; then
    print_status "Enabling Cloud APIs using gcloud..."
    
    # Set the project for gcloud
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    gcloud services enable firestore.googleapis.com
    gcloud services enable cloudfunctions.googleapis.com
    gcloud services enable storage.googleapis.com
    gcloud services enable firebase.googleapis.com
    gcloud services enable firebaseauth.googleapis.com
    
    print_success "Google Cloud APIs enabled"
else
    print_warning "gcloud CLI not found. You may need to enable APIs manually in the Google Cloud Console:"
    echo "https://console.cloud.google.com/apis/library"
fi

# Initialize Firestore Database
print_status "Checking Firestore Database status..."
if firebase firestore:indexes --project=$PROJECT_ID &> /dev/null; then
    print_success "Firestore Database is already enabled"
else
    print_warning "Firestore Database needs to be enabled manually:"
    echo "1. Go to https://console.firebase.google.com/project/$PROJECT_ID/firestore"
    echo "2. Click 'Create database'"
    echo "3. Choose 'Start in production mode' (we'll deploy rules)"
    echo "4. Select a location (us-central1 is recommended)"
    echo ""
    echo "After enabling Firestore, press Enter to continue..."
    read -r
fi

# Deploy Firestore rules and indexes
print_status "Deploying Firestore security rules..."
if firebase deploy --only firestore:rules --project=$PROJECT_ID; then
    print_success "Firestore security rules deployed"
else
    print_error "Failed to deploy Firestore rules"
fi

print_status "Deploying Firestore indexes..."
if firebase deploy --only firestore:indexes --project=$PROJECT_ID; then
    print_success "Firestore indexes deployed"
else
    print_error "Failed to deploy Firestore indexes"
fi

# Enable Cloud Storage
print_status "Checking Cloud Storage status..."
if firebase storage:rules:get --project=$PROJECT_ID &> /dev/null; then
    print_success "Cloud Storage is already enabled"
else
    print_warning "Cloud Storage needs to be enabled manually:"
    echo "1. Go to https://console.firebase.google.com/project/$PROJECT_ID/storage"
    echo "2. Click 'Get started'"
    echo "3. Keep the default security rules for now"
    echo "4. Choose a location (us-central1 is recommended)"
    echo ""
    echo "After enabling Cloud Storage, press Enter to continue..."
    read -r
fi

# Deploy Storage rules
print_status "Deploying Cloud Storage security rules..."
if firebase deploy --only storage --project=$PROJECT_ID; then
    print_success "Cloud Storage security rules deployed"
else
    print_error "Failed to deploy Storage rules"
fi

# Check Cloud Functions (requires Blaze plan)
print_status "Checking Cloud Functions status..."
if firebase functions:list --project=$PROJECT_ID &> /dev/null; then
    print_success "Cloud Functions is already enabled"
else
    print_warning "Cloud Functions requires the Blaze (pay-as-you-go) plan:"
    echo "1. Go to https://console.firebase.google.com/project/$PROJECT_ID/functions"
    echo "2. Click 'Get started'"
    echo "3. Upgrade to Blaze plan if prompted"
    echo ""
    echo "Note: The Blaze plan has a generous free tier for Cloud Functions"
fi

# Create functions directory structure if it doesn't exist
print_status "Setting up Cloud Functions directory structure..."
if [ ! -d "functions" ]; then
    mkdir -p functions/src
    
    # Create a basic package.json for functions
    cat > functions/package.json << EOF
{
  "name": "functions",
  "scripts": {
    "lint": "eslint --ext .js,.ts .",
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "18"
  },
  "main": "lib/index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.5.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^5.12.0",
    "@typescript-eslint/parser": "^5.12.0",
    "eslint": "^8.9.0",
    "eslint-plugin-import": "^2.25.4",
    "typescript": "^4.9.0"
  },
  "private": true
}
EOF

    # Create TypeScript config
    cat > functions/tsconfig.json << EOF
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017"
  },
  "compileOnSave": true,
  "include": [
    "src"
  ]
}
EOF

    # Create basic index.ts
    cat > functions/src/index.ts << EOF
import {onRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});
EOF

    print_success "Cloud Functions directory structure created"
fi

# Final status check
print_status "Final service status check..."

echo "📊 Firebase Services Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check each service
printf "%-20s" "Firestore Database:"
if firebase firestore:indexes --project=$PROJECT_ID &> /dev/null; then
    print_success "✅ Enabled"
else
    print_warning "⚠️  Needs manual setup"
fi

printf "%-20s" "Cloud Storage:"
if firebase storage:rules:get --project=$PROJECT_ID &> /dev/null; then
    print_success "✅ Enabled"
else
    print_warning "⚠️  Needs manual setup"
fi

printf "%-20s" "Cloud Functions:"
if firebase functions:list --project=$PROJECT_ID &> /dev/null; then
    print_success "✅ Enabled"
else
    print_warning "⚠️  Needs Blaze plan"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

print_success "Firebase services enablement script completed!"
echo ""
echo "📝 Next Steps:"
echo "1. Manually enable any services marked as 'Needs manual setup'"
echo "2. Run './scripts/validate-firebase-services.sh' to verify all services"
echo "3. Start development with 'firebase emulators:start'"
echo ""
echo "🔗 Useful Links:"
echo "- Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
echo "- Google Cloud Console: https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"