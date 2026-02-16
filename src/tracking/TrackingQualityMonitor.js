/**
 * TrackingQualityMonitor.js
 * 
 * Production-grade tracking quality monitoring and recovery system.
 * 
 * Features:
 * - Real-time quality scoring
 * - Tracking loss detection and prediction
 * - Automatic recovery strategies
 * - Performance optimization
 * - Adaptive threshold adjustment
 * 
 * @version 2.0.0 - Production Ready
 */

/**
 * Quality metrics thresholds
 */
const QUALITY_THRESHOLDS = {
  excellent: 0.9,
  good: 0.75,
  acceptable: 0.5,
  poor: 0.3,
  critical: 0.15
};

/**
 * Tracking states
 */
const TRACKING_STATES = {
  INITIALIZING: 'initializing',
  TRACKING_EXCELLENT: 'tracking_excellent',
  TRACKING_GOOD: 'tracking_good',
  TRACKING_ACCEPTABLE: 'tracking_acceptable',
  TRACKING_POOR: 'tracking_poor',
  RECOVERING: 'recovering',
  LOST: 'lost',
  ERROR: 'error'
};

/**
 * Recovery strategies
 */
const RECOVERY_STRATEGIES = {
  NONE: 'none',
  REINITIALIZE: 'reinitialize',
  RESET_FILTERS: 'reset_filters',
  ADJUST_THRESHOLDS: 'adjust_thresholds',
  REDUCE_QUALITY: 'reduce_quality',
  FULL_RESET: 'full_reset'
};

/**
 * QualityMetric - Individual metric tracker
 */
class QualityMetric {
  constructor(name, options = {}) {
    this.name = name;
    this.weight = options.weight || 1;
    this.historySize = options.historySize || 30;
    this.threshold = options.threshold || 0.5;
    
    this.history = [];
    this.current = 0;
    this.average = 0;
    this.trend = 0;
  }
  
  /**
   * Update metric with new value
   * @param {number} value 
   */
  update(value) {
    this.current = value;
    this.history.push(value);
    
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
    
    // Calculate average
    this.average = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    
    // Calculate trend (linear regression slope)
    if (this.history.length >= 5) {
      const n = this.history.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = this.history.reduce((a, b) => a + b, 0);
      const sumXY = this.history.reduce((a, b, i) => a + i * b, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
      
      this.trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
  }
  
  /**
   * Check if metric is below threshold
   * @returns {boolean}
   */
  isBelowThreshold() {
    return this.current < this.threshold;
  }
  
  /**
   * Get weighted score
   * @returns {number}
   */
  getWeightedScore() {
    return this.current * this.weight;
  }
  
  /**
   * Reset metric
   */
  reset() {
    this.history = [];
    this.current = 0;
    this.average = 0;
    this.trend = 0;
  }
}

/**
 * TrackingQualityMonitor - Main quality monitoring class
 */
export class TrackingQualityMonitor {
  constructor(options = {}) {
    // Configuration
    this.config = {
      // Quality thresholds
      excellentThreshold: options.excellentThreshold || QUALITY_THRESHOLDS.excellent,
      goodThreshold: options.goodThreshold || QUALITY_THRESHOLDS.good,
      acceptableThreshold: options.acceptableThreshold || QUALITY_THRESHOLDS.acceptable,
      poorThreshold: options.poorThreshold || QUALITY_THRESHOLDS.poor,
      criticalThreshold: options.criticalThreshold || QUALITY_THRESHOLDS.critical,
      
      // Recovery settings
      recoveryEnabled: options.recoveryEnabled !== false,
      recoveryDelay: options.recoveryDelay || 500, // ms before recovery attempt
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      recoveryCooldown: options.recoveryCooldown || 2000, // ms between recovery attempts
      
      // Prediction
      predictionEnabled: options.predictionEnabled !== false,
      predictionWindow: options.predictionWindow || 10, // frames
      
      // Callbacks
      onQualityChange: options.onQualityChange || null,
      onStateChange: options.onStateChange || null,
      onRecoveryAttempt: options.onRecoveryAttempt || null,
      onTrackingLost: options.onTrackingLost || null,
      onTrackingRecovered: options.onTrackingRecovered || null
    };
    
    // Quality metrics
    this.metrics = {
      landmarkConfidence: new QualityMetric('landmarkConfidence', { weight: 0.25, threshold: 0.6 }),
      poseStability: new QualityMetric('poseStability', { weight: 0.2, threshold: 0.5 }),
      reprojectionError: new QualityMetric('reprojectionError', { weight: 0.15, threshold: 0.7, invert: true }),
      faceVisibility: new QualityMetric('faceVisibility', { weight: 0.2, threshold: 0.7 }),
      motionConsistency: new QualityMetric('motionConsistency', { weight: 0.1, threshold: 0.5 }),
      occlusionLevel: new QualityMetric('occlusionLevel', { weight: 0.1, threshold: 0.6, invert: true })
    };
    
    // State
    this.state = TRACKING_STATES.INITIALIZING;
    this.previousState = null;
    this.overallQuality = 0;
    this.qualityHistory = [];
    
    // Recovery state
    this.recoveryAttempts = 0;
    this.lastRecoveryTime = 0;
    this.recoveryInProgress = false;
    
    // Loss detection
    this.lossStartTime = null;
    this.lossDuration = 0;
    this.predictedLoss = false;
    
    // Frame tracking
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.fps = 0;
    
    // Performance tracking
    this.performanceHistory = [];
  }
  
  /**
   * Update quality metrics with new tracking data
   * @param {Object} trackingData - Tracking result data
   * @returns {Object} - Quality assessment
   */
  update(trackingData) {
    this.frameCount++;
    const now = performance.now();
    
    // Calculate FPS
    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      this.fps = 1000 / delta;
    }
    this.lastFrameTime = now;
    
    // Update individual metrics
    this._updateMetrics(trackingData);
    
    // Calculate overall quality
    this._calculateOverallQuality();
    
    // Update state
    this._updateState();
    
    // Check for predicted loss
    if (this.config.predictionEnabled) {
      this._predictLoss();
    }
    
    // Handle recovery if needed
    if (this.config.recoveryEnabled && this.state === TRACKING_STATES.LOST) {
      this._attemptRecovery();
    }
    
    // Store history
    this.qualityHistory.push(this.overallQuality);
    if (this.qualityHistory.length > 100) {
      this.qualityHistory.shift();
    }
    
    return this._getAssessment();
  }
  
  /**
   * Update individual metrics
   * @param {Object} trackingData 
   */
  _updateMetrics(trackingData) {
    if (!trackingData) {
      // No tracking data - set all metrics to 0
      for (const metric of Object.values(this.metrics)) {
        metric.update(0);
      }
      return;
    }
    
    // Landmark confidence
    if (trackingData.confidence !== undefined) {
      this.metrics.landmarkConfidence.update(trackingData.confidence);
    }
    
    // Pose stability (from pose history variance)
    if (trackingData.poseStability !== undefined) {
      this.metrics.poseStability.update(trackingData.poseStability);
    } else {
      // Estimate from tracking data
      const stability = this._estimatePoseStability(trackingData);
      this.metrics.poseStability.update(stability);
    }
    
    // Reprojection error (inverse - lower is better)
    if (trackingData.reprojectionError !== undefined) {
      const normalized = Math.max(0, 1 - trackingData.reprojectionError / 50);
      this.metrics.reprojectionError.update(normalized);
    }
    
    // Face visibility
    if (trackingData.faceVisibility !== undefined) {
      this.metrics.faceVisibility.update(trackingData.faceVisibility);
    } else {
      const visibility = this._estimateFaceVisibility(trackingData);
      this.metrics.faceVisibility.update(visibility);
    }
    
    // Motion consistency
    const motionConsistency = this._estimateMotionConsistency(trackingData);
    this.metrics.motionConsistency.update(motionConsistency);
    
    // Occlusion level (inverse - lower is better)
    if (trackingData.occlusionLevel !== undefined) {
      this.metrics.occlusionLevel.update(1 - trackingData.occlusionLevel);
    } else {
      const occlusion = this._estimateOcclusion(trackingData);
      this.metrics.occlusionLevel.update(1 - occlusion);
    }
  }
  
  /**
   * Estimate pose stability from tracking data
   * @param {Object} trackingData 
   * @returns {number}
   */
  _estimatePoseStability(trackingData) {
    // Use velocity magnitude as stability indicator
    if (trackingData.velocity) {
      const velocityMag = Math.hypot(
        trackingData.velocity.x,
        trackingData.velocity.y,
        trackingData.velocity.z
      );
      // Lower velocity = higher stability
      return Math.max(0, 1 - velocityMag / 100);
    }
    
    // Default to moderate stability
    return 0.7;
  }
  
  /**
   * Estimate face visibility from landmarks
   * @param {Object} trackingData 
   * @returns {number}
   */
  _estimateFaceVisibility(trackingData) {
    if (!trackingData.landmarks) return 0;
    
    // Check if face is too close to edge
    const landmarks = trackingData.landmarks;
    let visibleCount = 0;
    
    for (const lm of landmarks) {
      if (lm.x >= 0 && lm.x <= 1 && lm.y >= 0 && lm.y <= 1) {
        visibleCount++;
      }
    }
    
    return visibleCount / landmarks.length;
  }
  
  /**
   * Estimate motion consistency
   * @param {Object} trackingData 
   * @returns {number}
   */
  _estimateMotionConsistency(trackingData) {
    // Check if motion is consistent with previous frames
    // Sudden changes indicate tracking issues
    
    if (this.qualityHistory.length < 3) return 1;
    
    const recent = this.qualityHistory.slice(-5);
    const variance = this._calculateVariance(recent);
    
    // Lower variance = higher consistency
    return Math.max(0, 1 - variance * 5);
  }
  
  /**
   * Estimate occlusion level
   * @param {Object} trackingData 
   * @returns {number}
   */
  _estimateOcclusion(trackingData) {
    if (!trackingData.landmarks) return 1;
    
    // Check for missing or low-confidence landmarks
    let occludedCount = 0;
    
    for (const lm of trackingData.landmarks) {
      if (!lm || (lm.presence !== undefined && lm.presence < 0.5)) {
        occludedCount++;
      }
    }
    
    return occludedCount / trackingData.landmarks.length;
  }
  
  /**
   * Calculate variance of array
   * @param {Array} arr 
   * @returns {number}
   */
  _calculateVariance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  }
  
  /**
   * Calculate overall quality score
   */
  _calculateOverallQuality() {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const metric of Object.values(this.metrics)) {
      weightedSum += metric.getWeightedScore();
      totalWeight += metric.weight;
    }
    
    this.overallQuality = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Update tracking state based on quality
   */
  _updateState() {
    const previousState = this.state;
    
    if (this.overallQuality >= this.config.excellentThreshold) {
      this.state = TRACKING_STATES.TRACKING_EXCELLENT;
    } else if (this.overallQuality >= this.config.goodThreshold) {
      this.state = TRACKING_STATES.TRACKING_GOOD;
    } else if (this.overallQuality >= this.config.acceptableThreshold) {
      this.state = TRACKING_STATES.TRACKING_ACCEPTABLE;
    } else if (this.overallQuality >= this.config.poorThreshold) {
      this.state = TRACKING_STATES.TRACKING_POOR;
    } else if (this.overallQuality >= this.config.criticalThreshold) {
      this.state = TRACKING_STATES.RECOVERING;
    } else {
      this.state = TRACKING_STATES.LOST;
    }
    
    // Handle state transitions
    if (previousState !== this.state) {
      this._handleStateChange(previousState, this.state);
    }
  }
  
  /**
   * Handle state transition
   * @param {string} from 
   * @param {string} to 
   */
  _handleStateChange(from, to) {
    this.previousState = from;
    
    // Track loss start time
    if (to === TRACKING_STATES.LOST && from !== TRACKING_STATES.LOST) {
      this.lossStartTime = performance.now();
      this._triggerCallback('onTrackingLost');
    }
    
    // Track recovery
    if (from === TRACKING_STATES.LOST && to !== TRACKING_STATES.LOST) {
      this.lossStartTime = null;
      this.lossDuration = 0;
      this.recoveryAttempts = 0;
      this._triggerCallback('onTrackingRecovered');
    }
    
    // Trigger state change callback
    this._triggerCallback('onStateChange', { from, to });
    this._triggerCallback('onQualityChange', this.overallQuality);
  }
  
  /**
   * Predict tracking loss
   */
  _predictLoss() {
    // Use trend analysis to predict loss
    let decliningCount = 0;
    
    for (const metric of Object.values(this.metrics)) {
      if (metric.trend < -0.01) { // Declining trend
        decliningCount++;
      }
    }
    
    // Predict loss if multiple metrics are declining
    this.predictedLoss = decliningCount >= 3 && this.overallQuality < this.config.goodThreshold;
  }
  
  /**
   * Attempt to recover tracking
   */
  _attemptRecovery() {
    const now = performance.now();
    
    // Update loss duration
    if (this.lossStartTime) {
      this.lossDuration = now - this.lossStartTime;
    }
    
    // Check recovery conditions
    if (this.lossDuration < this.config.recoveryDelay) {
      return; // Too soon for recovery
    }
    
    if (this.recoveryInProgress) {
      return; // Recovery already in progress
    }
    
    if (this.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      return; // Max attempts reached
    }
    
    if (now - this.lastRecoveryTime < this.config.recoveryCooldown) {
      return; // Cooldown not elapsed
    }
    
    // Determine recovery strategy
    const strategy = this._determineRecoveryStrategy();
    
    if (strategy !== RECOVERY_STRATEGIES.NONE) {
      this.recoveryInProgress = true;
      this.recoveryAttempts++;
      this.lastRecoveryTime = now;
      
      this._triggerCallback('onRecoveryAttempt', {
        attempt: this.recoveryAttempts,
        strategy
      });
    }
  }
  
  /**
   * Determine best recovery strategy
   * @returns {string}
   */
  _determineRecoveryStrategy() {
    // Check which metrics are failing
    const failingMetrics = [];
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      if (metric.isBelowThreshold()) {
        failingMetrics.push(name);
      }
    }
    
    // Determine strategy based on failing metrics
    if (failingMetrics.includes('landmarkConfidence') && 
        failingMetrics.includes('faceVisibility')) {
      return RECOVERY_STRATEGIES.REDUCE_QUALITY;
    }
    
    if (failingMetrics.includes('poseStability')) {
      return RECOVERY_STRATEGIES.RESET_FILTERS;
    }
    
    if (failingMetrics.includes('reprojectionError')) {
      return RECOVERY_STRATEGIES.ADJUST_THRESHOLDS;
    }
    
    if (this.recoveryAttempts >= 2) {
      return RECOVERY_STRATEGIES.FULL_RESET;
    }
    
    return RECOVERY_STRATEGIES.REINITIALIZE;
  }
  
  /**
   * Mark recovery as complete
   * @param {boolean} success 
   */
  recoveryComplete(success) {
    this.recoveryInProgress = false;
    
    if (success) {
      this.recoveryAttempts = 0;
      this.lossStartTime = null;
      this.lossDuration = 0;
    }
  }
  
  /**
   * Get current assessment
   * @returns {Object}
   */
  _getAssessment() {
    return {
      quality: this.overallQuality,
      state: this.state,
      previousState: this.previousState,
      metrics: this._getMetricsSummary(),
      isTracking: this.state !== TRACKING_STATES.LOST && this.state !== TRACKING_STATES.ERROR,
      isRecovering: this.state === TRACKING_STATES.RECOVERING,
      isLost: this.state === TRACKING_STATES.LOST,
      predictedLoss: this.predictedLoss,
      lossDuration: this.lossDuration,
      recoveryAttempts: this.recoveryAttempts,
      recommendedStrategy: this.state === TRACKING_STATES.LOST ? 
        this._determineRecoveryStrategy() : RECOVERY_STRATEGIES.NONE,
      frameCount: this.frameCount,
      fps: this.fps
    };
  }
  
  /**
   * Get metrics summary
   * @returns {Object}
   */
  _getMetricsSummary() {
    const summary = {};
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      summary[name] = {
        current: metric.current,
        average: metric.average,
        trend: metric.trend,
        isBelowThreshold: metric.isBelowThreshold()
      };
    }
    
    return summary;
  }
  
  /**
   * Trigger callback if defined
   * @param {string} name 
   * @param {*} data 
   */
  _triggerCallback(name, data) {
    const callback = this.config[name];
    if (typeof callback === 'function') {
      try {
        callback(data);
      } catch (e) {
        console.error(`[QUALITY_MONITOR] Callback error: ${name}`, e);
      }
    }
  }
  
  /**
   * Get quality history
   * @param {number} count 
   * @returns {Array}
   */
  getQualityHistory(count = 30) {
    return this.qualityHistory.slice(-count);
  }
  
  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.state;
  }
  
  /**
   * Get overall quality
   * @returns {number}
   */
  getQuality() {
    return this.overallQuality;
  }
  
  /**
   * Check if tracking is good
   * @returns {boolean}
   */
  isTrackingGood() {
    return this.overallQuality >= this.config.goodThreshold;
  }
  
  /**
   * Check if tracking is acceptable
   * @returns {boolean}
   */
  isTrackingAcceptable() {
    return this.overallQuality >= this.config.acceptableThreshold;
  }
  
  /**
   * Get recommended action
   * @returns {string}
   */
  getRecommendedAction() {
    if (this.state === TRACKING_STATES.LOST) {
      return this._determineRecoveryStrategy();
    }
    
    if (this.predictedLoss) {
      return 'stabilize';
    }
    
    if (this.state === TRACKING_STATES.TRACKING_POOR) {
      return 'improve_conditions';
    }
    
    return 'continue';
  }
  
  /**
   * Reset monitor
   */
  reset() {
    for (const metric of Object.values(this.metrics)) {
      metric.reset();
    }
    
    this.state = TRACKING_STATES.INITIALIZING;
    this.previousState = null;
    this.overallQuality = 0;
    this.qualityHistory = [];
    this.recoveryAttempts = 0;
    this.lastRecoveryTime = 0;
    this.recoveryInProgress = false;
    this.lossStartTime = null;
    this.lossDuration = 0;
    this.predictedLoss = false;
    this.frameCount = 0;
  }
  
  /**
   * Set configuration
   * @param {Object} config 
   */
  setConfig(config) {
    Object.assign(this.config, config);
  }
}

// Export constants
export { QUALITY_THRESHOLDS, TRACKING_STATES, RECOVERY_STRATEGIES };

export default TrackingQualityMonitor;
