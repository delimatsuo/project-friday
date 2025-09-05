/**
 * Firebase Cloud Messaging (FCM) Notification Service
 * Handles push notifications for call screening events
 * Supports both individual and batch notifications with retry logic
 */

const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.messaging = getMessaging();
    this.db = getFirestore();
    
    // Notification templates for different call events
    this.templates = {
      call_screened: {
        title: 'Call Screened from {phoneNumber}',
        android: {
          priority: 'high',
          notification: {
            channelId: 'calls',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'call_notification.wav',
              category: 'CALL_CATEGORY',
            },
          },
        },
      },
      call_urgent: {
        title: '🚨 Urgent Call from {phoneNumber}',
        android: {
          priority: 'high',
          notification: {
            channelId: 'urgent_calls',
            priority: 'max',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'urgent_notification.wav',
              category: 'URGENT_CALL_CATEGORY',
            },
          },
        },
      },
      call_completed: {
        title: 'Call Summary Available',
        android: {
          priority: 'default',
          notification: {
            channelId: 'call_summaries',
            priority: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              category: 'SUMMARY_CATEGORY',
            },
          },
        },
      },
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      backoffMultiplier: 2,
    };
  }

  /**
   * Send push notification for a call screening event
   * @param {string} userId - User ID to send notification to
   * @param {Object} callData - Call information
   * @returns {Promise<Object>} Notification result
   */
  async sendCallNotification(userId, callData) {
    try {
      logger.info('Sending call notification', { userId, callId: callData.callId });

      // Get user FCM token and settings
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error(`User not found: ${userId}`);
      }

      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;
      
      if (!fcmToken) {
        throw new Error(`No FCM token found for user: ${userId}`);
      }

      // Check user notification preferences
      const notificationSettings = userData.notificationSettings || {};
      if (notificationSettings.callNotifications === false) {
        return {
          success: false,
          skipped: true,
          reason: 'User has disabled call notifications',
        };
      }

      // Create notification payload
      const payload = this.createNotificationPayload(callData, fcmToken);

      // Send notification with retry logic
      const result = await this.sendWithRetry(payload);

      logger.info('Call notification sent successfully', {
        userId,
        callId: callData.callId,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
        userId,
        callId: callData.callId,
      };

    } catch (error) {
      logger.error('FCM send failed', {
        userId,
        callId: callData.callId,
        error: error.message,
        code: error.code,
      });

      return {
        success: false,
        error: error.message,
        code: error.code,
        userId,
        callId: callData.callId,
      };
    }
  }

  /**
   * Send notifications to multiple users in batch
   * @param {Array} notifications - Array of {userId, callData} objects
   * @returns {Promise<Object>} Batch send results
   */
  async sendBatchNotifications(notifications) {
    try {
      logger.info('Sending batch notifications', { count: notifications.length });

      // Get all user tokens in a single query
      const userIds = notifications.map(n => n.userId);
      const usersSnapshot = await this.db
        .collection('users')
        .where('__name__', 'in', userIds)
        .get();

      const userTokens = new Map();
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmToken && userData.notificationSettings?.callNotifications !== false) {
          userTokens.set(doc.id, userData.fcmToken);
        }
      });

      // Create messages for users with valid tokens
      const messages = [];
      const messageMap = new Map(); // Track which message corresponds to which user/call

      notifications.forEach((notification, index) => {
        const token = userTokens.get(notification.userId);
        if (token) {
          const payload = this.createNotificationPayload(notification.callData, token);
          messages.push(payload);
          messageMap.set(messages.length - 1, {
            userId: notification.userId,
            callId: notification.callData.callId,
            index,
          });
        }
      });

      if (messages.length === 0) {
        return {
          successCount: 0,
          failureCount: 0,
          skippedCount: notifications.length,
          results: [],
        };
      }

      // Send all messages at once
      const responses = await this.messaging.sendAll(messages);

      // Process results
      const results = [];
      let successCount = 0;
      let failureCount = 0;

      responses.forEach((response, index) => {
        const messageInfo = messageMap.get(index);
        const result = {
          ...messageInfo,
          success: response.success,
          messageId: response.messageId,
          error: response.error?.message,
        };

        if (response.success) {
          successCount++;
        } else {
          failureCount++;
          logger.error('Batch notification failed', {
            userId: messageInfo.userId,
            callId: messageInfo.callId,
            error: response.error?.message,
          });
        }

        results.push(result);
      });

      const skippedCount = notifications.length - messages.length;

      logger.info('Batch notifications completed', {
        total: notifications.length,
        successCount,
        failureCount,
        skippedCount,
      });

      return {
        successCount,
        failureCount,
        skippedCount,
        results,
      };

    } catch (error) {
      logger.error('Batch notification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Update user's FCM token
   * @param {string} userId - User ID
   * @param {string} fcmToken - New FCM token
   */
  async updateUserFCMToken(userId, fcmToken) {
    try {
      await this.db.collection('users').doc(userId).update({
        fcmToken,
        fcmTokenUpdatedAt: new Date(),
      });

      logger.info('FCM token updated', { userId });
    } catch (error) {
      logger.error('Failed to update FCM token', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Subscribe user to a topic for targeted notifications
   * @param {string} fcmToken - User's FCM token
   * @param {string} topic - Topic to subscribe to
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToTopic(fcmToken, topic) {
    try {
      const result = await this.messaging.subscribeToTopic(fcmToken, topic);
      logger.info('User subscribed to topic', { topic, result });
      return result;
    } catch (error) {
      logger.error('Topic subscription failed', { topic, error: error.message });
      throw error;
    }
  }

  /**
   * Unsubscribe user from a topic
   * @param {string} fcmToken - User's FCM token
   * @param {string} topic - Topic to unsubscribe from
   * @returns {Promise<Object>} Unsubscription result
   */
  async unsubscribeFromTopic(fcmToken, topic) {
    try {
      const result = await this.messaging.unsubscribeFromTopic(fcmToken, topic);
      logger.info('User unsubscribed from topic', { topic, result });
      return result;
    } catch (error) {
      logger.error('Topic unsubscription failed', { topic, error: error.message });
      throw error;
    }
  }

  /**
   * Create notification payload from call data
   * @param {Object} callData - Call information
   * @param {string} fcmToken - User's FCM token
   * @returns {Object} FCM message payload
   */
  createNotificationPayload(callData, fcmToken) {
    const {
      callId,
      phoneNumber,
      callerName,
      aiSummary,
      urgency,
      timestamp,
      duration,
      actionRequired,
    } = callData;

    // Determine notification type based on urgency and action required
    const isUrgent = urgency === 'high' || actionRequired;
    const templateType = isUrgent ? 'call_urgent' : 'call_screened';
    const template = this.getNotificationTemplate(templateType);

    // Prepare display name and title
    const displayName = callerName || phoneNumber || 'Unknown';
    const title = template.title.replace('{phoneNumber}', phoneNumber || 'Unknown');
    
    // Truncate summary for notification body (100 char limit)
    const body = aiSummary && aiSummary.length > 100 
      ? aiSummary.substring(0, 97) + '...'
      : aiSummary || `Call from ${displayName}`;

    return {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        callId: String(callId),
        phoneNumber: String(phoneNumber || ''),
        callerName: String(callerName || phoneNumber || ''),
        urgency: String(urgency || 'medium'),
        timestamp: timestamp ? timestamp.toISOString() : new Date().toISOString(),
        duration: String(duration || 0),
        actionRequired: String(actionRequired || false),
        type: templateType,
      },
      android: template.android,
      apns: template.apns,
    };
  }

  /**
   * Get notification template by type
   * @param {string} type - Template type
   * @returns {Object} Notification template
   */
  getNotificationTemplate(type) {
    const template = this.templates[type];
    if (!template) {
      throw new Error(`Unknown notification template: ${type}`);
    }
    return template;
  }

  /**
   * Send notification with retry logic
   * @param {Object} payload - FCM message payload
   * @returns {Promise<Object>} Send result
   */
  async sendWithRetry(payload) {
    let lastError;
    let delay = this.retryConfig.retryDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info('Retrying notification send', { attempt, delay });
          await this.sleep(delay);
          delay *= this.retryConfig.backoffMultiplier;
        }

        const result = await this.messaging.send(payload);
        return { messageId: result };

      } catch (error) {
        lastError = error;
        
        // Don't retry certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        if (attempt === this.retryConfig.maxRetries) {
          logger.error('All retry attempts failed', {
            attempts: attempt + 1,
            error: error.message,
          });
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if error should not be retried
   * @param {Error} error - FCM error
   * @returns {boolean} True if error should not be retried
   */
  isNonRetryableError(error) {
    const nonRetryableCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-package-name',
      'messaging/invalid-apns-credentials',
    ];

    return nonRetryableCodes.includes(error.code);
  }

  /**
   * Clean up invalid FCM tokens from user records
   * @param {Array<string>} invalidTokens - Array of invalid tokens
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupInvalidTokens(invalidTokens) {
    try {
      logger.info('Cleaning up invalid FCM tokens', { count: invalidTokens.length });

      const usersSnapshot = await this.db
        .collection('users')
        .where('fcmToken', 'in', invalidTokens)
        .get();

      const batch = this.db.batch();
      let cleanedCount = 0;

      usersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          fcmToken: null,
          fcmTokenUpdatedAt: new Date(),
          fcmTokenStatus: 'invalid',
        });
        cleanedCount++;
      });

      if (cleanedCount > 0) {
        await batch.commit();
      }

      logger.info('Cleaned up invalid FCM tokens', { count: cleanedCount });

      return { cleaned: cleanedCount };

    } catch (error) {
      logger.error('Failed to cleanup invalid tokens', { error: error.message });
      throw error;
    }
  }

  /**
   * Send test notification to verify FCM setup
   * @param {string} fcmToken - Token to test
   * @returns {Promise<Object>} Test result
   */
  async sendTestNotification(fcmToken) {
    try {
      const testPayload = {
        token: fcmToken,
        notification: {
          title: 'ProjectFriday Test',
          body: 'FCM notifications are working correctly!',
        },
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'test',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      const result = await this.messaging.send(testPayload);
      
      logger.info('Test notification sent successfully', { messageId: result });
      
      return {
        success: true,
        messageId: result,
      };

    } catch (error) {
      logger.error('Test notification failed', { error: error.message });
      
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  /**
   * Get notification statistics for monitoring
   * @param {Date} startDate - Start date for stats
   * @param {Date} endDate - End date for stats
   * @returns {Promise<Object>} Statistics
   */
  async getNotificationStats(startDate, endDate) {
    try {
      // This would require storing notification logs in Firestore
      // For now, return basic structure
      return {
        period: { startDate, endDate },
        totalSent: 0,
        successCount: 0,
        failureCount: 0,
        topFailureReasons: [],
        averageDeliveryTime: 0,
      };
    } catch (error) {
      logger.error('Failed to get notification stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NotificationService;