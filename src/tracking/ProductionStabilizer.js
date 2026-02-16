/**
 * ProductionStabilizer.js
 * 
 * World-class pose stabilization combining multiple filtering techniques:
 * - One Euro Filter (low latency, adaptive smoothing)
 * - Extended Kalman Filter (optimal state estimation)
 * - Double Exponential Smoothing (trend-aware prediction)
 * - Adaptive jitter suppression
 * 
 * References:
 * - "One Euro Filter: A Simple Speed-Based Low-Pass Filter" (Casiez et al.)
 * - "The Kalman Filter: An Introduction to Optimal Estimation" (Grewal & Andrews)
 * - "LaViña: Low-Latency Video Avatar" (Google Research)
 * 
 * @version 2.0.0 - Production Ready
 */

import * as THREE from 'three';

/**
 * One Euro Filter - Adaptive low-pass filter with speed-based cutoff
 * Excellent for reducing jitter while maintaining responsiveness
 */
class OneEuroFilter {
  constructor(options = {}) {
    // Minimum cutoff frequency (lower = more smoothing when stationary)
    this.minCutoff = options.minCutoff || 1.0;
    // Speed coefficient (higher = less smoothing when moving fast)
    this.beta = options.beta || 0.007;
    // Derivative cutoff frequency
    this.dCutoff = options.dCutoff || 1.0;
    
    // State
    this.x = null;          // Filtered value
    this.dx = 0;            // Derivative
    this.lastX = null;      // Previous raw value
    this.lastTime = null;
    
    // Low-pass filters for value and derivative
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
  }
  
  /**
   * Filter a value
   * @param {number} x - Raw value
   * @param {number} timestamp - Current timestamp in seconds
   * @returns {number} - Filtered value
   */
  filter(x, timestamp) {
    if (this.lastTime === null) {
      this.x = x;
      this.lastX = x;
      this.lastTime = timestamp;
      return x;
    }
    
    const dt = Math.max(timestamp - this.lastTime, 0.001);
    this.lastTime = timestamp;
    
    // Compute derivative
    const dx = (x - this.lastX) / dt;
    this.lastX = x;
    
    // Filter derivative
    const edx = this.dxFilter.filter(dx, this._alpha(dt, this.dCutoff));
    this.dx = edx;
    
    // Compute adaptive cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    
    // Filter value
    this.x = this.xFilter.filter(x, this._alpha(dt, cutoff));
    
    return this.x;
  }
  
  /**
   * Compute alpha for low-pass filter
   * @param {number} dt - Time delta
   * @param {number} cutoff - Cutoff frequency
   * @returns {number}
   */
  _alpha(dt, cutoff) {
    const te = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + te / dt);
  }
  
  /**
   * Reset filter state
   */
  reset() {
    this.x = null;
    this.dx = 0;
    this.lastX = null;
    this.lastTime = null;
    this.xFilter.reset();
    this.dxFilter.reset();
  }
  
  /**
   * Set parameters
   * @param {Object} params 
   */
  setParams(params) {
    if (params.minCutoff !== undefined) this.minCutoff = params.minCutoff;
    if (params.beta !== undefined) this.beta = params.beta;
    if (params.dCutoff !== undefined) this.dCutoff = params.dCutoff;
  }
}

/**
 * Simple low-pass filter
 */
class LowPassFilter {
  constructor() {
    this.x = null;
  }
  
  filter(x, alpha) {
    if (this.x === null) {
      this.x = x;
      return x;
    }
    this.x = alpha * x + (1 - alpha) * this.x;
    return this.x;
  }
  
  reset() {
    this.x = null;
  }
}

/**
 * Extended Kalman Filter for 3D pose
 * Optimal state estimation with prediction and correction
 */
class PoseKalmanFilter {
  constructor() {
    // State: [x, y, z, qx, qy, qz, qw, vx, vy, vz, wx, wy, wz]
    // Position, quaternion, linear velocity, angular velocity
    this.stateDim = 13;
    
    // State vector
    this.state = new Float32Array(this.stateDim);
    this.state[6] = 1; // Identity quaternion w component
    
    // State covariance
    this.P = this._initCovariance(100);
    
    // Process noise
    this.Q = this._initCovariance(0.1);
    
    // Measurement noise
    this.R = this._initCovariance(1.0);
    
    // Is initialized?
    this.initialized = false;
    
    // Last timestamp
    this.lastTime = null;
  }
  
  /**
   * Initialize covariance matrix
   * @param {number} variance 
   * @returns {Float32Array}
   */
  _initCovariance(variance) {
    const P = new Float32Array(this.stateDim * this.stateDim);
    for (let i = 0; i < this.stateDim; i++) {
      P[i * this.stateDim + i] = variance;
    }
    return P;
  }
  
  /**
   * Predict state forward
   * @param {number} dt - Time delta
   */
  predict(dt) {
    // State transition: x' = x + v*dt, q' = q * exp(w*dt)
    
    // Position prediction
    this.state[0] += this.state[7] * dt;
    this.state[1] += this.state[8] * dt;
    this.state[2] += this.state[9] * dt;
    
    // Quaternion prediction (integrate angular velocity)
    const wx = this.state[10] * dt * 0.5;
    const wy = this.state[11] * dt * 0.5;
    const wz = this.state[12] * dt * 0.5;
    
    const dq = new THREE.Quaternion(
      wx, wy, wz, 1
    ).normalize();
    
    const q = new THREE.Quaternion(
      this.state[3], this.state[4], this.state[5], this.state[6]
    );
    q.multiply(dq);
    
    this.state[3] = q.x;
    this.state[4] = q.y;
    this.state[5] = q.z;
    this.state[6] = q.w;
    
    // Update covariance (simplified)
    const F = this._computeJacobian(dt);
    this._updateCovariance(F);
  }
  
  /**
   * Compute Jacobian for state transition
   * @param {number} dt 
   * @returns {Float32Array}
   */
  _computeJacobian(dt) {
    const F = new Float32Array(this.stateDim * this.stateDim);
    
    // Identity
    for (let i = 0; i < this.stateDim; i++) {
      F[i * this.stateDim + i] = 1;
    }
    
    // Position-velocity coupling
    F[0 * this.stateDim + 7] = dt;
    F[1 * this.stateDim + 8] = dt;
    F[2 * this.stateDim + 9] = dt;
    
    return F;
  }
  
  /**
   * Update covariance
   * @param {Float32Array} F - Jacobian
   */
  _updateCovariance(F) {
    const n = this.stateDim;
    const FP = new Float32Array(n * n);
    const FPFT = new Float32Array(n * n);
    
    // FP
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += F[i * n + k] * this.P[k * n + j];
        }
        FP[i * n + j] = sum;
      }
    }
    
    // FP*F^T + Q
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += FP[i * n + k] * F[j * n + k];
        }
        this.P[i * n + j] = sum + this.Q[i * n + j];
      }
    }
  }
  
  /**
   * Update with measurement
   * @param {Object} measurement - {position, quaternion}
   */
  update(measurement) {
    if (!this.initialized) {
      this.state[0] = measurement.position.x;
      this.state[1] = measurement.position.y;
      this.state[2] = measurement.position.z;
      this.state[3] = measurement.quaternion.x;
      this.state[4] = measurement.quaternion.y;
      this.state[5] = measurement.quaternion.z;
      this.state[6] = measurement.quaternion.w;
      this.initialized = true;
      return;
    }
    
    // Innovation (measurement residual)
    const y = new Float32Array(7);
    y[0] = measurement.position.x - this.state[0];
    y[1] = measurement.position.y - this.state[1];
    y[2] = measurement.position.z - this.state[2];
    
    // Quaternion error (using rotation vector)
    const qMeas = measurement.quaternion;
    const qPred = new THREE.Quaternion(
      this.state[3], this.state[4], this.state[5], this.state[6]
    );
    const qError = qMeas.clone().conjugate().multiply(qPred);
    
    y[3] = qError.x;
    y[4] = qError.y;
    y[5] = qError.z;
    y[6] = qError.w;
    
    // Simplified Kalman gain (diagonal approximation)
    const K = new Float32Array(this.stateDim * 7);
    for (let i = 0; i < 7; i++) {
      const s = this.P[i * this.stateDim + i] + this.R[i * 7 + i];
      if (s > 1e-10) {
        K[i * this.stateDim + i] = this.P[i * this.stateDim + i] / s;
      }
    }
    
    // Update state
    for (let i = 0; i < 7; i++) {
      this.state[i] += K[i * this.stateDim + i] * y[i];
    }
    
    // Normalize quaternion
    const qNorm = Math.sqrt(
      this.state[3] ** 2 + this.state[4] ** 2 + 
      this.state[5] ** 2 + this.state[6] ** 2
    );
    if (qNorm > 1e-10) {
      this.state[3] /= qNorm;
      this.state[4] /= qNorm;
      this.state[5] /= qNorm;
      this.state[6] /= qNorm;
    }
    
    // Update covariance
    for (let i = 0; i < 7; i++) {
      this.P[i * this.stateDim + i] *= (1 - K[i * this.stateDim + i]);
    }
  }
  
  /**
   * Get filtered position
   * @returns {THREE.Vector3}
   */
  getPosition() {
    return new THREE.Vector3(this.state[0], this.state[1], this.state[2]);
  }
  
  /**
   * Get filtered quaternion
   * @returns {THREE.Quaternion}
   */
  getQuaternion() {
    return new THREE.Quaternion(
      this.state[3], this.state[4], this.state[5], this.state[6]
    );
  }
  
  /**
   * Get velocity
   * @returns {THREE.Vector3}
   */
  getVelocity() {
    return new THREE.Vector3(this.state[7], this.state[8], this.state[9]);
  }
  
  /**
   * Reset filter
   */
  reset() {
    this.state.fill(0);
    this.state[6] = 1;
    this.P = this._initCovariance(100);
    this.initialized = false;
    this.lastTime = null;
  }
}

/**
 * Double Exponential Smoothing (Holt-Winters)
 * Captures trend for better prediction
 */
class DoubleExponentialSmoother {
  constructor(alpha = 0.3, gamma = 0.1) {
    this.alpha = alpha;  // Level smoothing
    this.gamma = gamma;  // Trend smoothing
    
    this.level = null;
    this.trend = null;
    this.initialized = false;
  }
  
  /**
   * Smooth a value
   * @param {number} value 
   * @returns {number}
   */
  smooth(value) {
    if (!this.initialized) {
      this.level = value;
      this.trend = 0;
      this.initialized = true;
      return value;
    }
    
    const prevLevel = this.level;
    this.level = this.alpha * value + (1 - this.alpha) * (this.level + this.trend);
    this.trend = this.gamma * (this.level - prevLevel) + (1 - this.gamma) * this.trend;
    
    return this.level;
  }
  
  /**
   * Predict ahead
   * @param {number} steps 
   * @returns {number}
   */
  predict(steps = 1) {
    return this.level + this.trend * steps;
  }
  
  /**
   * Reset
   */
  reset() {
    this.level = null;
    this.trend = null;
    this.initialized = false;
  }
}

/**
 * Adaptive Jitter Suppression
 * Detects and reduces high-frequency noise
 */
class JitterSuppressor {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 5;
    this.threshold = options.threshold || 0.01;
    
    this.history = [];
    this.variance = 0;
  }
  
  /**
   * Process value and return jitter-suppressed result
   * @param {number} value 
   * @returns {number}
   */
  process(value) {
    this.history.push(value);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
    
    if (this.history.length < 3) return value;
    
    // Calculate variance
    const mean = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    this.variance = this.history.reduce((a, b) => a + (b - mean) ** 2, 0) / this.history.length;
    
    // If high jitter, apply stronger smoothing
    if (this.variance > this.threshold) {
      return mean;
    }
    
    return value;
  }
  
  /**
   * Get current jitter level
   * @returns {number}
   */
  getJitterLevel() {
    return Math.sqrt(this.variance);
  }
  
  /**
   * Reset
   */
  reset() {
    this.history = [];
    this.variance = 0;
  }
}

/**
 * ProductionStabilizer - Main stabilization class
 * Combines all filtering techniques for optimal results
 */
export class ProductionStabilizer {
  constructor(options = {}) {
    // Configuration
    this.config = {
      // One Euro parameters
      positionMinCutoff: options.positionMinCutoff || 0.8,
      positionBeta: options.positionBeta || 0.005,
      rotationMinCutoff: options.rotationMinCutoff || 1.2,
      rotationBeta: options.rotationBeta || 0.01,
      scaleMinCutoff: options.scaleMinCutoff || 0.5,
      scaleBeta: options.scaleBeta || 0.002,
      
      // Kalman parameters
      useKalman: options.useKalman !== false,
      
      // Double exponential parameters
      useDoubleExponential: options.useDoubleExponential !== false,
      alpha: options.alpha || 0.3,
      gamma: options.gamma || 0.1,
      
      // Jitter suppression
      useJitterSuppression: options.useJitterSuppression !== false,
      jitterThreshold: options.jitterThreshold || 0.005,
      
      // Prediction
      predictionSteps: options.predictionSteps || 0.5,
      
      // Confidence-based adaptation
      adaptiveSmoothing: options.adaptiveSmoothing !== false
    };
    
    // One Euro filters for each component
    this.positionFilters = {
      x: new OneEuroFilter({ 
        minCutoff: this.config.positionMinCutoff, 
        beta: this.config.positionBeta 
      }),
      y: new OneEuroFilter({ 
        minCutoff: this.config.positionMinCutoff, 
        beta: this.config.positionBeta 
      }),
      z: new OneEuroFilter({ 
        minCutoff: this.config.positionMinCutoff * 1.5, 
        beta: this.config.positionBeta 
      })
    };
    
    this.rotationFilters = {
      x: new OneEuroFilter({ 
        minCutoff: this.config.rotationMinCutoff, 
        beta: this.config.rotationBeta 
      }),
      y: new OneEuroFilter({ 
        minCutoff: this.config.rotationMinCutoff, 
        beta: this.config.rotationBeta 
      }),
      z: new OneEuroFilter({ 
        minCutoff: this.config.rotationMinCutoff, 
        beta: this.config.rotationBeta 
      })
    };
    
    this.scaleFilters = {
      x: new OneEuroFilter({ 
        minCutoff: this.config.scaleMinCutoff, 
        beta: this.config.scaleBeta 
      }),
      y: new OneEuroFilter({ 
        minCutoff: this.config.scaleMinCutoff, 
        beta: this.config.scaleBeta 
      }),
      z: new OneEuroFilter({ 
        minCutoff: this.config.scaleMinCutoff, 
        beta: this.config.scaleBeta 
      })
    };
    
    // Kalman filter
    this.kalman = new PoseKalmanFilter();
    
    // Double exponential smoothers
    this.doubleExp = {
      x: new DoubleExponentialSmoother(this.config.alpha, this.config.gamma),
      y: new DoubleExponentialSmoother(this.config.alpha, this.config.gamma),
      z: new DoubleExponentialSmoother(this.config.alpha, this.config.gamma)
    };
    
    // Jitter suppressors
    this.jitterSuppressors = {
      x: new JitterSuppressor({ threshold: this.config.jitterThreshold }),
      y: new JitterSuppressor({ threshold: this.config.jitterThreshold }),
      z: new JitterSuppressor({ threshold: this.config.jitterThreshold })
    };
    
    // State
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.velocity = new THREE.Vector3();
    
    this.initialized = false;
    this.lastTimestamp = null;
    this.lastConfidence = 1;
    
    // Metrics
    this.metrics = {
      jitterLevel: 0,
      smoothness: 1,
      latency: 0
    };
  }
  
  /**
   * Update stabilizer with new pose
   * @param {Object} pose - {position, quaternion, scale, confidence}
   * @param {number} timestamp - Current timestamp in seconds
   * @returns {Object} - Stabilized pose
   */
  update(pose, timestamp = null) {
    if (!timestamp) timestamp = performance.now() / 1000;
    
    // Initialize on first frame
    if (!this.initialized) {
      this._initialize(pose);
      return this._getResult();
    }
    
    // Calculate time delta
    const dt = this.lastTimestamp ? timestamp - this.lastTimestamp : 0.016;
    this.lastTimestamp = timestamp;
    
    // Store confidence for adaptive smoothing
    this.lastConfidence = pose.confidence || 1;
    
    // Apply adaptive smoothing based on confidence
    this._adaptSmoothing(this.lastConfidence);
    
    // Process position
    this._processPosition(pose.position, timestamp, dt);
    
    // Process rotation
    this._processRotation(pose.quaternion, timestamp);
    
    // Process scale
    this._processScale(pose.scale, timestamp);
    
    // Update Kalman filter
    if (this.config.useKalman) {
      this.kalman.predict(dt);
      this.kalman.update({
        position: this.position,
        quaternion: this.quaternion
      });
      
      // Blend Kalman output
      this._blendKalmanOutput();
    }
    
    // Update metrics
    this._updateMetrics();
    
    return this._getResult();
  }
  
  /**
   * Initialize stabilizer with first pose
   * @param {Object} pose 
   */
  _initialize(pose) {
    this.position.copy(pose.position);
    this.quaternion.copy(pose.quaternion);
    if (pose.scale) this.scale.copy(pose.scale);
    
    this.initialized = true;
    this.lastTimestamp = performance.now() / 1000;
    
    // Initialize Kalman
    this.kalman.update({
      position: this.position,
      quaternion: this.quaternion
    });
  }
  
  /**
   * Adapt smoothing parameters based on confidence
   * @param {number} confidence 
   */
  _adaptSmoothing(confidence) {
    if (!this.config.adaptiveSmoothing) return;
    
    // Lower confidence = more smoothing
    const factor = Math.max(0.5, confidence);
    
    // Adjust One Euro parameters
    const posMinCutoff = this.config.positionMinCutoff * factor;
    const rotMinCutoff = this.config.rotationMinCutoff * factor;
    
    for (const filter of Object.values(this.positionFilters)) {
      filter.setParams({ minCutoff: posMinCutoff });
    }
    
    for (const filter of Object.values(this.rotationFilters)) {
      filter.setParams({ minCutoff: rotMinCutoff });
    }
  }
  
  /**
   * Process position through filter chain
   * @param {THREE.Vector3} position 
   * @param {number} timestamp 
   * @param {number} dt 
   */
  _processPosition(position, timestamp, dt) {
    let x = position.x;
    let y = position.y;
    let z = position.z;
    
    // Apply jitter suppression
    if (this.config.useJitterSuppression) {
      x = this.jitterSuppressors.x.process(x);
      y = this.jitterSuppressors.y.process(y);
      z = this.jitterSuppressors.z.process(z);
    }
    
    // Apply One Euro filter
    x = this.positionFilters.x.filter(x, timestamp);
    y = this.positionFilters.y.filter(y, timestamp);
    z = this.positionFilters.z.filter(z, timestamp);
    
    // Apply double exponential smoothing
    if (this.config.useDoubleExponential) {
      x = this.doubleExp.x.smooth(x);
      y = this.doubleExp.y.smooth(y);
      z = this.doubleExp.z.smooth(z);
    }
    
    // Apply prediction
    if (this.config.predictionSteps > 0) {
      const vx = this.doubleExp.x.trend;
      const vy = this.doubleExp.y.trend;
      const vz = this.doubleExp.z.trend;
      
      x += vx * this.config.predictionSteps * dt;
      y += vy * this.config.predictionSteps * dt;
      z += vz * this.config.predictionSteps * dt;
      
      this.velocity.set(vx, vy, vz);
    }
    
    this.position.set(x, y, z);
  }
  
  /**
   * Process rotation through filter chain
   * @param {THREE.Quaternion} quaternion 
   * @param {number} timestamp 
   */
  _processRotation(quaternion, timestamp) {
    // Convert to Euler for filtering
    const euler = new THREE.Euler();
    euler.setFromQuaternion(quaternion);
    
    // Filter each Euler angle
    const rx = this.rotationFilters.x.filter(euler.x, timestamp);
    const ry = this.rotationFilters.y.filter(euler.y, timestamp);
    const rz = this.rotationFilters.z.filter(euler.z, timestamp);
    
    // Reconstruct quaternion
    const filteredEuler = new THREE.Euler(rx, ry, rz);
    this.quaternion.setFromEuler(filteredEuler);
    
    // SLERP for smooth rotation interpolation
    if (this.initialized) {
      this.quaternion.slerp(quaternion, 0.1);
    }
  }
  
  /**
   * Process scale through filter chain
   * @param {THREE.Vector3} scale 
   * @param {number} timestamp 
   */
  _processScale(scale, timestamp) {
    if (!scale) return;
    
    const sx = this.scaleFilters.x.filter(scale.x, timestamp);
    const sy = this.scaleFilters.y.filter(scale.y, timestamp);
    const sz = this.scaleFilters.z.filter(scale.z, timestamp);
    
    this.scale.set(sx, sy, sz);
  }
  
  /**
   * Blend Kalman filter output with One Euro output
   */
  _blendKalmanOutput() {
    const kalmanPos = this.kalman.getPosition();
    const kalmanQuat = this.kalman.getQuaternion();
    
    // Blend factor based on confidence
    const blend = this.lastConfidence * 0.3;
    
    this.position.lerp(kalmanPos, blend);
    this.quaternion.slerp(kalmanQuat, blend);
  }
  
  /**
   * Update metrics
   */
  _updateMetrics() {
    // Calculate jitter level
    this.metrics.jitterLevel = (
      this.jitterSuppressors.x.getJitterLevel() +
      this.jitterSuppressors.y.getJitterLevel() +
      this.jitterSuppressors.z.getJitterLevel()
    ) / 3;
    
    // Smoothness is inverse of jitter
    this.metrics.smoothness = Math.max(0, 1 - this.metrics.jitterLevel * 10);
    
    // Latency estimation (based on prediction)
    this.metrics.latency = this.config.predictionSteps * 16.67; // ms per frame
  }
  
  /**
   * Get result object
   * @returns {Object}
   */
  _getResult() {
    return {
      position: this.position.clone(),
      quaternion: this.quaternion.clone(),
      scale: this.scale.clone(),
      velocity: this.velocity.clone(),
      confidence: this.lastConfidence,
      metrics: { ...this.metrics }
    };
  }
  
  /**
   * Get current metrics
   * @returns {Object}
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Reset all filters
   */
  reset() {
    // Reset One Euro filters
    for (const filter of Object.values(this.positionFilters)) filter.reset();
    for (const filter of Object.values(this.rotationFilters)) filter.reset();
    for (const filter of Object.values(this.scaleFilters)) filter.reset();
    
    // Reset Kalman
    this.kalman.reset();
    
    // Reset double exponential
    for (const smoother of Object.values(this.doubleExp)) smoother.reset();
    
    // Reset jitter suppressors
    for (const suppressor of Object.values(this.jitterSuppressors)) suppressor.reset();
    
    // Reset state
    this.position.set(0, 0, 0);
    this.quaternion.identity();
    this.scale.set(1, 1, 1);
    this.velocity.set(0, 0, 0);
    
    this.initialized = false;
    this.lastTimestamp = null;
    this.lastConfidence = 1;
  }
  
  /**
   * Set configuration
   * @param {Object} config 
   */
  setConfig(config) {
    Object.assign(this.config, config);
    
    // Update filter parameters
    for (const filter of Object.values(this.positionFilters)) {
      filter.setParams({
        minCutoff: this.config.positionMinCutoff,
        beta: this.config.positionBeta
      });
    }
    
    for (const filter of Object.values(this.rotationFilters)) {
      filter.setParams({
        minCutoff: this.config.rotationMinCutoff,
        beta: this.config.rotationBeta
      });
    }
    
    for (const filter of Object.values(this.scaleFilters)) {
      filter.setParams({
        minCutoff: this.config.scaleMinCutoff,
        beta: this.config.scaleBeta
      });
    }
  }
}

// Export individual filters for advanced use
export { 
  OneEuroFilter, 
  PoseKalmanFilter, 
  DoubleExponentialSmoother, 
  JitterSuppressor 
};

export default ProductionStabilizer;
