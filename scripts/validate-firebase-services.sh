#!/bin/bash

# Validate Firebase Services Script
# This script validates that all Firebase services are properly enabled and configured

set -e

echo "🔍 Validating Firebase Services..."

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

# Initialize counters
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0

# Function to run validation test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local success_message="$3"
    local error_message="$4"
    
    printf "%-50s" "Testing $test_name..."
    
    if eval "$test_command" &> /dev/null; then
        echo -e "${GREEN}✅ PASS${NC}"
        [ -n "$success_message" ] && echo "   └── $success_message"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        [ -n "$error_message" ] && echo "   └── $error_message"
        ((FAILED_TESTS++))
        return 1
    fi
}

run_warning_test() {
    local test_name="$1"
    local test_command="$2"
    local success_message="$3"
    local warning_message="$4"
    
    printf "%-50s" "Checking $test_name..."
    
    if eval "$test_command" &> /dev/null; then
        echo -e "${GREEN}✅ OK${NC}"
        [ -n "$success_message" ] && echo "   └── $success_message"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${YELLOW}⚠️  WARNING${NC}"
        [ -n "$warning_message" ] && echo "   └── $warning_message"
        ((WARNING_TESTS++))
        return 1
    fi
}

echo "🧪 Firebase Service Validation Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get project ID
if [ -f ".firebaserc" ]; then
    PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)
    print_status "Firebase Project ID: $PROJECT_ID"
else
    print_error "No .firebaserc found. Please initialize Firebase first."
    exit 1
fi

echo ""

# 1. Firebase CLI Tests
echo "🔧 Firebase CLI Validation:"
run_test "Firebase CLI installed" "command -v firebase" "Firebase CLI is available" "Install with: npm install -g firebase-tools"
run_test "Firebase authentication" "firebase projects:list" "User is authenticated" "Run: firebase login"
run_test "Firebase project access" "firebase projects:list | grep -q $PROJECT_ID" "Project is accessible" "Check project permissions"

echo ""

# 2. Configuration Files Tests
echo "📁 Configuration Files Validation:"
run_test "firebase.json exists" "[ -f 'config/firebase.json' ]" "Firebase config found" "Run: firebase init"
run_test "Firestore rules exist" "[ -f 'config/firestore.rules' ]" "Firestore security rules found" "Create firestore.rules file"
run_test "Firestore indexes exist" "[ -f 'config/firestore.indexes.json' ]" "Firestore indexes config found" "Create firestore.indexes.json file"
run_test "Storage rules exist" "[ -f 'config/storage.rules' ]" "Storage security rules found" "Create storage.rules file"

echo ""

# 3. Firebase Services Tests
echo "🔥 Firebase Services Validation:"

# Firestore Database
run_test "Firestore Database enabled" "firebase firestore:indexes --project=$PROJECT_ID" "Firestore is enabled and accessible" "Enable Firestore in Firebase Console"

# Cloud Storage
run_test "Cloud Storage enabled" "firebase storage:rules:get --project=$PROJECT_ID" "Cloud Storage is enabled and accessible" "Enable Storage in Firebase Console"

# Cloud Functions
run_warning_test "Cloud Functions enabled" "firebase functions:list --project=$PROJECT_ID" "Cloud Functions is enabled" "Enable Cloud Functions (requires Blaze plan)"

echo ""

# 4. Project Structure Tests
echo "📂 Project Structure Validation:"
run_test "Config directory exists" "[ -d 'config' ]" "Configuration directory found" "Create config/ directory"
run_test "Scripts directory exists" "[ -d 'scripts' ]" "Scripts directory found" "Create scripts/ directory"
run_warning_test "Functions directory exists" "[ -d 'functions' ]" "Functions directory ready" "Will be created when needed"

echo ""

# 5. Security Rules Syntax Tests
echo "🔒 Security Rules Validation:"
if [ -f "config/firestore.rules" ]; then
    run_test "Firestore rules syntax" "firebase firestore:rules --project=$PROJECT_ID --dry-run" "Firestore rules syntax is valid" "Fix syntax errors in firestore.rules"
else
    print_error "Firestore rules file not found"
    ((FAILED_TESTS++))
fi

if [ -f "config/storage.rules" ]; then
    run_test "Storage rules syntax" "firebase storage:rules --project=$PROJECT_ID --dry-run" "Storage rules syntax is valid" "Fix syntax errors in storage.rules"
else
    print_error "Storage rules file not found"
    ((FAILED_TESTS++))
fi

echo ""

# 6. Network Connectivity Tests
echo "🌐 Network Connectivity Validation:"
run_test "Firebase API connectivity" "curl -s https://firebase.googleapis.com > /dev/null" "Can reach Firebase APIs" "Check internet connection"
run_test "Google Cloud API connectivity" "curl -s https://cloudfunctions.googleapis.com > /dev/null" "Can reach Google Cloud APIs" "Check internet connection"

echo ""

# 7. Optional: Test Firebase Emulators
echo "🧪 Firebase Emulators Validation:"
run_warning_test "Java runtime for emulators" "command -v java" "Java runtime available for emulators" "Install Java for Firebase emulators"

echo ""

# Results Summary
echo "📊 Validation Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS + WARNING_TESTS))

echo -e "Total Tests:     ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:          ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:          ${RED}$FAILED_TESTS${NC}"
echo -e "Warnings:        ${YELLOW}$WARNING_TESTS${NC}"

echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    if [ $WARNING_TESTS -eq 0 ]; then
        print_success "🎉 All validation tests passed! Firebase services are properly configured."
        echo ""
        echo "✨ Ready for development! You can now:"
        echo "   • Start emulators: firebase emulators:start"
        echo "   • Deploy rules: firebase deploy --only firestore:rules,storage"
        echo "   • Begin coding your application"
    else
        print_warning "✅ Core validation passed with $WARNING_TESTS warnings. Ready for development."
        echo ""
        echo "⚠️  Address warnings when convenient:"
        echo "   • Some optional features may not be fully set up"
        echo "   • These won't block development but may limit some functionality"
    fi
    exit 0
else
    print_error "❌ $FAILED_TESTS validation test(s) failed. Please address the issues above."
    echo ""
    echo "🔧 Common fixes:"
    echo "   • Run 'firebase login' if authentication failed"
    echo "   • Run 'firebase init' if configuration files are missing"
    echo "   • Enable services in Firebase Console if they're not accessible"
    echo "   • Check internet connectivity if API calls fail"
    exit 1
fi