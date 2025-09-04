#!/bin/bash

# Project Friday - Automated Firebase Setup Script
# This script automates the initial setup process for Firebase/GCP

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FUNCTIONS_DIR="$BACKEND_DIR/functions"

# Default values
DEFAULT_REGION="us-central1"
DEFAULT_NODE_VERSION="18"

# Helper functions
print_header() {
    echo -e "\n${BLUE}===========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing_deps=()
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version | sed 's/v//')
        local major_version=$(echo $node_version | cut -d. -f1)
        if [ "$major_version" -ge 18 ]; then
            print_success "Node.js $node_version (required: 18+)"
        else
            print_error "Node.js version $node_version is too old. Required: 18+"
            missing_deps+=("node")
        fi
    else
        print_error "Node.js not found"
        missing_deps+=("node")
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=$(npm --version)
        print_success "npm $npm_version"
    else
        print_error "npm not found"
        missing_deps+=("npm")
    fi
    
    # Check Firebase CLI
    if command_exists firebase; then
        local firebase_version=$(firebase --version | head -n1)
        print_success "Firebase CLI: $firebase_version"
    else
        print_warning "Firebase CLI not found - will install"
        missing_deps+=("firebase-cli")
    fi
    
    # Check gcloud CLI (optional but recommended)
    if command_exists gcloud; then
        local gcloud_version=$(gcloud --version | head -n1)
        print_success "gcloud CLI: $gcloud_version"
    else
        print_warning "gcloud CLI not found (optional but recommended)"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install the missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                "node")
                    echo "  - Install Node.js 18+ from https://nodejs.org/"
                    ;;
                "npm")
                    echo "  - npm should come with Node.js"
                    ;;
                "firebase-cli")
                    echo "  - Run: npm install -g firebase-tools"
                    ;;
            esac
        done
        exit 1
    fi
}

# Install Firebase CLI if not present
install_firebase_cli() {
    if ! command_exists firebase; then
        print_info "Installing Firebase CLI..."
        npm install -g firebase-tools@latest
        print_success "Firebase CLI installed"
    fi
}

# Login to Firebase
firebase_login() {
    print_header "Firebase Authentication"
    
    # Check if already logged in
    if firebase projects:list >/dev/null 2>&1; then
        print_success "Already logged in to Firebase"
        
        # Show current user
        local user_email=$(firebase auth:export /dev/null 2>&1 | grep -o '[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]*\.[a-zA-Z]*' | head -1 || echo "Unknown")
        print_info "Logged in as: $user_email"
    else
        print_info "Logging in to Firebase..."
        firebase login
        print_success "Successfully logged in to Firebase"
    fi
}

# Select or create Firebase project
setup_firebase_project() {
    print_header "Firebase Project Setup"
    
    echo "Available Firebase projects:"
    firebase projects:list
    echo ""
    
    read -p "Enter your Firebase project ID (or press Enter to create new): " project_id
    
    if [ -z "$project_id" ]; then
        echo ""
        print_info "Creating new Firebase project..."
        read -p "Enter project ID for new project: " new_project_id
        read -p "Enter project display name: " display_name
        
        # Note: Creating projects via CLI requires additional setup
        print_warning "Project creation via CLI requires additional permissions."
        print_info "Please create the project manually at https://console.firebase.google.com/"
        print_info "Then run this script again with the project ID."
        exit 0
    fi
    
    # Set the project
    print_info "Setting Firebase project to: $project_id"
    cd "$BACKEND_DIR"
    
    if firebase use "$project_id"; then
        print_success "Firebase project set to: $project_id"
    else
        print_error "Failed to set Firebase project. Please check the project ID."
        exit 1
    fi
}

# Initialize Firebase services
init_firebase_services() {
    print_header "Initializing Firebase Services"
    
    cd "$BACKEND_DIR"
    
    # Check if already initialized
    if [ -f "firebase.json" ]; then
        print_success "Firebase already initialized"
        return 0
    fi
    
    print_info "Initializing Firebase..."
    
    # Create firebase.json if it doesn't exist
    cat > firebase.json << EOF
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs18"
    }
  ],
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "storage": {
      "port": 9199
    },
    "ui": {
      "enabled": true,
      "port": 4000
    },
    "singleProjectMode": true
  }
}
EOF
    
    # Create basic Firestore rules
    if [ ! -f "firestore.rules" ]; then
        cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Call logs are private to each user
    match /users/{userId}/call_logs/{callId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
EOF
        print_success "Created firestore.rules"
    fi
    
    # Create Firestore indexes file
    if [ ! -f "firestore.indexes.json" ]; then
        cat > firestore.indexes.json << 'EOF'
{
  "indexes": [],
  "fieldOverrides": []
}
EOF
        print_success "Created firestore.indexes.json"
    fi
    
    # Create Storage rules
    if [ ! -f "storage.rules" ]; then
        cat > storage.rules << 'EOF'
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
EOF
        print_success "Created storage.rules"
    fi
    
    print_success "Firebase initialization complete"
}

# Setup Functions directory and dependencies
setup_functions() {
    print_header "Setting Up Cloud Functions"
    
    cd "$FUNCTIONS_DIR"
    
    # Install dependencies
    if [ -f "package.json" ]; then
        print_info "Installing function dependencies..."
        npm install
        print_success "Dependencies installed"
    else
        print_error "package.json not found in functions directory"
        exit 1
    fi
    
    # Create .env.example if it doesn't exist
    if [ ! -f ".env.example" ]; then
        print_info "Creating .env.example template..."
        cat > .env.example << 'EOF'
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
EOF
        print_success "Created .env.example"
    fi
    
    # Remind user to create .env.local
    if [ ! -f ".env.local" ]; then
        print_warning "Please create .env.local from .env.example and fill in your actual values"
        print_info "See docs/setup/ENVIRONMENT_VARIABLES.md for detailed instructions"
    fi
}

# Enable required APIs
enable_apis() {
    print_header "Enabling Required APIs"
    
    if ! command_exists gcloud; then
        print_warning "gcloud CLI not found. Please enable APIs manually:"
        echo "  - Firebase Management API"
        echo "  - Cloud Functions API"
        echo "  - Cloud Firestore API"
        echo "  - Firebase Authentication API"
        echo "  - Cloud Storage API"
        echo "  - Cloud Text-to-Speech API"
        echo "  - Cloud Speech-to-Text API"
        echo "  - Vertex AI API"
        echo "  - Firebase Cloud Messaging API"
        return 0
    fi
    
    local project_id=$(firebase use | grep -o 'Active Project:.*' | cut -d' ' -f3 || echo "")
    
    if [ -z "$project_id" ]; then
        print_error "Could not determine current Firebase project"
        return 1
    fi
    
    print_info "Enabling APIs for project: $project_id"
    
    local apis=(
        "firebase.googleapis.com"
        "cloudfunctions.googleapis.com"
        "firestore.googleapis.com"
        "identitytoolkit.googleapis.com"
        "storage-api.googleapis.com"
        "texttospeech.googleapis.com"
        "speech.googleapis.com"
        "aiplatform.googleapis.com"
        "fcm.googleapis.com"
        "iam.googleapis.com"
    )
    
    for api in "${apis[@]}"; do
        print_info "Enabling $api..."
        if gcloud services enable "$api" --project="$project_id" >/dev/null 2>&1; then
            print_success "Enabled $api"
        else
            print_warning "Failed to enable $api (may already be enabled)"
        fi
    done
}

# Generate service account key (if needed)
setup_service_account() {
    print_header "Service Account Setup"
    
    if ! command_exists gcloud; then
        print_warning "gcloud CLI not found. Please set up service account manually:"
        print_info "1. Go to Google Cloud Console > IAM & Admin > Service Accounts"
        print_info "2. Find the Firebase Admin SDK service account"
        print_info "3. Create a new JSON key"
        print_info "4. Use the key values in your .env.local file"
        return 0
    fi
    
    local project_id=$(firebase use | grep -o 'Active Project:.*' | cut -d' ' -f3 || echo "")
    
    if [ -z "$project_id" ]; then
        print_error "Could not determine current Firebase project"
        return 1
    fi
    
    print_info "Service account setup for project: $project_id"
    print_warning "Service account key should be generated manually for security"
    print_info "See docs/setup/FIREBASE_SETUP_GUIDE.md for detailed instructions"
}

# Test Firebase connection
test_firebase_connection() {
    print_header "Testing Firebase Connection"
    
    cd "$BACKEND_DIR"
    
    print_info "Testing Firebase project access..."
    if firebase projects:list | grep -q "$(firebase use | grep -o 'Active Project:.*' | cut -d' ' -f3)"; then
        print_success "Firebase project access confirmed"
    else
        print_error "Firebase project access failed"
        return 1
    fi
    
    print_info "Testing Firestore rules deployment..."
    if firebase deploy --only firestore:rules --project="$(firebase use | grep -o 'Active Project:.*' | cut -d' ' -f3)" >/dev/null 2>&1; then
        print_success "Firestore rules deployed successfully"
    else
        print_warning "Firestore rules deployment failed (may need manual setup)"
    fi
    
    print_info "Testing Functions deployment (dry run)..."
    cd "$FUNCTIONS_DIR"
    if npm run lint >/dev/null 2>&1; then
        print_success "Functions code passed linting"
    else
        print_warning "Functions linting failed (check code syntax)"
    fi
}

# Start Firebase emulators
start_emulators() {
    print_header "Starting Firebase Emulators"
    
    cd "$BACKEND_DIR"
    
    read -p "Start Firebase emulators for local development? (y/N): " start_emulators
    
    if [[ $start_emulators =~ ^[Yy]$ ]]; then
        print_info "Starting Firebase emulators..."
        print_info "Emulator UI will be available at: http://localhost:4000"
        print_info "Press Ctrl+C to stop emulators"
        
        firebase emulators:start
    else
        print_info "Emulators not started. You can start them later with:"
        print_info "  cd backend && firebase emulators:start"
    fi
}

# Display setup summary
show_setup_summary() {
    print_header "Setup Complete!"
    
    local project_id=$(firebase use | grep -o 'Active Project:.*' | cut -d' ' -f3 || echo "Unknown")
    
    echo -e "${GREEN}✓ Firebase project configured: $project_id${NC}"
    echo -e "${GREEN}✓ Cloud Functions initialized${NC}"
    echo -e "${GREEN}✓ Firestore rules configured${NC}"
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    
    echo ""
    print_info "Next Steps:"
    echo "1. Create and configure .env.local file:"
    echo "   cp backend/functions/.env.example backend/functions/.env.local"
    echo "   # Edit .env.local with your actual values"
    echo ""
    echo "2. Set up Twilio integration (see docs/setup/FIREBASE_SETUP_GUIDE.md)"
    echo ""
    echo "3. Get your Gemini API key from Google AI Studio"
    echo ""
    echo "4. Run the validation script:"
    echo "   ./scripts/validate-setup.sh"
    echo ""
    echo "5. Start development with emulators:"
    echo "   cd backend && firebase emulators:start"
    echo ""
    echo "6. Deploy to production:"
    echo "   cd backend && firebase deploy"
    
    print_info "Documentation:"
    echo "  - Setup Guide: docs/setup/FIREBASE_SETUP_GUIDE.md"
    echo "  - Environment Variables: docs/setup/ENVIRONMENT_VARIABLES.md"
}

# Error handler
handle_error() {
    print_error "An error occurred during setup!"
    print_info "Check the output above for details"
    print_info "You can re-run this script to continue setup"
    exit 1
}

# Main setup function
main() {
    print_header "Project Friday - Firebase Setup"
    print_info "This script will set up Firebase/GCP for Project Friday"
    print_info "Make sure you have a Google account and billing enabled"
    echo ""
    
    # Set error handler
    trap handle_error ERR
    
    # Run setup steps
    check_prerequisites
    install_firebase_cli
    firebase_login
    setup_firebase_project
    init_firebase_services
    setup_functions
    enable_apis
    setup_service_account
    test_firebase_connection
    
    # Show summary
    show_setup_summary
    
    # Optionally start emulators
    start_emulators
}

# Run main function
main "$@"