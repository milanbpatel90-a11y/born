/**
 * analytics.js
 * 
 * Event tracking and analytics for the optical try-on application
 */

export class Analytics {
  constructor() {
    this.sessionId = this._generateSessionId();
    this.events = [];
    this.startTime = Date.now();
    this.deviceInfo = this._getDeviceInfo();
    this.isEnabled = true;
    
    // Load existing events from localStorage
    this._loadEvents();
    
    // Setup periodic saving
    this._setupAutoSave();
    
    console.log('[ANALYTICS] Analytics initialized with session:', this.sessionId);
  }

  /**
   * Generate unique session ID
   */
  _generateSessionId() {
    const existing = sessionStorage.getItem('vto_analytics_session');
    if (existing) return existing;
    
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('vto_analytics_session', sessionId);
    return sessionId;
  }

  /**
   * Get device information
   */
  _getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      pixelRatio: window.devicePixelRatio || 1,
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Load existing events from localStorage
   */
  _loadEvents() {
    try {
      const stored = localStorage.getItem('vto_analytics_events');
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ANALYTICS] Failed to load events:', error);
      this.events = [];
    }
  }

  /**
   * Setup automatic saving
   */
  _setupAutoSave() {
    // Save events every 30 seconds
    setInterval(() => {
      this._saveEvents();
    }, 30000);
    
    // Save on page unload
    window.addEventListener('beforeunload', () => {
      this._saveEvents();
    });
  }

  /**
   * Track an event
   */
  trackEvent(eventName, data = {}) {
    if (!this.isEnabled) return;
    
    const event = {
      id: this._generateEventId(),
      sessionId: this.sessionId,
      eventName: eventName,
      timestamp: Date.now(),
      data: data,
      deviceInfo: this.deviceInfo,
      sessionDuration: Date.now() - this.startTime
    };
    
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
    
    console.log('[ANALYTICS] Event tracked:', eventName, data);
  }

  /**
   * Generate unique event ID
   */
  _generateEventId() {
    return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Save events to localStorage
   */
  _saveEvents() {
    try {
      localStorage.setItem('vto_analytics_events', JSON.stringify(this.events));
    } catch (error) {
      console.error('[ANALYTICS] Failed to save events:', error);
    }
  }

  /**
   * Track application initialization
   */
  trackAppInit(options = {}) {
    this.trackEvent('app_initialized', {
      loadTime: options.loadTime || 0,
      opencvLoaded: options.opencvLoaded || false,
      mediapipeLoaded: options.mediapipeLoaded || false,
      ...options
    });
  }

  /**
   * Track camera access
   */
  trackCameraAccess(success, error = null) {
    this.trackEvent('camera_access', {
      success: success,
      error: error ? error.message : null,
      timestamp: Date.now()
    });
  }

  /**
   * Track calibration process
   */
  trackCalibration(status, data = {}) {
    this.trackEvent('calibration', {
      status: status, // 'started', 'progress', 'completed', 'failed'
      ...data
    });
  }

  /**
   * Track frame selection
   */
  trackFrameSelection(frameId, frameData = {}) {
    this.trackEvent('frame_selected', {
      frameId: frameId,
      ...frameData
    });
  }

  /**
   * Track tracking quality
   */
  trackTrackingQuality(confidence, trackingState) {
    this.trackEvent('tracking_quality', {
      confidence: confidence,
      state: trackingState,
      timestamp: Date.now()
    });
  }

  /**
   * Track ear detection
   */
  trackEarDetection(detected, confidence = 0) {
    this.trackEvent('ear_detection', {
      detected: detected,
      confidence: confidence,
      timestamp: Date.now()
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metrics) {
    this.trackEvent('performance', {
      fps: metrics.fps,
      frameTime: metrics.frameTime,
      memoryUsage: metrics.memoryUsage,
      timestamp: Date.now()
    });
  }

  /**
   * Track errors
   */
  trackError(error, context = {}) {
    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: Date.now()
    });
  }

  /**
   * Track user interactions
   */
  trackInteraction(action, target, data = {}) {
    this.trackEvent('user_interaction', {
      action: action,
      target: target,
      ...data
    });
  }

  /**
   * Get analytics summary
   */
  getSummary() {
    const summary = {
      totalEvents: this.events.length,
      sessionDuration: Date.now() - this.startTime,
      sessionId: this.sessionId,
      deviceInfo: this.deviceInfo
    };
    
    // Event counts by type
    const eventCounts = {};
    this.events.forEach(event => {
      eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
    });
    summary.eventCounts = eventCounts;
    
    // Recent events (last 10)
    summary.recentEvents = this.events.slice(-10);
    
    return summary;
  }

  /**
   * Export analytics data
   */
  exportData() {
    const exportData = {
      sessionId: this.sessionId,
      deviceInfo: this.deviceInfo,
      events: this.events,
      summary: this.getSummary(),
      exportTime: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `vto_analytics_${this.sessionId}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    console.log('[ANALYTICS] Analytics data exported');
  }

  /**
   * Clear all analytics data
   */
  clearData() {
    this.events = [];
    localStorage.removeItem('vto_analytics_events');
    console.log('[ANALYTICS] Analytics data cleared');
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log('[ANALYTICS] Analytics', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Get events by type
   */
  getEventsByType(eventName) {
    return this.events.filter(event => event.eventName === eventName);
  }

  /**
   * Get events in time range
   */
  getEventsInTimeRange(startTime, endTime) {
    return this.events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Calculate session statistics
   */
  getSessionStats() {
    if (this.events.length === 0) return null;
    
    const sessionStart = this.startTime;
    const sessionEnd = Date.now();
    const duration = sessionEnd - sessionStart;
    
    // Track unique events
    const uniqueEvents = new Set(this.events.map(e => e.eventName));
    
    // Calculate average tracking confidence
    const trackingEvents = this.getEventsByType('tracking_quality');
    const avgConfidence = trackingEvents.length > 0 
      ? trackingEvents.reduce((sum, e) => sum + (e.data.confidence || 0), 0) / trackingEvents.length
      : 0;
    
    return {
      sessionId: this.sessionId,
      duration: duration,
      durationFormatted: this._formatDuration(duration),
      totalEvents: this.events.length,
      uniqueEvents: uniqueEvents.size,
      averageTrackingConfidence: avgConfidence.toFixed(3),
      startTime: new Date(sessionStart).toISOString(),
      endTime: new Date(sessionEnd).toISOString()
    };
  }

  /**
   * Format duration in human readable format
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this._saveEvents();
    console.log('[ANALYTICS] Analytics destroyed');
  }
}

// Create global analytics instance
export const analytics = new Analytics();
