/**
 * Firestore Service
 * Handles all Firestore database operations for call data, user management, and analytics
 */

import { getFirestore } from 'firebase-admin/firestore';
import logger from '../utils/logger.js';

class FirestoreService {
  constructor() {
    this.db = getFirestore();
    
    // Collection references
    this.callsCollection = 'calls';
    this.usersCollection = 'users';
    this.analyticsCollection = 'analytics';
    this.settingsCollection = 'settings';
  }

  // ===============================
  // CALL MANAGEMENT
  // ===============================

  /**
   * Create a new call record
   */
  async createCall(callData) {
    try {
      const callRef = this.db.collection(this.callsCollection);
      
      const callRecord = {
        ...callData,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      const docRef = await callRef.add(callRecord);
      
      logger.info('Call record created', { 
        docId: docRef.id, 
        callSid: callData.callSid 
      });

      return {
        id: docRef.id,
        ...callRecord
      };

    } catch (error) {
      logger.error('Error creating call record', error);
      throw error;
    }
  }

  /**
   * Get call record by CallSid
   */
  async getCall(callSid) {
    try {
      const snapshot = await this.db
        .collection(this.callsCollection)
        .where('callSid', '==', callSid)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };

    } catch (error) {
      logger.error('Error getting call record', error);
      throw error;
    }
  }

  /**
   * Update call record
   */
  async updateCall(callSid, updateData) {
    try {
      const snapshot = await this.db
        .collection(this.callsCollection)
        .where('callSid', '==', callSid)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error(`Call not found: ${callSid}`);
      }

      const doc = snapshot.docs[0];
      const currentData = doc.data();
      
      const updatedData = {
        ...updateData,
        updatedAt: new Date(),
        version: (currentData.version || 1) + 1
      };

      await doc.ref.update(updatedData);

      logger.info('Call record updated', { 
        callSid, 
        updatedFields: Object.keys(updateData)
      });

      return {
        id: doc.id,
        ...currentData,
        ...updatedData
      };

    } catch (error) {
      logger.error('Error updating call record', error);
      throw error;
    }
  }

  /**
   * Update call status
   */
  async updateCallStatus(callSid, statusData) {
    try {
      return await this.updateCall(callSid, {
        status: statusData.status,
        duration: statusData.duration,
        endTime: statusData.status === 'completed' ? new Date() : null,
        ...statusData
      });
    } catch (error) {
      logger.error('Error updating call status', error);
      throw error;
    }
  }

  /**
   * Get calls for a specific user
   */
  async getUserCalls(userId, limit = 20, offset = 0) {
    try {
      let query = this.db
        .collection(this.callsCollection)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (offset > 0) {
        // For pagination, you'd typically use a cursor
        // This is a simplified approach
        query = query.offset(offset);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      logger.error('Error getting user calls', error);
      throw error;
    }
  }

  /**
   * Get recent calls
   */
  async getRecentCalls(limit = 50) {
    try {
      const snapshot = await this.db
        .collection(this.callsCollection)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      logger.error('Error getting recent calls', error);
      throw error;
    }
  }

  /**
   * Search calls by phone number or content
   */
  async searchCalls(query, limit = 20) {
    try {
      // Note: Firestore has limited text search capabilities
      // For production, consider using Algolia or Elasticsearch
      
      let firestoreQuery;
      
      // If query looks like a phone number
      if (/^\+?[\d\s-()]+$/.test(query)) {
        firestoreQuery = this.db
          .collection(this.callsCollection)
          .where('from', '==', query)
          .orderBy('createdAt', 'desc')
          .limit(limit);
      } else {
        // Basic text search in transcript
        firestoreQuery = this.db
          .collection(this.callsCollection)
          .where('transcript', '>=', query)
          .where('transcript', '<', query + '\uf8ff')
          .orderBy('transcript')
          .orderBy('createdAt', 'desc')
          .limit(limit);
      }

      const snapshot = await firestoreQuery.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      logger.error('Error searching calls', error);
      throw error;
    }
  }

  /**
   * Delete call record (soft delete)
   */
  async deleteCall(callSid, hardDelete = false) {
    try {
      const snapshot = await this.db
        .collection(this.callsCollection)
        .where('callSid', '==', callSid)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error(`Call not found: ${callSid}`);
      }

      const doc = snapshot.docs[0];

      if (hardDelete) {
        await doc.ref.delete();
        logger.info('Call record permanently deleted', { callSid });
      } else {
        await doc.ref.update({
          deleted: true,
          deletedAt: new Date(),
          updatedAt: new Date()
        });
        logger.info('Call record soft deleted', { callSid });
      }

    } catch (error) {
      logger.error('Error deleting call record', error);
      throw error;
    }
  }

  // ===============================
  // USER MANAGEMENT
  // ===============================

  /**
   * Create or update user profile
   */
  async createOrUpdateUser(userId, userData) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(userId);
      const userDoc = await userRef.get();

      const timestamp = new Date();
      
      if (userDoc.exists) {
        // Update existing user
        const updateData = {
          ...userData,
          updatedAt: timestamp,
          lastSeen: timestamp
        };
        
        await userRef.update(updateData);
        logger.info('User profile updated', { userId });
        
        return {
          id: userId,
          ...userDoc.data(),
          ...updateData
        };
      } else {
        // Create new user
        const newUserData = {
          ...userData,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastSeen: timestamp,
          callCount: 0,
          totalCallDuration: 0
        };
        
        await userRef.set(newUserData);
        logger.info('User profile created', { userId });
        
        return {
          id: userId,
          ...newUserData
        };
      }

    } catch (error) {
      logger.error('Error creating/updating user', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUser(userId) {
    try {
      const userDoc = await this.db
        .collection(this.usersCollection)
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        return null;
      }

      return {
        id: userId,
        ...userDoc.data()
      };

    } catch (error) {
      logger.error('Error getting user profile', error);
      throw error;
    }
  }

  /**
   * Update user call statistics
   */
  async updateUserStats(userId, callDuration, callSid) {
    try {
      const userRef = this.db.collection(this.usersCollection).doc(userId);
      
      // Use transaction to ensure consistency
      await this.db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          // Create user if doesn't exist
          const newUserData = {
            callCount: 1,
            totalCallDuration: callDuration || 0,
            lastCallAt: new Date(),
            lastCallSid: callSid,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          transaction.set(userRef, newUserData);
        } else {
          // Update existing user stats
          const userData = userDoc.data();
          const updateData = {
            callCount: (userData.callCount || 0) + 1,
            totalCallDuration: (userData.totalCallDuration || 0) + (callDuration || 0),
            lastCallAt: new Date(),
            lastCallSid: callSid,
            updatedAt: new Date()
          };
          transaction.update(userRef, updateData);
        }
      });

      logger.info('User stats updated', { userId, callDuration });

    } catch (error) {
      logger.error('Error updating user stats', error);
      throw error;
    }
  }

  // ===============================
  // ANALYTICS
  // ===============================

  /**
   * Record analytics event
   */
  async recordAnalyticsEvent(eventType, eventData) {
    try {
      const analyticsRef = this.db.collection(this.analyticsCollection);
      
      const eventRecord = {
        eventType,
        eventData,
        timestamp: new Date(),
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      };

      await analyticsRef.add(eventRecord);
      
      logger.debug('Analytics event recorded', { eventType });

    } catch (error) {
      logger.error('Error recording analytics event', error);
      // Don't throw error for analytics - it shouldn't break main functionality
    }
  }

  /**
   * Get call analytics for date range
   */
  async getCallAnalytics(startDate, endDate) {
    try {
      const snapshot = await this.db
        .collection(this.callsCollection)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const calls = snapshot.docs.map(doc => doc.data());
      
      // Calculate analytics
      const analytics = {
        totalCalls: calls.length,
        completedCalls: calls.filter(call => call.status === 'completed').length,
        failedCalls: calls.filter(call => call.status === 'failed').length,
        avgDuration: 0,
        totalDuration: 0,
        uniqueCallers: new Set(calls.map(call => call.from)).size
      };

      const durations = calls
        .filter(call => call.duration && call.duration > 0)
        .map(call => call.duration);

      if (durations.length > 0) {
        analytics.totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
        analytics.avgDuration = analytics.totalDuration / durations.length;
      }

      return analytics;

    } catch (error) {
      logger.error('Error getting call analytics', error);
      throw error;
    }
  }

  // ===============================
  // SETTINGS & CONFIGURATION
  // ===============================

  /**
   * Get application settings
   */
  async getSettings() {
    try {
      const settingsDoc = await this.db
        .collection(this.settingsCollection)
        .doc('app')
        .get();

      if (!settingsDoc.exists) {
        // Return default settings
        return {
          maxCallDuration: 900, // 15 minutes
          allowedCountries: ['US', 'CA'],
          aiResponseTimeout: 30,
          recordCalls: true,
          enableAnalytics: true
        };
      }

      return settingsDoc.data();

    } catch (error) {
      logger.error('Error getting settings', error);
      throw error;
    }
  }

  /**
   * Update application settings
   */
  async updateSettings(settings) {
    try {
      const settingsRef = this.db.collection(this.settingsCollection).doc('app');
      
      await settingsRef.set({
        ...settings,
        updatedAt: new Date()
      }, { merge: true });

      logger.info('Settings updated', { settingsKeys: Object.keys(settings) });

    } catch (error) {
      logger.error('Error updating settings', error);
      throw error;
    }
  }

  // ===============================
  // BATCH OPERATIONS
  // ===============================

  /**
   * Batch update multiple documents
   */
  async batchUpdate(updates) {
    try {
      const batch = this.db.batch();
      
      updates.forEach(update => {
        const { collection, docId, data } = update;
        const docRef = this.db.collection(collection).doc(docId);
        batch.update(docRef, { ...data, updatedAt: new Date() });
      });

      await batch.commit();
      
      logger.info('Batch update completed', { updateCount: updates.length });

    } catch (error) {
      logger.error('Error performing batch update', error);
      throw error;
    }
  }

  /**
   * Clean up old records (for maintenance)
   */
  async cleanupOldRecords(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Get old call records
      const oldCallsSnapshot = await this.db
        .collection(this.callsCollection)
        .where('createdAt', '<', cutoffDate)
        .where('deleted', '==', true)
        .limit(100)
        .get();

      if (oldCallsSnapshot.empty) {
        logger.info('No old records to clean up');
        return;
      }

      // Delete in batches
      const batch = this.db.batch();
      oldCallsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info('Old records cleaned up', { 
        deletedCount: oldCallsSnapshot.docs.length 
      });

    } catch (error) {
      logger.error('Error cleaning up old records', error);
      throw error;
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus() {
    try {
      const stats = {};
      
      // Count documents in each collection
      const collections = [
        this.callsCollection,
        this.usersCollection,
        this.analyticsCollection
      ];

      for (const collection of collections) {
        const snapshot = await this.db
          .collection(collection)
          .count()
          .get();
        stats[collection] = snapshot.data().count;
      }

      // Get recent activity
      const recentCallsSnapshot = await this.db
        .collection(this.callsCollection)
        .where('createdAt', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
        .count()
        .get();

      stats.recentCalls24h = recentCallsSnapshot.data().count;

      return {
        status: 'healthy',
        collections: stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error getting database health status', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default FirestoreService;