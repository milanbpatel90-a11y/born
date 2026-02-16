/**
 * PoseFilter.js
 * 
 * Kalman and EMA filters for smooth pose tracking
 */

// ======================
// KALMAN FILTER
// ======================

export class PoseKalmanFilter {
  constructor() {
    this.stateDim = 6; // rx, ry, rz, tx, ty, tz
    this.measurementDim = 6;
    this.controlDim = 0;
    
    this.kalman = null;
    this.measurement = null;
    this.initialized = false;
    
    this._initializeKalman();
  }

  _initializeKalman() {
    if (!window.opencvReady || typeof cv === 'undefined') {
      console.warn('[FILTER] OpenCV not ready for Kalman filter');
      return;
    }
    
    try {
      this.kalman = new cv.KalmanFilter(this.stateDim, this.measurementDim, this.controlDim, cv.CV_64F);
      
      // Initialize state transition matrix (constant velocity model)
      const dt = 0.033; // ~30fps
      const F = new cv.Mat(this.stateDim, this.stateDim, cv.CV_64F);
      for (let i = 0; i < 6; i++) {
        F.data64F[i * this.stateDim + i] = 1;
        if (i < 3) {
          F.data64F[i * this.stateDim + i + 6] = dt;
        }
      }
      this.kalman.transitionMatrix = F;
      F.delete();
      
      // Initialize measurement matrix
      const H = new cv.Mat(this.measurementDim, this.stateDim, cv.CV_64F);
      for (let i = 0; i < 6; i++) {
        H.data64F[i * this.stateDim + i] = 1;
      }
      this.kalman.measurementMatrix = H;
      H.delete();
      
      // Process noise covariance
      const Q = cv.Mat.eye(this.stateDim, this.stateDim, cv.CV_64F);
      for (let i = 0; i < 6; i++) {
        Q.data64F[i * this.stateDim + i] = i < 3 ? 0.01 : 1.0;
      }
      this.kalman.processNoiseCov = Q;
      Q.delete();
      
      // Measurement noise covariance
      const R = cv.Mat.eye(this.measurementDim, this.measurementDim, cv.CV_64F);
      for (let i = 0; i < 6; i++) {
        R.data64F[i * this.measurementDim + i] = i < 3 ? 0.1 : 10.0;
      }
      this.kalman.measurementNoiseCov = R;
      R.delete();
      
      // Error covariance
      const P = cv.Mat.eye(this.stateDim, this.stateDim, cv.CV_64F);
      for (let i = 0; i < 6; i++) {
        P.data64F[i * this.stateDim + i] = 1000;
      }
      this.kalman.errorCovPost = P;
      P.delete();
      
      this.measurement = new cv.Mat(this.measurementDim, 1, cv.CV_64F);
      
      console.log('[FILTER] Kalman filter initialized');
      
    } catch (error) {
      console.error('[FILTER] Failed to initialize Kalman filter:', error);
    }
  }

  filter(pose) {
    if (!this.kalman || !pose || !pose.rvec || !pose.tvec) {
      return pose;
    }
    
    try {
      // Create measurement vector
      for (let i = 0; i < 3; i++) {
        this.measurement.data64F[i] = pose.rvec[i];
        this.measurement.data64F[i + 3] = pose.tvec[i];
      }
      
      // Predict
      const prediction = this.kalman.predict();
      
      // Correct
      const corrected = this.kalman.correct(this.measurement);
      
      // Extract filtered pose
      const filteredPose = {
        rvec: [
          corrected.data64F[0],
          corrected.data64F[1],
          corrected.data64F[2]
        ],
        tvec: [
          corrected.data64F[3],
          corrected.data64F[4],
          corrected.data64F[5]
        ],
        confidence: pose.confidence,
        timestamp: pose.timestamp
      };
      
      prediction.delete();
      corrected.delete();
      
      this.initialized = true;
      return filteredPose;
      
    } catch (error) {
      console.error('[FILTER] Kalman filtering failed:', error);
      return pose;
    }
  }

  reset() {
    if (this.kalman) {
      const state = cv.Mat.zeros(this.stateDim, 1, cv.CV_64F);
      this.kalman.statePost = state;
      state.delete();
    }
    this.initialized = false;
    console.log('[FILTER] Kalman filter reset');
  }

  destroy() {
    if (this.kalman) {
      this.kalman.delete();
      this.kalman = null;
    }
    if (this.measurement) {
      this.measurement.delete();
      this.measurement = null;
    }
  }
}

// ======================
// EMA FILTER
// ======================

export class PoseEMAFilter {
  constructor() {
    this.alpha = 0.3; // Smoothing factor
    this.filteredPose = null;
    this.initialized = false;
  }

  filter(pose) {
    if (!pose || !pose.rvec || !pose.tvec) {
      return pose;
    }
    
    if (!this.initialized) {
      // Initialize with first measurement
      this.filteredPose = {
        rvec: [...pose.rvec],
        tvec: [...pose.tvec],
        confidence: pose.confidence,
        timestamp: pose.timestamp
      };
      this.initialized = true;
      return this.filteredPose;
    }
    
    try {
      // Apply exponential moving average
      for (let i = 0; i < 3; i++) {
        this.filteredPose.rvec[i] = this.alpha * pose.rvec[i] + (1 - this.alpha) * this.filteredPose.rvec[i];
        this.filteredPose.tvec[i] = this.alpha * pose.tvec[i] + (1 - this.alpha) * this.filteredPose.tvec[i];
      }
      
      this.filteredPose.confidence = pose.confidence;
      this.filteredPose.timestamp = pose.timestamp;
      
      return this.filteredPose;
      
    } catch (error) {
      console.error('[FILTER] EMA filtering failed:', error);
      return pose;
    }
  }

  reset() {
    this.filteredPose = null;
    this.initialized = false;
    console.log('[FILTER] EMA filter reset');
  }

  setAlpha(alpha) {
    this.alpha = Math.max(0.1, Math.min(0.9, alpha));
    console.log(`[FILTER] EMA alpha set to: ${this.alpha}`);
  }
}
