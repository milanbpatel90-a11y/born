/**
 * ProfessionalFaceTracker.js
 * 
 * Main face tracking system combining FaceMesh + Holistic for ear detection
 * Production v5.0 with anatomical corrections
 */

import { CameraCalibrator } from './CameraCalibrator.js';
import { CameraProfileManager } from './CameraProfileManager.js';
import { HeadPoseEstimator } from './HeadPoseEstimator.js';
import { PoseKalmanFilter, PoseEMAFilter } from './PoseFilter.js';
import { computeSellionOffset } from '../anatomy/opticalAnatomy.js';
import { computeTempleWidth } from '../anatomy/opticalAnatomy.js';
import { computeTempleAngle } from '../anatomy/earDetection.js';
import { estimateFaceProfile } from '../anatomy/faceProfile.js';
import { EnhancedTrackingMethods } from './EnhancedTrackingMethods.js';

export class ProfessionalFaceTracker {
  constructor(video, canvas, callbacks = {}) {
    // DOM elements
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Callbacks
    this.callbacks = callbacks;
    
    // State management
    this.frameCount = 0;
    this.trackingState = 'INITIALIZING';
    this.currentTransform = null;
    this.lossStartTime = 0;
    
    // Calibration system
    this.calibrator = new CameraCalibrator();
    this.profileMgr = new CameraProfileManager();
    this.cameraIntrinsics = null;
    this.calibrationState = 'LOADING';
    this.deviceId = this._getDeviceId();
    
    // Pose filtering
    this.poseFilter = this._getDeviceTier() === 'high' 
      ? new PoseKalmanFilter() 
      : new PoseEMAFilter();
    
    // MediaPipe systems
    this.faceMesh = null;
    this.holistic = null;
    this.hasHolistic = false;
    this.poseEstimator = null;
    
    // Temporary storage for multi-system sync
    this._currentFaceLandmarks = null;
    this._currentPoseLandmarks = null;
    this._currentFaceResults = null;
    
    // Async initialization state
    this.isInitialized = false;
    this.initializationError = null;
    this.initializationPromise = this._initializeSystems();
    
    // Enhanced tracking integration
    this.enhancedMethods = new EnhancedTrackingMethods(this);
  }

  async _initializeSystems() {
    try {
      const [faceMeshInit, holisticInit] = await Promise.allSettled([
        this._initMediaPipe(),
        this._initHolistic()
      ]);

      if (faceMeshInit.status === 'rejected') {
        throw faceMeshInit.reason;
      }

      if (holisticInit.status === 'rejected') {
        this.hasHolistic = false;
        console.warn('[TRACKER] Holistic initialization failed:', holisticInit.reason);
      }

      this._initPoseEstimator();
      this._loadCameraProfile();
      this.isInitialized = true;
    } catch (error) {
      this.initializationError = error;
      this.isInitialized = false;
      console.error('[TRACKER] Initialization failed:', error);
    }
  }

  // ======================
  // INITIALIZATION
  // ======================

  _getDeviceId() {
    return `${navigator.userAgent}_${screen.width}x${screen.height}_${Date.now()}`;
  }

  _getDeviceTier() {
    const highPerf = navigator.hardwareConcurrency && navigator.hardwareConcurrency >= 8;
    const highMem = (navigator.deviceMemory || 0) >= 6;
    return (highPerf || highMem) ? 'high' : 'low';
  }

  async _initMediaPipe() {
    try {
      // Wait for CDN-loaded FaceMesh to be available
      if (!window.FaceMesh) {
        await new Promise((resolve, reject) => {
          if (window._faceMeshReady) { resolve(); return; }
          const timeout = setTimeout(() => reject(new Error('FaceMesh CDN load timeout')), 30000);
          window.addEventListener('faceMeshLoaded', () => { clearTimeout(timeout); resolve(); });
        });
      }
      
      // Initialize FaceMesh from CDN global (no locateFile needed — CDN handles WASM)
      this.faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });
      
      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.85
      });
      
      this.faceMesh.onResults(this._onFaceMeshResults.bind(this));
      console.log('[TRACKER] FaceMesh initialized from CDN');
    } catch (error) {
      console.error('[TRACKER] Failed to initialize FaceMesh:', error);
      throw error;
    }
  }

  async _initHolistic() {
    try {
      // Wait for CDN-loaded Holistic to be available
      if (!window.Holistic) {
        await new Promise((resolve, reject) => {
          if (window._holisticReady) { resolve(); return; }
          const timeout = setTimeout(() => reject(new Error('Holistic CDN load timeout')), 30000);
          window.addEventListener('holisticLoaded', () => { clearTimeout(timeout); resolve(); });
        });
      }
      
      // Initialize Holistic from CDN global
      this.holistic = new window.Holistic({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
      });
      
      this.holistic.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.8,
        refineFaceLandmarks: true
      });
      
      this.holistic.onResults(this._onHolisticResults.bind(this));
      this.hasHolistic = true;
      console.log('[TRACKER] Holistic initialized from CDN (ear detection enabled)');
    } catch (error) {
      console.warn('[TRACKER] Holistic not available:', error.message);
      this.hasHolistic = false;
    }
  }

  _initPoseEstimator() {
    this.poseEstimator = new HeadPoseEstimator();
  }

  _loadCameraProfile() {
    const w = this.video.videoWidth || 1280;
    const h = this.video.videoHeight || 720;
    
    const cached = this.profileMgr.load(this.deviceId, w, h);
    
    if (cached?.focal) {
      this.cameraIntrinsics = {
        focalLength: cached.focal,
        cx: w / 2,
        cy: h / 2,
        width: w,
        height: h
      };
      this.calibrationState = 'CALIBRATED';
      console.log(`[CALIB] Loaded cached profile: ${cached.focal.toFixed(1)}px`);
      this.callbacks.onCalibrated?.();
    } else {
      this.calibrationState = 'CALIBRATING';
      console.log('[CALIB] Starting runtime calibration');
    }
  }

  // ======================
  // MAIN PROCESSING LOOP
  // ======================

  async processFrame(timestamp) {
    if (this.video.readyState < 2) return null;
    if (!this.isInitialized) {
      if (this.initializationPromise) {
        await this.initializationPromise;
      }
      if (!this.isInitialized) {
        return null;
      }
    }
    if (this.initializationError) return null;
    if (!this.faceMesh) return null;
    
    try {
      // Send to both systems in parallel
      const promises = [this.faceMesh.send({ image: this.video })];
      
      if (this.hasHolistic && this.holistic) {
        promises.push(this.holistic.send({ image: this.video }));
      }
      
      await Promise.all(promises);
      
    } catch (error) {
      console.error('[TRACKER] Frame processing error:', error);
      this._handleTrackingLoss();
    }
    
    this.frameCount++;
    return this.currentTransform;
  }

  // ======================
  // CALLBACK HANDLERS
  // ======================

  _onFaceMeshResults = (results) => {
    if (!results.multiFaceLandmarks?.[0]) {
      return this._handleTrackingLoss();
    }
    
    const landmarks = results.multiFaceLandmarks[0];
    
    if (!this._validateLandmarks(landmarks)) {
      return this._handleTrackingLoss();
    }
    
    // Store for Holistic callback
    this._currentFaceLandmarks = landmarks;
    this._currentFaceResults = results;
    
    // Process immediately if no Holistic or no pose yet
    if (!this.hasHolistic || !this._currentPoseLandmarks) {
      this._processTrackingData(landmarks, null);
    }
  }

  _onHolisticResults = (results) => {
    if (!results.poseLandmarks) {
      this._currentPoseLandmarks = null;
      return;
    }
    
    this._currentPoseLandmarks = results.poseLandmarks;
    
    // Process if we have face landmarks
    if (this._currentFaceLandmarks) {
      this._processTrackingData(this._currentFaceLandmarks, results.poseLandmarks);
    }
  }

  _onEnhancedTrackingResults = (fusionResults, refinerResults) => {
    if (!fusionResults || !refinerResults) {
      return;
    }
    
    // Update confidence based on fusion results
    this.multiAlgorithmConfidence = Math.min(
      fusionResults.confidence,
      refinerResults.confidence
    );
  }

  // ======================
  // TRACKING DATA PROCESSING
  // ======================

  _processTrackingData(landmarks, poseLandmarks) {
    // Camera calibration phase
    if (this.calibrationState === 'CALIBRATING') {
      this._attemptCalibration(landmarks);
    }
    
    // Process standard tracking
    this._processStandardTracking(landmarks, poseLandmarks);
  }

  _processStandardTracking(landmarks, poseLandmarks) {
    // Head pose estimation
    const pose = this._estimateHeadPose(landmarks);
    if (!pose) return this._handleTrackingLoss();
    
    const filteredPose = this.poseFilter.filter(pose);
    
    // Anatomical corrections
    const sellion = computeSellionOffset(landmarks, this.cameraIntrinsics, filteredPose.tvec);
    const templeWidth = computeTempleWidth(landmarks, this.video.videoWidth);
    const faceProfile = estimateFaceProfile(landmarks);
    
    if (!sellion || !templeWidth) return this._handleTrackingLoss();
    
    // Ear-based temple angle (v5.0 feature)
    const templeAngleData = computeTempleAngle(poseLandmarks, {
      roll: this._computeHeadRoll(landmarks)
    });
    
    // Scale calculation
    const baseScale = 500 / Math.abs(filteredPose.tvec[2]);
    const scaleX = baseScale * templeWidth.scale * 0.92; // Temple scale factor
    
    // Confidence calculation
    const landmarkConf = this._calculateLandmarkConfidence(landmarks);
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
    this.currentTransform = {
      rvec: filteredPose.rvec,
      tvec: filteredPose.tvec,
      scale: { x: scaleX, y: baseScale, z: baseScale },
      sellionOffset: sellion,
      templeAngle: templeAngleData.angle,
      templeAngleData: templeAngleData,
      faceProfile: faceProfile,
      confidence: overallConf,
      effectiveConfidence: overallConf * (this.calibrationState === 'CALIBRATED' ? 1 : 0.6),
      calibrationState: this.calibrationState,
      trackingState: 'TRACKING',
      hasEarDetection: !!poseLandmarks,
      frameCount: this.frameCount,
      enhancedTracking: false
    };
    
    this.trackingState = 'TRACKING';
    this._notifyCallbacks();
  }

  _attemptCalibration(landmarks) {
    const focal = this.calibrator.estimateFocalLength(landmarks, this.video.videoWidth);
    
    if (focal) {
      this.calibrator.addSample(focal);
      const calibrated = this.calibrator.getCalibratedFocalLength();
      
      if (calibrated) {
        const w = this.video.videoWidth;
        const h = this.video.videoHeight;
        
        this.profileMgr.save(this.deviceId, calibrated, w, h);
        this.cameraIntrinsics = {
          focalLength: calibrated,
          cx: w / 2,
          cy: h / 2,
          width: w,
          height: h
        };
        
        this.calibrationState = 'CALIBRATED';
        this.poseEstimator.setCameraIntrinsics(this.cameraIntrinsics);
        
        console.log(`[CALIB] ✅ Calibrated: ${calibrated.toFixed(1)}px`);
        this.callbacks.onCalibrated?.();
      } else {
        // Notify progress
        this.callbacks.onCalibrationProgress?.(
          this.calibrator.samples.length,
          this.calibrator.maxSamples
        );
      }
    }
  }

  // ======================
  // POSE ESTIMATION
  // ======================

  _estimateHeadPose(landmarks) {
    if (!this.poseEstimator) return null;
    
    try {
      return this.poseEstimator.estimate(landmarks, {
        width: this.video.videoWidth,
        height: this.video.videoHeight,
        intrinsics: this.cameraIntrinsics
      });
    } catch (error) {
      console.error('[POSE] Estimation failed:', error);
      return null;
    }
  }

  _computeHeadRoll(landmarks) {
    const leftEye = landmarks[133]; // Left eye outer
    const rightEye = landmarks[362]; // Right eye outer
    
    if (!leftEye || !rightEye) return 0;
    
    return Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  }

  // ======================
  // VALIDATION & ERROR HANDLING
  // ======================

  _validateLandmarks(landmarks) {
    // Critical landmarks must be present
    const criticalIndices = [1, 152, 263, 33, 291, 61, 468, 473];
    
    if (criticalIndices.some(i => !landmarks[i] || landmarks[i].presence < 0.65)) {
      return false;
    }
    
    // Symmetry check (prevent profile view tracking)
    const leftEye = landmarks[133];
    const rightEye = landmarks[362];
    const noseTip = landmarks[1];
    
    if (!leftEye || !rightEye || !noseTip) return false;
    
    const eyeDistance = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
    const noseOffset = Math.abs((noseTip.x - (leftEye.x + rightEye.x) / 2) / eyeDistance);
    
    if (noseOffset > 0.35) return false; // Too profile
    
    return true;
  }

  _calculateLandmarkConfidence(landmarks) {
    const criticalIndices = [1, 152, 263, 33, 291, 61, 468, 473];
    return Math.min(...criticalIndices.map(i => landmarks[i]?.presence || 0));
  }

  _handleTrackingLoss() {
    if (this.trackingState !== 'LOST') {
      console.log('[TRACKER] Tracking lost');
      this.trackingState = 'LOST';
      this.lossStartTime = Date.now();
      this.poseFilter.reset();
      this.callbacks.onTrackingStateChange?.('LOST');
    }
    
    this.currentTransform = null;
    this.callbacks.onConfidenceUpdate?.(0);
  }

  _notifyCallbacks() {
    this.callbacks.onConfidenceUpdate?.(this.currentTransform.effectiveConfidence);
    this.callbacks.onEarDetection?.(this.currentTransform.hasEarDetection);
    this.callbacks.onTrackingStateChange?.(this.trackingState);
  }

  // ======================
  // CLEANUP
  // ======================

  destroy() {
    console.log('[TRACKER] Destroying...');
    
    if (this.faceMesh) {
      this.faceMesh.close();
    }
    
    if (this.holistic) {
      this.holistic.close();
    }
    
    if (this.poseFilter) {
      this.poseFilter.reset();
    }
    
    this.trackingState = 'DESTROYED';
  }
}
