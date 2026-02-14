/**
 * CameraCalibrator.js
 * 
 * Runtime focal length estimation for accurate head pose
 */

export class CameraCalibrator {
  constructor() {
    this.samples = [];
    this.maxSamples = 15;
    this.minSamples = 8;
    this.calibratedFocal = null;
    this.lastCalibrationTime = 0;
    
    // Calibration constants based on average facial measurements
    this.REAL_IPD_MM = 63; // Average interpupillary distance
    this.EYE_INDICES = { left: 33, right: 263 };
  }

  /**
   * Estimate focal length from current frame
   */
  estimateFocalLength(landmarks, imageWidth) {
    try {
      const leftEye = landmarks[this.EYE_INDICES.left];
      const rightEye = landmarks[this.EYE_INDICES.right];
      
      if (!leftEye || !rightEye) return null;
      
      // Calculate pixel distance between eyes
      const pixelDistance = Math.hypot(
        (rightEye.x - leftEye.x) * imageWidth,
        (rightEye.y - leftEye.y) * imageWidth
      );
      
      if (pixelDistance < 20 || pixelDistance > 200) {
        return null; // Invalid measurements
      }
      
      // Estimate focal length using triangle similarity
      // focal = (pixel_distance * real_distance) / estimated_face_width
      const estimatedFaceWidth = pixelDistance * 4.5; // Approximate face width
      const focalLength = (pixelDistance * this.REAL_IPD_MM) / 30; // 30mm average eye separation
      
      // Validate focal length range
      if (focalLength < 500 || focalLength > 3000) {
        return null;
      }
      
      return focalLength;
      
    } catch (error) {
      console.error('[CALIB] Focal length estimation failed:', error);
      return null;
    }
  }

  /**
   * Add focal length sample
   */
  addSample(focalLength) {
    if (!focalLength) return false;
    
    this.samples.push({
      value: focalLength,
      timestamp: performance.now()
    });
    
    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    
    console.log(`[CALIB] Added sample: ${focalLength.toFixed(1)}px (${this.samples.length}/${this.maxSamples})`);
    return true;
  }

  /**
   * Get calibrated focal length if enough samples
   */
  getCalibratedFocalLength() {
    if (this.samples.length < this.minSamples) {
      return null;
    }
    
    // Calculate weighted average (recent samples have higher weight)
    let weightedSum = 0;
    let totalWeight = 0;
    const now = performance.now();
    
    for (const sample of this.samples) {
      const age = now - sample.timestamp;
      const weight = Math.exp(-age / 5000); // Decay over 5 seconds
      weightedSum += sample.value * weight;
      totalWeight += weight;
    }
    
    const calibratedFocal = weightedSum / totalWeight;
    
    // Validate result
    if (calibratedFocal < 500 || calibratedFocal > 3000) {
      console.warn('[CALIB] Invalid calibrated focal length:', calibratedFocal);
      return null;
    }
    
    // Check stability (low variance)
    const variance = this._calculateVariance();
    if (variance > 10000) { // High variance indicates unstable calibration
      console.warn('[CALIB] High variance detected:', variance);
      return null;
    }
    
    this.calibratedFocal = calibratedFocal;
    this.lastCalibrationTime = now;
    
    console.log(`[CALIB] ✅ Calibrated focal length: ${calibratedFocal.toFixed(1)}px (variance: ${variance.toFixed(1)})`);
    return calibratedFocal;
  }

  /**
   * Calculate variance of samples
   */
  _calculateVariance() {
    if (this.samples.length < 2) return 0;
    
    const mean = this.samples.reduce((sum, s) => sum + s.value, 0) / this.samples.length;
    const variance = this.samples.reduce((sum, s) => sum + Math.pow(s.value - mean, 2), 0) / this.samples.length;
    
    return variance;
  }

  /**
   * Check if calibration is stable
   */
  isStable() {
    if (!this.calibratedFocal) return false;
    
    const variance = this._calculateVariance();
    const timeSinceCalibration = performance.now() - this.lastCalibrationTime;
    
    return variance < 5000 && timeSinceCalibration < 10000;
  }

  /**
   * Reset calibration state
   */
  reset() {
    this.samples = [];
    this.calibratedFocal = null;
    this.lastCalibrationTime = 0;
    console.log('[CALIB] Reset calibration state');
  }

  /**
   * Get calibration status
   */
  getStatus() {
    return {
      samples: this.samples.length,
      maxSamples: this.maxSamples,
      minSamples: this.minSamples,
      calibrated: !!this.calibratedFocal,
      focalLength: this.calibratedFocal,
      stable: this.isStable(),
      variance: this._calculateVariance()
    };
  }
}
