#!/bin/bash

# Project Friday - Setup Validation Script
# This script validates that all required components are properly configured

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

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0
VALIDATION_PASSED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}===========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((VALIDATION_PASSED++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((VALIDATION_WARNINGS++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((VALIDATION_ERRORS++))
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Load environment variables
load_env_vars() {
    local env_file="$FUNCTIONS_DIR/.env.local"
    
    if [ -f "$env_file" ]; then
        # Export variables from .env.local for validation
        set -a  # Mark variables for export
        source "$env_file"
        set +a  # Stop marking variables for export
        return 0
    else
        return 1
    fi
}

# Validate system requirements
validate_system_requirements() {
    print_header "System Requirements Validation"
    
    # Check Node.js version
    if command_exists node; then
        local node_version=$(node --version | sed 's/v//')
        local major_version=$(echo $node_version | cut -d. -f1)
        if [ "$major_version" -ge 18 ]; then
            print_success "Node.js $node_version (✓ 18+ required)"
        else
            print_error "Node.js $node_version (✗ 18+ required)"
        fi
    else
        print_error "Node.js not installed"
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=$(npm --version)
        print_success "npm $npm_version"
    else
        print_error "npm not installed"
    fi
    
    # Check Firebase CLI
    if command_exists firebase; then
        local firebase_version=$(firebase --version | head -n1)
        print_success "Firebase CLI: $firebase_version"
        
        # Check Firebase login
        if firebase projects:list >/dev/null 2>&1; then
            print_success "Firebase authentication active"
        else
            print_error "Firebase not authenticated (run 'firebase login')"
        fi
    else
        print_error "Firebase CLI not installed"
    fi
    
    # Check gcloud CLI (optional)
    if command_exists gcloud; then
        local gcloud_version=$(gcloud --version | head -n1)
        print_success "gcloud CLI: $gcloud_version"
    else
        print_warning "gcloud CLI not installed (recommended for advanced features)"
    fi
}

# Validate project structure
validate_project_structure() {
    print_header "Project Structure Validation"
    
    # Check main directories
    local required_dirs=(
        "$PROJECT_ROOT"
        "$BACKEND_DIR"
        "$FUNCTIONS_DIR"
        "$PROJECT_ROOT/docs"
        "$PROJECT_ROOT/scripts"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_success "Directory exists: $(basename "$dir")"
        else
            print_error "Directory missing: $dir"
        fi
    done
    
    # Check required files
    local required_files=(
        "$BACKEND_DIR/firebase.json"
        "$BACKEND_DIR/firestore.rules"
        "$BACKEND_DIR/firestore.indexes.json"
        "$FUNCTIONS_DIR/package.json"
        "$FUNCTIONS_DIR/index.js"
        "$FUNCTIONS_DIR/.env.example"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            print_success "File exists: $(basename "$file")"
        else
            print_error "File missing: $file"
        fi
    done
    
    # Check for .env.local
    if [ -f "$FUNCTIONS_DIR/.env.local" ]; then
        print_success "Environment file exists: .env.local"
    else
        print_error "Environment file missing: .env.local"
        print_info "Create from .env.example: cp $FUNCTIONS_DIR/.env.example $FUNCTIONS_DIR/.env.local"
    fi
}

# Validate Firebase configuration
validate_firebase_config() {
    print_header "Firebase Configuration Validation"
    
    cd "$BACKEND_DIR"
    
    # Check Firebase project
    if firebase use >/dev/null 2>&1; then
        local project_id=$(firebase use | grep -o 'Active Project:.*' | cut -d' ' -f3 || echo "Unknown")
        print_success "Firebase project set: $project_id"
        
        # Validate project access
        if firebase projects:list | grep -q "$project_id" 2>/dev/null; then
            print_success "Firebase project accessible"
        else
            print_error "Firebase project not accessible or doesn't exist"
        fi
    else
        print_error "No Firebase project configured (run 'firebase use --add')"
    fi
    
    # Check firebase.json
    if [ -f "firebase.json" ]; then
        if node -e "JSON.parse(require('fs').readFileSync('firebase.json', 'utf8'))" 2>/dev/null; then
            print_success "firebase.json is valid JSON"
            
            # Check required sections
            local sections=("functions" "firestore" "storage")
            for section in "${sections[@]}"; do
                if node -e "const config = JSON.parse(require('fs').readFileSync('firebase.json', 'utf8')); if (!config.$section) process.exit(1)" 2>/dev/null; then
                    print_success "firebase.json contains $section configuration"
                else
                    print_warning "firebase.json missing $section configuration"
                fi
            done
        else
            print_error "firebase.json contains invalid JSON"
        fi
    fi
    
    # Check Firestore rules
    if [ -f "firestore.rules" ]; then
        print_success "Firestore rules file exists"
    else
        print_error "Firestore rules file missing"
    fi
    
    # Check Storage rules
    if [ -f "storage.rules" ]; then
        print_success "Storage rules file exists"
    else
        print_warning "Storage rules file missing (optional)"
    fi
}

# Validate environment variables
validate_environment_variables() {
    print_header "Environment Variables Validation"
    
    if ! load_env_vars; then
        print_error "Could not load environment variables from .env.local"
        return 1
    fi
    
    # Required Firebase variables
    local firebase_vars=(
        "FIREBASE_PROJECT_ID"
        "FIREBASE_PRIVATE_KEY_ID"
        "FIREBASE_PRIVATE_KEY"
        "FIREBASE_CLIENT_EMAIL"
        "FIREBASE_CLIENT_ID"
        "FIREBASE_CLIENT_X509_CERT_URL"
    )
    
    for var in "${firebase_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_success "Firebase variable set: $var"
        else
            print_error "Firebase variable missing: $var"
        fi
    done
    
    # Required Google Cloud variables
    local gcp_vars=(
        "GOOGLE_CLOUD_PROJECT_ID"
        "GOOGLE_CLOUD_REGION"
    )
    
    for var in "${gcp_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_success "Google Cloud variable set: $var"
        else
            print_error "Google Cloud variable missing: $var"
        fi
    done
    
    # AI Configuration
    if [ -n "$GOOGLE_AI_API_KEY" ]; then
        print_success "Google AI API key set"
        
        # Basic format check
        if [[ $GOOGLE_AI_API_KEY =~ ^AIza[0-9A-Za-z_-]{35}$ ]]; then
            print_success "Google AI API key format appears valid"
        else
            print_warning "Google AI API key format may be invalid"
        fi
    else
        print_error "Google AI API key missing: GOOGLE_AI_API_KEY"
    fi
    
    # Twilio Configuration
    local twilio_vars=(
        "TWILIO_ACCOUNT_SID"
        "TWILIO_AUTH_TOKEN"
        "TWILIO_PHONE_NUMBER"
    )
    
    local twilio_configured=true
    for var in "${twilio_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_success "Twilio variable set: $var"
        else
            print_error "Twilio variable missing: $var"
            twilio_configured=false
        fi
    done
    
    # Validate Twilio SID format
    if [ -n "$TWILIO_ACCOUNT_SID" ] && [[ $TWILIO_ACCOUNT_SID =~ ^AC[a-f0-9]{32}$ ]]; then
        print_success "Twilio Account SID format valid"
    elif [ -n "$TWILIO_ACCOUNT_SID" ]; then
        print_warning "Twilio Account SID format may be invalid"
    fi
    
    # Validate phone number format
    if [ -n "$TWILIO_PHONE_NUMBER" ] && [[ $TWILIO_PHONE_NUMBER =~ ^\\+[1-9][0-9]{10,14}$ ]]; then
        print_success "Twilio phone number format valid"
    elif [ -n "$TWILIO_PHONE_NUMBER" ]; then
        print_warning "Twilio phone number format may be invalid (should be E.164 format: +1234567890)"
    fi
    
    # Application variables
    local app_vars=(
        "NODE_ENV"
    )
    
    for var in "${app_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_success "Application variable set: $var"
        else
            print_warning "Application variable missing: $var (using default)"
        fi
    done
}

# Validate Node.js dependencies
validate_dependencies() {
    print_header "Dependencies Validation"
    
    cd "$FUNCTIONS_DIR"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in functions directory"
        return 1
    fi
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        print_success "node_modules directory exists"
    else
        print_error "node_modules directory missing (run 'npm install')"
        return 1
    fi
    
    # Check critical dependencies
    local critical_deps=(
        "firebase-admin"
        "firebase-functions"
        "twilio"
        "@google-cloud/text-to-speech"
        "@google-cloud/speech"
        "@google/generative-ai"
    )
    
    for dep in "${critical_deps[@]}"; do
        if npm list "$dep" >/dev/null 2>&1; then
            local version=$(npm list "$dep" --depth=0 2>/dev/null | grep "$dep@" | sed 's/.*@//' | sed 's/ .*//')
            print_success "Dependency installed: $dep@$version"
        else
            print_error "Dependency missing: $dep"
        fi
    done
    
    # Check for outdated packages
    print_info "Checking for outdated packages..."
    if npm outdated --depth=0 >/dev/null 2>&1; then
        print_warning "Some packages may be outdated (run 'npm outdated' for details)"
    else
        print_success "All packages are up to date"
    fi
}

# Test Firebase services connectivity
test_firebase_connectivity() {
    print_header "Firebase Services Connectivity"
    
    cd "$BACKEND_DIR"
    
    # Test Firebase project access
    if firebase projects:list >/dev/null 2>&1; then
        print_success "Firebase project access working"
    else
        print_error "Cannot access Firebase projects"
    fi
    
    # Test Firestore rules deployment
    print_info "Testing Firestore rules validation..."
    if firebase firestore:rules --project="$(firebase use | grep -o 'Active Project:.*' | cut -d' ' -f3 2>/dev/null || echo '')" >/dev/null 2>&1; then
        print_success "Firestore rules are valid"
    else
        print_warning "Firestore rules validation failed (may not be critical)"
    fi
    
    # Test Functions syntax
    cd "$FUNCTIONS_DIR"
    print_info "Testing Functions code syntax..."
    if node -c index.js >/dev/null 2>&1; then
        print_success "Functions code syntax is valid"
    else
        print_error "Functions code contains syntax errors"
    fi
    
    # Test linting (if available)
    if npm run lint >/dev/null 2>&1; then
        print_success "Functions code passes linting"
    else
        print_warning "Functions linting failed or not configured"
    fi
}

# Test external API connectivity
test_api_connectivity() {
    print_header "External API Connectivity"
    
    # Test internet connectivity
    if ping -c 1 google.com >/dev/null 2>&1; then
        print_success "Internet connectivity working"
    else
        print_error "No internet connectivity"
        return 1
    fi
    
    # Load environment variables
    if ! load_env_vars; then
        print_warning "Cannot load environment variables for API testing"
        return 1
    fi
    
    # Test Google AI API (if configured)
    if [ -n "$GOOGLE_AI_API_KEY" ]; then
        print_info "Testing Google AI API connectivity..."
        local test_response=$(curl -s -w "%{http_code}" -o /dev/null \
            "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_AI_API_KEY" \
            -H "Content-Type: application/json" \
            --connect-timeout 10)
        
        if [ "$test_response" = "200" ]; then
            print_success "Google AI API accessible"
        else
            print_error "Google AI API not accessible (HTTP $test_response)"
        fi
    else
        print_warning "Google AI API key not configured, skipping test"
    fi
    
    # Test Twilio API (if configured)
    if [ -n "$TWILIO_ACCOUNT_SID" ] && [ -n "$TWILIO_AUTH_TOKEN" ]; then
        print_info "Testing Twilio API connectivity..."
        local auth_string=$(echo -n "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | base64)
        local test_response=$(curl -s -w "%{http_code}" -o /dev/null \
            "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json" \
            -H "Authorization: Basic $auth_string" \
            --connect-timeout 10)
        
        if [ "$test_response" = "200" ]; then
            print_success "Twilio API accessible"
        else
            print_error "Twilio API not accessible (HTTP $test_response)"
        fi
    else
        print_warning "Twilio credentials not configured, skipping test"
    fi
    
    # Test Firebase services
    print_info "Testing Firebase API connectivity..."
    local firebase_test=$(curl -s -w "%{http_code}" -o /dev/null \
        "https://firebase.googleapis.com/v1beta1/projects" \
        --connect-timeout 10)
    
    if [ "$firebase_test" = "401" ] || [ "$firebase_test" = "403" ] || [ "$firebase_test" = "200" ]; then
        print_success "Firebase API accessible"
    else
        print_warning "Firebase API may not be accessible (HTTP $firebase_test)"
    fi
}

# Run security checks
run_security_checks() {
    print_header "Security Validation"
    
    # Check for exposed secrets in git
    if [ -d "$PROJECT_ROOT/.git" ]; then
        print_info "Checking for exposed secrets in git history..."
        
        # Check if .env files are in gitignore
        if [ -f "$PROJECT_ROOT/.gitignore" ]; then
            if grep -q "\.env" "$PROJECT_ROOT/.gitignore"; then
                print_success ".env files are in .gitignore"
            else
                print_warning ".env files should be added to .gitignore"
            fi
        else
            print_warning ".gitignore file not found"
        fi
        
        # Check if any .env files are tracked
        cd "$PROJECT_ROOT"
        if git ls-files | grep -q "\.env\."; then
            print_error "Environment files are tracked by git (security risk!)"
        else
            print_success "No environment files tracked by git"
        fi
    fi
    
    # Check file permissions on sensitive files
    if [ -f "$FUNCTIONS_DIR/.env.local" ]; then
        local perms=$(stat -f "%Mp%Lp" "$FUNCTIONS_DIR/.env.local" 2>/dev/null || stat -c "%a" "$FUNCTIONS_DIR/.env.local" 2>/dev/null || echo "unknown")
        if [[ $perms == *"600"* ]] || [[ $perms == *"644"* ]]; then
            print_success ".env.local has appropriate permissions"
        else
            print_warning ".env.local permissions may be too permissive (current: $perms)"
        fi
    fi
    
    # Check for default/example values
    if load_env_vars; then
        local example_values=(
            "your-project-id"
            "your-api-key"
            "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            "+15551234567"
        )
        
        for value in "${example_values[@]}"; do
            if env | grep -q "$value" 2>/dev/null; then
                print_error "Example/default value found in environment: $value"
            fi
        done
        
        if ! env | grep -q "your-" && ! env | grep -q "xxxx" && ! env | grep -q "+1555"; then
            print_success "No example values found in environment"
        fi
    fi
}

# Generate validation report
generate_report() {
    print_header "Validation Summary"
    
    local total_checks=$((VALIDATION_PASSED + VALIDATION_WARNINGS + VALIDATION_ERRORS))
    
    echo -e "${GREEN}✓ Passed: $VALIDATION_PASSED${NC}"
    echo -e "${YELLOW}⚠ Warnings: $VALIDATION_WARNINGS${NC}"
    echo -e "${RED}✗ Errors: $VALIDATION_ERRORS${NC}"
    echo -e "${BLUE}Total Checks: $total_checks${NC}"
    echo ""
    
    # Calculate percentage
    if [ $total_checks -gt 0 ]; then
        local success_rate=$(( (VALIDATION_PASSED * 100) / total_checks ))
        echo -e "${BLUE}Success Rate: $success_rate%${NC}"
    fi
    
    echo ""
    
    if [ $VALIDATION_ERRORS -eq 0 ]; then
        if [ $VALIDATION_WARNINGS -eq 0 ]; then
            echo -e "${GREEN}🎉 All validations passed! Your setup is ready for development.${NC}"
        else
            echo -e "${YELLOW}⚠️  Setup is mostly ready, but please address the warnings above.${NC}"
        fi
        
        echo ""
        print_info "Next steps:"
        echo "1. Address any warnings if needed"
        echo "2. Start Firebase emulators: cd backend && firebase emulators:start"
        echo "3. Deploy functions: cd backend && firebase deploy --only functions"
        echo "4. Test your application end-to-end"
        
        return 0
    else
        echo -e "${RED}❌ Setup validation failed with $VALIDATION_ERRORS errors.${NC}"
        echo ""
        print_info "Please fix the errors above and run this script again."
        echo "For help, see:"
        echo "  - docs/setup/FIREBASE_SETUP_GUIDE.md"
        echo "  - docs/setup/ENVIRONMENT_VARIABLES.md"
        
        return 1
    fi
}

# Main validation function
main() {
    print_header "Project Friday - Setup Validation"
    print_info "Validating Firebase/GCP setup for Project Friday..."
    echo ""
    
    # Run all validations
    validate_system_requirements
    validate_project_structure
    validate_firebase_config
    validate_environment_variables
    validate_dependencies
    test_firebase_connectivity
    test_api_connectivity
    run_security_checks
    
    # Generate final report
    generate_report
}

# Handle script arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Project Friday Setup Validation Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quiet, -q    Run in quiet mode (errors only)"
        echo "  --verbose, -v  Run in verbose mode"
        echo ""
        echo "This script validates your Firebase/GCP setup for Project Friday."
        echo "It checks system requirements, configuration, and connectivity."
        exit 0
        ;;
    "--quiet"|"-q")
        # Redirect stdout to /dev/null but keep stderr
        exec 1>/dev/null
        ;;
    "--verbose"|"-v")
        # Enable verbose output
        set -x
        ;;
esac

# Run main function
main "$@"