# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project Friday** - An iOS application that uses AI (Gemini 2.5 Flash) to intelligently screen phone calls, acting as a personal assistant to filter interruptions while ensuring important calls are never missed.

## Development Workflow

### Required Workflow for Every Task

1. **Use Task Master MCP** for all task management
2. **Follow TDD methodology** - Write tests before implementation
3. **Run tests** - Execute unit and integration tests
4. **Update documentation** including handover document
5. **Commit and push** to remote repository
6. **Update handover** at `/Users/delimatsuo/Documents/Coding/ProjectFriday/docs/HANDOVER.md`
7. **Proceed autonomously** to next task without asking permission

### Task Master Commands

```bash
# Daily workflow
task-master list                                   # Show all tasks
task-master next                                   # Get next task
task-master show <id>                             # View task details
task-master set-status --id=<id> --status=done   # Complete task

# Task management
task-master update-subtask --id=<id> --prompt="implementation notes"
task-master expand --id=<id> --research          # Break into subtasks
task-master add-dependency --id=<id> --depends-on=<id>

# Initial setup (if needed)
task-master parse-prd .taskmaster/docs/prd.txt   # Parse PRD
task-master analyze-complexity --research        # Analyze complexity
```

### MCP Tools Available

```javascript
// Task Master MCP tools
get_tasks()           // List all tasks
next_task()          // Get next available task  
get_task()           // Show specific task
set_task_status()    // Update task status
update_subtask()     // Add implementation notes
expand_task()        // Break down into subtasks
```

## Project Architecture

### Tech Stack (V1.0)
- **Frontend**: iOS app (Swift/SwiftUI)
- **Backend**: Google Cloud Functions (serverless)
- **AI**: Gemini 2.5 Flash for conversational screening
- **Database**: Firestore
- **Authentication**: Firebase Auth
- **Call Handling**: Twilio for telephony
- **Push Notifications**: Firebase Cloud Messaging

### Core Components

1. **User Onboarding (Epic 1)**
   - Firebase Authentication integration
   - Permissions walkthrough (Push, Contacts)
   - Call forwarding setup with carrier codes

2. **Call Screening Engine (Epic 2)**
   - Twilio webhook → Cloud Function trigger
   - Real-time Gemini AI conversation management
   - Call transcription and summarization
   - Firestore persistence and FCM notifications

3. **iOS Application (Epic 3)**
   - Call log inbox with AI summaries
   - Detailed transcript views
   - Home screen widget for quick toggle
   - Action buttons (callback, contacts, block)

### Performance Requirements
- AI response latency < 1.5 seconds
- Push notification delivery < 5 seconds after call
- Call screening success rate > 98%

## File Organization

```
ProjectFriday/
├── .taskmaster/          # Task Master configuration
│   ├── tasks/           # Task files and tasks.json
│   ├── docs/           # PRD and documentation
│   └── config.json     # AI model configuration
├── docs/               # Project documentation
│   └── HANDOVER.md    # Session handover document
├── ios/               # iOS application code (when created)
├── backend/           # Cloud Functions (when created)
└── tests/            # Test suites (when created)
```

## Testing Strategy

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and service interactions
- **End-to-End Tests**: Test complete user flows
- **Performance Tests**: Validate latency requirements

## Git Workflow

```bash
# Standard commit format
git commit -m "feat: implement <feature> (task <id>)"
git commit -m "fix: resolve <issue> (task <id>)"
git commit -m "test: add tests for <component> (task <id>)"
git commit -m "docs: update <documentation> (task <id>)"

# After completing each task
git add .
git commit -m "<type>: <description> (task <id>)"
git push origin main
```

## Environment Configuration

Required API keys in `.env`:
- `ANTHROPIC_API_KEY` - For Task Master AI operations
- `PERPLEXITY_API_KEY` - For research features (optional but recommended)
- `GOOGLE_API_KEY` - For Gemini models
- Additional keys as needed for Twilio, Firebase, etc.

## Important Reminders

- **Never** manually edit `.taskmaster/tasks/tasks.json`
- **Always** update handover document after task completion
- **Always** run tests before marking tasks complete
- **Never** commit sensitive keys or credentials
- **Always** use Task Master for task tracking, not manual todos