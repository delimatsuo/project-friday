#!/bin/bash

# Firebase Deployment Script using Service Account
# This script deploys Firebase services using service account authentication

set -e  # Exit on error

echo "🚀 Starting Firebase deployment for project-friday-471118..."

# Set up environment variables
export GOOGLE_APPLICATION_CREDENTIALS="./config/service-account-key.json"
export FIREBASE_PROJECT="project-friday-471118"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if service account key exists
if [ ! -f "./config/service-account-key.json" ]; then
    echo -e "${RED}❌ Service account key not found at backend/config/service-account-key.json${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Using service account authentication...${NC}"

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Deploy Firestore rules
echo -e "${BLUE}📜 Deploying Firestore rules...${NC}"
npx firebase deploy --only firestore:rules --project $FIREBASE_PROJECT --non-interactive

# Deploy Firestore indexes
echo -e "${BLUE}🗂️ Deploying Firestore indexes...${NC}"
npx firebase deploy --only firestore:indexes --project $FIREBASE_PROJECT --non-interactive

# Deploy Storage rules
echo -e "${BLUE}📁 Deploying Storage rules...${NC}"
npx firebase deploy --only storage --project $FIREBASE_PROJECT --non-interactive

# Deploy Cloud Functions (if functions directory exists)
if [ -d "functions" ]; then
    echo -e "${BLUE}⚡ Installing Cloud Functions dependencies...${NC}"
    cd functions
    npm install
    cd ..
    
    echo -e "${BLUE}☁️ Deploying Cloud Functions...${NC}"
    npx firebase deploy --only functions --project $FIREBASE_PROJECT --non-interactive
fi

echo -e "${GREEN}✅ Firebase deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Enable Authentication providers in Firebase Console"
echo "2. Set up environment variables in Cloud Functions"
echo "3. Configure your iOS app with Firebase"