/**
 * WorldClassFaceTracker.js
 * 
 * Production-ready, commercial-grade face tracking system for virtual try-on.
 * 
 * This is the main integration class that combines:
 * - MediaPipe FaceLandmarker (478 landmarks)
 * - Advanced PnP pose estimation
 * - Production-grade stabilization
 * - Facial anatomy analysis
 * - Quality monitoring and recovery
 * - 3D glasses alignment
 * 
 * @version 2.0.0 - Production Ready
 * @license Commercial
 */

import * as THREE from 'three';
import { FaceLandmarkerSystem } from './FaceLandmarkerSystem.js';
import { AdvancedPoseEstimator } from './AdvancedPoseEstimator.js';
import { ProductionStabilizer } from './ProductionStabilizer.js';
import { FaceAnatomyAnalyzer } from './FaceAnatomyAnalyzer.js';
import { TrackingQualityMonitor, TRACKING_STATES, RECOVERY_STRATEGIES } from './TrackingQualityMonitor.js';

/**
 * WorldClassFaceTracker - Main tracking orchestrator
 */
export class WorldClassFaceTracker {
  constructor(options = {}) {
    // Configuration
    this.config = {
      // Performance
      performanceProfile: options.performanceProfile || 'auto', // 'ultra', 'high', 'medium', 'low', 'auto'
      
      // Tracking
      maxFaces: options.maxFaces || 1,
      refineLandmarks: options.refineLandmarks !== false,
      
      // Stabilization
      stabilization: {
        positionMinCutoff: options.positionMinCutoff || 0.8,
        positionBeta: options.positionBeta || 0.005,
        rotationMinCutoff: options.rotationMinCutoff || 1.2,
        rotationBeta: options.rotationBeta || 0.01,
        useKalman: options.useKalman !== false,
        adaptiveSmoothing: options.adaptiveSmoothing !== false
      },
      
      // Quality thresholds
      qualityThresholds: {
        excellent: options.excellentThreshold || 0.9,
        good: options.goodThreshold || 0.75,
        acceptable: options.acceptableThreshold || 0.5,
        poor: options.poorThreshold || 0.3
      },
      
      // Callbacks
      onInitialized: options.onInitialized || null,
      onTrackingUpdate: options.onTrackingUpdate || null,
      onQualityChange: options.onQualityChange || null,
      onStateChange: options.onStateChange || null,
      onTrackingLost: options.onTrackingLost || null,
      onTrackingRecovered: options.onTrackingRecovered || null,
      onError: options.onError || null
    };
    
    // Core systems
    this.faceLandmarker = null;
    this.poseEstimator = null;
    this.stabilizer = null;
    this.anatomyAnalyzer = null;
    this.qualityMonitor = null;
    
    // State
    this.isInitialized = false;
    this.isProcessing = false;
    this.initializationError = null;
    
    // Video/Canvas references
    this.video = null;
    this.canvas = null;
    
    // Current tracking data
    this.currentTrackingData = null;
    this.currentAnatomyData = null;
    this.currentQuality = null;
    
    // Frame timing
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.fps = 0;
    this.averageFrameTime = 0;
    this.frameTimeHistory = [];
    
    // Bind methods
    this._processFrame = this._processFrame.bind(this);
  }
  
  /**
   * Initialize the tracking system
   * @param {HTMLVideoElement} video - Video element for tracking
   * @param {HTMLCanvasElement} canvas - Optional canvas for debug rendering
   * @returns {Promise<void>}
   */
  async initialize(video, canvas = null) {
    try {
      console.log('[TRACKER] Initializing world-class face tracker...');
      
      this.video = video;
      this.canvas = canvas;
      
      // Initialize FaceLandmarker
      console.log('[TRACKER] Initializing FaceLandmarker...');
      this.faceLandmarker = new FaceLandmarkerSystem({
        performanceProfile: this.config.performanceProfile
      });
      await this.faceLandmarker.initialize();
      
      // Initialize pose estimator
      console.log('[TRACKER] Initializing pose estimator...');
      this.poseEstimator = new AdvancedPoseEstimator({
        useRANSAC: true,
        refinePose: true
      });
      
      // Set camera intrinsics from video
      if (video.videoWidth && video.videoHeight) {
        this.poseEstimator.setCameraIntrinsics(
          video.videoWidth,
          video.videoHeight
        );
      }
      
      // Initialize stabilizer
      console.log('[TRACKER] Initializing stabilizer...');
      this.stabilizer = new ProductionStabilizer(this.config.stabilization);
      
      // Initialize anatomy analyzer
      console.log('[TRACKER] Initializing anatomy analyzer...');
      this.anatomyAnalyzer = new FaceAnatomyAnalyzer();
      
      // Initialize quality monitor
      console.log('[TRACKER] Initializing quality monitor...');
      this.qualityMonitor = new TrackingQualityMonitor({
        ...this.config.qualityThresholds,
        onStateChange: (data) => this._handleStateChange(data),
        onQualityChange: (quality) => this._handleQualityChange(quality),
        onTrackingLost: () => this._handleTrackingLost(),
        onTrackingRecovered: () => this._handleTrackingRecovered()
      });
      
      this.isInitialized = true;
      console.log('[TRACKER] ✅ World-class face tracker initialized');
      
      // Trigger callback
      this._triggerCallback('onInitialized');
      
    } catch (error) {
      this.initializationError = error;
      this.isInitialized = false;
      console.error('[TRACKER] Initialization failed:', error);
      this._triggerCallback('onError', error);
      throw error;
    }
  }
  
  /**
   * Process a single frame
   * @param {number} timestamp - Frame timestamp
   * @returns {Object|null} - Tracking result
   */
  async processFrame(timestamp = null) {
    if (!this.isInitialized || !this.video || this.video.readyState < 2) {
      return null;
    }
    
    if (this.isProcessing) {
      return this.currentTrackingData;
    }
    
    this.isProcessing = true;
    const frameStartTime = performance.now();
    
    try {
      // Step 1: Detect face landmarks
      const detectionResult = this.faceLandmarker.detectForVideo(
        this.video,
        timestamp || performance.now()
      );
      
      if (!detectionResult || !detectionResult.landmarks) {
        this._handleNoDetection();
        this.isProcessing = false;
        return null;
      }
      
      // Step 2: Estimate 3D pose
      const poseResult = this.poseEstimator.estimate(detectionResult.landmarks, {
        width: this.video.videoWidth,
        height: this.video.videoHeight
      });
      
      // Step 3: Analyze facial anatomy
      const anatomyResult = this.anatomyAnalyzer.analyze(detectionResult.landmarks, {
        width: this.video.videoWidth,
        height: this.video.videoHeight
      });
      
      // Step 4: Build raw tracking data
      const rawTrackingData = this._buildTrackingData(
        detectionResult,
        poseResult,
        anatomyResult
      );
      
      // Step 5: Stabilize tracking
      const stabilizedData = this.stabilizer.update({
        position: rawTrackingData.position,
        quaternion: rawTrackingData.quaternion,
        scale: rawTrackingData.scale,
        confidence: rawTrackingData.confidence
      }, timestamp / 1000);
      
      // Step 6: Update quality monitoring
      const qualityAssessment = this.qualityMonitor.update({
        ...rawTrackingData,
        landmarks: detectionResult.landmarks
      });
      
      // Step 7: Build final result
      this.currentTrackingData = {
        // Raw landmarks
        landmarks: detectionResult.landmarks,
        transformationMatrix: detectionResult.transformationMatrix,
        blendshapes: detectionResult.blendshapes,
        
        // Stabilized pose
        position: stabilizedData.position,
        quaternion: stabilizedData.quaternion,
        euler: new THREE.Euler().setFromQuaternion(stabilizedData.quaternion),
        scale: stabilizedData.scale,
        velocity: stabilizedData.velocity,
        
        // Raw pose (for comparison)
        rawPosition: rawTrackingData.position,
        rawQuaternion: rawTrackingData.quaternion,
        
        // Anatomy data
        anatomy: anatomyResult,
        
        // Quality data
        quality: qualityAssessment,
        confidence: rawTrackingData.confidence,
        
        // Metadata
        frameCount: this.frameCount,
        timestamp: timestamp || performance.now(),
        fps: this.fps
      };
      
      this.currentAnatomyData = anatomyResult;
      this.currentQuality = qualityAssessment;
      
      // Update frame timing
      this._updateFrameTiming(frameStartTime);
      
      // Trigger callback
      this._triggerCallback('onTrackingUpdate', this.currentTrackingData);
      
      this.isProcessing = false;
      return this.currentTrackingData;
      
    } catch (error) {
      console.error('[TRACKER] Frame processing error:', error);
      this.isProcessing = false;
      return null;
    }
  }
  
  /**
   * Build tracking data from detection and pose results
   * @param {Object} detection 
   * @param {Object} pose 
   * @param {Object} anatomy 
   * @returns {Object}
   */
  _buildTrackingData(detection, pose, anatomy) {
    const landmarks = detection.landmarks;
    
    // Get position from pose or landmarks
    let position = new THREE.Vector3();
    let quaternion = new THREE.Quaternion();
    
    if (pose) {
      position.set(
        pose.translation[0],
        pose.translation[1],
        pose.translation[2]
      );
      quaternion.copy(pose.quaternion);
    } else {
      // Fallback: Calculate from landmarks
      const noseBridge = landmarks[6];
      if (noseBridge) {
        position.set(
          (noseBridge.x - 0.5) * 500,
          -(noseBridge.y - 0.5) * 500,
          -noseBridge.z * 500
        );
      }
      
      // Calculate rotation from eye line
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      if (leftEye && rightEye) {
        const roll = Math.atan2(
          rightEye.y - leftEye.y,
          rightEye.x - leftEye.x
        );
        quaternion.setFromEuler(new THREE.Euler(0, 0, roll));
      }
    }
    
    // Calculate scale from anatomy
    let scale = new THREE.Vector3(1, 1, 1);
    if (anatomy && anatomy.templeWidth) {
      const scaleFactor = anatomy.templeWidth / 140; // 140mm standard
      scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
    
    // Calculate confidence
    const confidence = detection.confidence || 
      (pose ? pose.confidence : 0.5);
    
    return {
      position,
      quaternion,
      scale,
      confidence,
      landmarks,
      reprojectionError: pose?.reprojectionError,
      inlierRatio: pose?.inlierRatio
    };
  }
  
  /**
   * Handle no detection case
   */
  _handleNoDetection() {
    this.qualityMonitor.update(null);
    this.currentTrackingData = null;
  }
  
  /**
   * Update frame timing metrics
   * @param {number} frameStartTime 
   */
  _updateFrameTiming(frameStartTime) {
    this.frameCount++;
    
    const frameTime = performance.now() - frameStartTime;
    this.frameTimeHistory.push(frameTime);
    
    if (this.frameTimeHistory.length > 30) {
      this.frameTimeHistory.shift();
    }
    
    this.averageFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / 
      this.frameTimeHistory.length;
    
    // Calculate FPS
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      this.fps = 1000 / delta;
    }
    this.lastFrameTime = now;
  }
  
  /**
   * Handle state change
   * @param {Object} data 
   */
  _handleStateChange(data) {
    this._triggerCallback('onStateChange', data);
  }
  
  /**
   * Handle quality change
   * @param {number} quality 
   */
  _handleQualityChange(quality) {
    this._triggerCallback('onQualityChange', quality);
  }
  
  /**
   * Handle tracking lost
   */
  _handleTrackingLost() {
    console.log('[TRACKER] Tracking lost');
    this.stabilizer.reset();
    this._triggerCallback('onTrackingLost');
  }
  
  /**
   * Handle tracking recovered
   */
  _handleTrackingRecovered() {
    console.log('[TRACKER] Tracking recovered');
    this._triggerCallback('onTrackingRecovered');
  }
  
  /**
   * Trigger callback
   * @param {string} name 
   * @param {*} data 
   */
  _triggerCallback(name, data) {
    const callback = this.config[name];
    if (typeof callback === 'function') {
      try {
        callback(data);
      } catch (e) {
        console.error(`[TRACKER] Callback error: ${name}`, e);
      }
    }
  }
  
  // ======================
  // PUBLIC API
  // ======================
  
  /**
   * Get current tracking data
   * @returns {Object|null}
   */
  getTrackingData() {
    return this.currentTrackingData;
  }
  
  /**
   * Get current anatomy data
   * @returns {Object|null}
   */
  getAnatomyData() {
    return this.currentAnatomyData;
  }
  
  /**
   * Get current quality assessment
   * @returns {Object|null}
   */
  getQuality() {
    return this.currentQuality;
  }
  
  /**
   * Get tracking state
   * @returns {string}
   */
  getState() {
    return this.qualityMonitor?.getState() || TRACKING_STATES.INITIALIZING;
  }
  
  /**
   * Check if tracking is good
   * @returns {boolean}
   */
  isTrackingGood() {
    return this.qualityMonitor?.isTrackingGood() || false;
  }
  
  /**
   * Get performance metrics
   * @returns {Object}
   */
  getPerformanceMetrics() {
    return {
      frameCount: this.frameCount,
      fps: this.fps,
      averageFrameTime: this.averageFrameTime,
      quality: this.currentQuality?.quality || 0,
      state: this.getState(),
      landmarkerMetrics: this.faceLandmarker?.getMetrics() || null,
      stabilizerMetrics: this.stabilizer?.getMetrics() || null
    };
  }
  
  /**
   * Get glasses fitting recommendations
   * @returns {Object|null}
   */
  getGlassesRecommendations() {
    return this.anatomyAnalyzer?.getGlassesRecommendations() || null;
  }
  
  /**
   * Calibrate scale with known measurement
   * @param {number} knownMeasurement - Known measurement in mm
   * @param {string} type - Measurement type
   */
  calibrate(knownMeasurement, type = 'ipd') {
    this.anatomyAnalyzer?.calibrate(knownMeasurement, type);
  }
  
  /**
   * Set performance profile
   * @param {string} profile - 'ultra', 'high', 'medium', 'low'
   */
  async setPerformanceProfile(profile) {
    if (this.faceLandmarker) {
      await this.faceLandmarker.setPerformanceProfile(profile);
    }
  }
  
  /**
   * Set stabilization config
   * @param {Object} config 
   */
  setStabilizationConfig(config) {
    if (this.stabilizer) {
      this.stabilizer.setConfig(config);
    }
  }
  
  /**
   * Reset tracking state
   */
  reset() {
    this.stabilizer?.reset();
    this.qualityMonitor?.reset();
    this.poseEstimator?.reset();
    this.anatomyAnalyzer?.reset();
    this.currentTrackingData = null;
    this.currentAnatomyData = null;
    this.currentQuality = null;
    this.frameCount = 0;
    console.log('[TRACKER] Reset complete');
  }
  
  /**
   * Destroy tracker and free resources
   */
  destroy() {
    console.log('[TRACKER] Destroying...');
    
    this.faceLandmarker?.destroy();
    this.poseEstimator?.reset();
    this.stabilizer?.reset();
    this.anatomyAnalyzer?.reset();
    this.qualityMonitor?.reset();
    
    this.faceLandmarker = null;
    this.poseEstimator = null;
    this.stabilizer = null;
    this.anatomyAnalyzer = null;
    this.qualityMonitor = null;
    
    this.isInitialized = false;
    this.currentTrackingData = null;
    
    console.log('[TRACKER] Destroyed');
  }
}

export default WorldClassFaceTracker;
