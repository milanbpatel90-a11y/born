/**
 * EnhancedTrackingMethods.js
 * 
 * Enhanced tracking methods for ProfessionalFaceTracker
 */

import { computeSellionOffset } from '../anatomy/opticalAnatomy.js';
import { computeTempleWidth } from '../anatomy/opticalAnatomy.js';
import { computeTempleAngle } from '../anatomy/earDetection.js';
import { estimateFaceProfile } from '../anatomy/faceProfile.js';

export class EnhancedTrackingMethods {
  constructor(tracker) {
    this.tracker = tracker;
  }

  _initEnhancedTracking() {
    // Enhanced tracking is not available in this version
    console.log('[TRACKER] Enhanced tracking not available in this version');
  }

  _onEnhancedTrackingResults(fusionResults, refinerResults) {
    if (!fusionResults || !refinerResults) {
      return;
    }
    
    // Update confidence based on fusion results
    this.tracker.multiAlgorithmConfidence = Math.min(
      fusionResults.confidence,
      refinerResults.confidence
    );
  }

  _processEnhancedTracking(landmarks, poseLandmarks) {
    // Enhanced tracking not available, fall back to standard tracking
    this._processStandardTracking(landmarks, poseLandmarks);
  }

  _processStandardTracking(landmarks, poseLandmarks) {
    // Head pose estimation
    const pose = this.tracker._estimateHeadPose(landmarks);
    if (!pose) return this.tracker._handleTrackingLoss();
    
    const filteredPose = this.tracker.poseFilter.filter(pose);
    
    // Anatomical corrections
    const sellion = computeSellionOffset(landmarks, this.tracker.cameraIntrinsics, filteredPose.tvec);
    const templeWidth = computeTempleWidth(landmarks, this.tracker.video.videoWidth);
    const faceProfile = estimateFaceProfile(landmarks);
    
    if (!sellion || !templeWidth) return this.tracker._handleTrackingLoss();
    
    // Ear-based temple angle (v5.0 feature)
    const templeAngleData = computeTempleAngle(poseLandmarks, {
      roll: this.tracker._computeHeadRoll(landmarks)
    });
    
    // Scale calculation
    const baseScale = 500 / Math.abs(filteredPose.tvec[2]);
    const scaleX = baseScale * templeWidth.scale * 0.92; // Temple scale factor
    
    // Confidence calculation
    const landmarkConf = this.tracker._calculateLandmarkConfidence(landmarks);
    let overallConf = Math.min(
      pose.confidence || 0.9,
      sellion.confidence,
      templeWidth.confidence,
      faceProfile.confidence || 1.0,
      landmarkConf
    );
    
    // Factor in ear detection confidence if available
    if (templeAngleData.confidence) {
      overallConf = Math.min(overallConf, templeAngleData.confidence);
    }
    
    // Build final transform
    this.tracker.currentTransform = {
      rvec: filteredPose.rvec,
      tvec: filteredPose.tvec,
      scale: { x: scaleX, y: baseScale, z: baseScale },
      sellionOffset: sellion,
      templeAngle: templeAngleData.angle,
      templeAngleData: templeAngleData,
      faceProfile: faceProfile,
      confidence: overallConf,
      effectiveConfidence: overallConf * (this.tracker.calibrationState === 'CALIBRATED' ? 1 : 0.6),
      calibrationState: this.tracker.calibrationState,
      trackingState: 'TRACKING',
      hasEarDetection: !!poseLandmarks,
      frameCount: this.tracker.frameCount,
      enhancedTracking: false
    };
    
    this.tracker.trackingState = 'TRACKING';
    this.tracker._notifyCallbacks();
  }
}
