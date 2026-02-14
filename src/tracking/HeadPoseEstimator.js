/**
 * HeadPoseEstimator.js
 * 
 * OpenCV solvePnP integration for metric head pose estimation
 */

export class HeadPoseEstimator {
  constructor() {
    this.cameraIntrinsics = null;
    this.distortionCoeffs = null;
    this.modelPoints = null;
    this.imagePoints = null;
    this.rvec = null;
    this.tvec = null;
    
    this._initializeModelPoints();
    this._initializeDistortionCoefficients();
  }

  /**
   * Initialize 3D model points for face landmarks
   */
  _initializeModelPoints() {
    // Standardized 3D face model (mm units)
    this.modelPoints = new cv.Mat(6, 3, cv.CV_64FC1);
    
    // Key facial landmarks in 3D space
    const points = [
      [0.0, 0.0, 0.0],        // Nose tip
      [0.0, -330.0, -65.0],    // Chin
      [-225.0, 170.0, -135.0], // Left eye corner
      [225.0, 170.0, -135.0],  // Right eye corner
      [-150.0, -150.0, -125.0],// Left mouth corner
      [150.0, -150.0, -125.0]  // Right mouth corner
    ];
    
    for (let i = 0; i < points.length; i++) {
      this.modelPoints.data64F[i * 3] = points[i][0];
      this.modelPoints.data64F[i * 3 + 1] = points[i][1];
      this.modelPoints.data64F[i * 3 + 2] = points[i][2];
    }
  }

  /**
   * Initialize camera distortion coefficients
   */
  _initializeDistortionCoefficients() {
    this.distortionCoeffs = new cv.Mat(5, 1, cv.CV_64FC1);
    // Assuming no distortion for web cameras
    for (let i = 0; i < 5; i++) {
      this.distortionCoeffs.data64F[i] = 0;
    }
  }

  /**
   * Set camera intrinsics for pose estimation
   */
  setCameraIntrinsics(intrinsics) {
    this.cameraIntrinsics = intrinsics;
    console.log('[POSE] Camera intrinsics set:', {
      focal: intrinsics.focalLength.toFixed(1),
      cx: intrinsics.cx,
      cy: intrinsics.cy
    });
  }

  /**
   * Estimate head pose from facial landmarks
   */
  estimate(landmarks, options = {}) {
    if (!this.cameraIntrinsics) {
      console.warn('[POSE] Camera intrinsics not set');
      return null;
    }
    
    if (!window.opencvReady || typeof cv === 'undefined') {
      console.warn('[POSE] OpenCV not ready');
      return null;
    }
    
    try {
      // Extract 2D image points from landmarks
      const imagePoints = this._extractImagePoints(landmarks, options);
      if (!imagePoints) return null;
      
      // Create camera matrix
      const cameraMatrix = new cv.Mat(3, 3, cv.CV_64FC1);
      cameraMatrix.data64F[0] = this.cameraIntrinsics.focalLength; // fx
      cameraMatrix.data64F[1] = 0;
      cameraMatrix.data64F[2] = this.cameraIntrinsics.cx;     // cx
      cameraMatrix.data64F[3] = 0;
      cameraMatrix.data64F[4] = this.cameraIntrinsics.focalLength; // fy
      cameraMatrix.data64F[5] = this.cameraIntrinsics.cy;     // cy
      cameraMatrix.data64F[6] = 0;
      cameraMatrix.data64F[7] = 0;
      cameraMatrix.data64F[8] = 1;
      
      // SolvePnP for pose estimation
      const rvec = new cv.Mat();
      const tvec = new cv.Mat();
      const success = cv.solvePnP(
        this.modelPoints,
        imagePoints,
        cameraMatrix,
        this.distortionCoeffs,
        rvec,
        tvec,
        false, // useExtrinsicGuess
        cv.SOLVEPNP_ITERATIVE
      );
      
      // Cleanup
      imagePoints.delete();
      cameraMatrix.delete();
      
      if (!success) {
        rvec.delete();
        tvec.delete();
        return null;
      }
      
      // Convert to arrays and cleanup
      const rvecArray = Array.from(rvec.data64F);
      const tvecArray = Array.from(tvec.data64F);
      
      rvec.delete();
      tvec.delete();
      
      // Calculate confidence based on reprojection error
      const confidence = this._calculateConfidence(landmarks, rvecArray, tvecArray);
      
      return {
        rvec: rvecArray,
        tvec: tvecArray,
        confidence: confidence,
        timestamp: performance.now()
      };
      
    } catch (error) {
      console.error('[POSE] Estimation failed:', error);
      return null;
    }
  }

  /**
   * Extract 2D image points from MediaPipe landmarks
   */
  _extractImagePoints(landmarks, options) {
    try {
      const imagePoints = new cv.Mat(6, 2, cv.CV_64FC1);
      const width = options.width || 1280;
      const height = options.height || 720;
      
      // Map MediaPipe landmarks to our 3D model points
      const landmarkIndices = [
        1,   // Nose tip
        152, // Chin
        33,  // Left eye corner  
        263, // Right eye corner
        61,  // Left mouth corner
        291  // Right mouth corner
      ];
      
      for (let i = 0; i < landmarkIndices.length; i++) {
        const landmark = landmarks[landmarkIndices[i]];
        if (!landmark) {
          imagePoints.delete();
          return null;
        }
        
        imagePoints.data64F[i * 2] = landmark.x * width;
        imagePoints.data64F[i * 2 + 1] = landmark.y * height;
      }
      
      return imagePoints;
      
    } catch (error) {
      console.error('[POSE] Failed to extract image points:', error);
      return null;
    }
  }

  /**
   * Calculate confidence based on reprojection error
   */
  _calculateConfidence(landmarks, rvec, tvec) {
    try {
      // Project 3D points back to 2D
      const projectedPoints = this._projectPoints(rvec, tvec);
      if (!projectedPoints) return 0.5;
      
      // Calculate reprojection error
      const width = this.cameraIntrinsics.width;
      const height = this.cameraIntrinsics.height;
      
      const landmarkIndices = [1, 152, 33, 263, 61, 291];
      let totalError = 0;
      let validPoints = 0;
      
      for (let i = 0; i < landmarkIndices.length; i++) {
        const landmark = landmarks[landmarkIndices[i]];
        if (!landmark) continue;
        
        const actualX = landmark.x * width;
        const actualY = landmark.y * height;
        const projectedX = projectedPoints.data64F[i * 2];
        const projectedY = projectedPoints.data64F[i * 2 + 1];
        
        const error = Math.sqrt(
          Math.pow(actualX - projectedX, 2) + 
          Math.pow(actualY - projectedY, 2)
        );
        
        totalError += error;
        validPoints++;
      }
      
      projectedPoints.delete();
      
      if (validPoints === 0) return 0.5;
      
      const avgError = totalError / validPoints;
      // Convert error to confidence (lower error = higher confidence)
      const confidence = Math.max(0, Math.min(1, 1 - avgError / 50));
      
      return confidence;
      
    } catch (error) {
      console.error('[POSE] Confidence calculation failed:', error);
      return 0.5;
    }
  }

  /**
   * Project 3D points to 2D image plane
   */
  _projectPoints(rvec, tvec) {
    try {
      const cameraMatrix = new cv.Mat(3, 3, cv.CV_64FC1);
      cameraMatrix.data64F[0] = this.cameraIntrinsics.focalLength;
      cameraMatrix.data64F[1] = 0;
      cameraMatrix.data64F[2] = this.cameraIntrinsics.cx;
      cameraMatrix.data64F[3] = 0;
      cameraMatrix.data64F[4] = this.cameraIntrinsics.focalLength;
      cameraMatrix.data64F[5] = this.cameraIntrinsics.cy;
      cameraMatrix.data64F[6] = 0;
      cameraMatrix.data64F[7] = 0;
      cameraMatrix.data64F[8] = 1;
      
      const rvecMat = new cv.Mat(3, 1, cv.CV_64FC1);
      const tvecMat = new cv.Mat(3, 1, cv.CV_64FC1);
      
      for (let i = 0; i < 3; i++) {
        rvecMat.data64F[i] = rvec[i];
        tvecMat.data64F[i] = tvec[i];
      }
      
      const projectedPoints = new cv.Mat();
      cv.projectPoints(
        this.modelPoints,
        rvecMat,
        tvecMat,
        cameraMatrix,
        this.distortionCoeffs,
        projectedPoints
      );
      
      // Cleanup
      cameraMatrix.delete();
      rvecMat.delete();
      tvecMat.delete();
      
      return projectedPoints;
      
    } catch (error) {
      console.error('[POSE] Point projection failed:', error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.modelPoints) {
      this.modelPoints.delete();
      this.modelPoints = null;
    }
    
    if (this.distortionCoeffs) {
      this.distortionCoeffs.delete();
      this.distortionCoeffs = null;
    }
  }
}
