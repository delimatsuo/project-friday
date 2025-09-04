#!/usr/bin/env node

/**
 * Initialize Firestore Collections Script
 * 
 * This script creates the initial Firestore collections with sample documents
 * to establish the database structure for Project Friday.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-friday-471118'
});

const db = admin.firestore();

/**
 * Create sample user document
 */
async function createSampleUser() {
  const userId = 'sample_user_' + Date.now();
  const userData = {
    uid: userId,
    email: 'sample@projectfriday.dev',
    displayName: 'Sample User',
    photoURL: null,
    isScreeningActive: false,
    twilioPhoneNumber: null,
    fcmToken: null,
    preferences: {
      defaultGreeting: 'Hello, I am not available right now. May I know who is calling?',
      blockUnknownNumbers: false,
      businessHoursOnly: false,
      timezone: 'America/Los_Angeles'
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActive: null,
    subscriptionTier: 'free',
    subscriptionExpiry: null
  };

  try {
    await db.collection('users').doc(userId).set(userData);
    console.log('✅ Sample user document created:', userId);
    return userId;
  } catch (error) {
    console.error('❌ Error creating user document:', error);
    throw error;
  }
}

/**
 * Create sample call log document
 */
async function createSampleCallLog(userId) {
  const callLogData = {
    userId: userId,
    twilioCallSid: 'CA_sample_' + Date.now(),
    callerId: '+14155552671',
    callerName: 'Sample Caller',
    callerLocation: 'San Francisco, CA',
    callStartTime: admin.firestore.Timestamp.fromDate(new Date()),
    callEndTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 120000)), // 2 minutes later
    duration: 120,
    callStatus: 'completed',
    fullTranscript: 'AI: Hello, the person you are trying to reach is not available. May I know who is calling?\nCaller: Hi, this is a sample call for testing.\nAI: Thank you. I will let them know you called. Is there a message you would like to leave?\nCaller: No message, just testing the system.\nAI: Understood. Thank you for calling. Goodbye.',
    aiSummary: 'Sample caller testing the system, no message left.',
    callerIntent: 'testing',
    urgencyLevel: 'low',
    wasForwarded: false,
    userAction: null,
    actionTimestamp: null,
    audioRecordingUrl: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    const docRef = await db.collection('call_logs').add(callLogData);
    console.log('✅ Sample call log document created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating call log document:', error);
    throw error;
  }
}

/**
 * Verify collections exist
 */
async function verifyCollections() {
  try {
    // Check users collection
    const usersSnapshot = await db.collection('users').limit(1).get();
    console.log('✅ Users collection exists:', !usersSnapshot.empty);
    
    // Check call_logs collection
    const callLogsSnapshot = await db.collection('call_logs').limit(1).get();
    console.log('✅ Call logs collection exists:', !callLogsSnapshot.empty);
    
    return true;
  } catch (error) {
    console.error('❌ Error verifying collections:', error);
    return false;
  }
}

/**
 * Main initialization function
 */
async function initializeFirestore() {
  console.log('🚀 Initializing Firestore Collections for Project Friday');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Create sample user
    console.log('\n📝 Creating sample user document...');
    const userId = await createSampleUser();
    
    // Create sample call log
    console.log('\n📞 Creating sample call log document...');
    await createSampleCallLog(userId);
    
    // Verify collections
    console.log('\n✔️  Verifying collections...');
    await verifyCollections();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Firestore initialization complete!');
    console.log('\nNext steps:');
    console.log('1. View collections at: https://console.firebase.google.com/project/project-friday-471118/firestore');
    console.log('2. Update security rules in firestore.rules');
    console.log('3. Deploy rules with: firebase deploy --only firestore:rules');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeFirestore();