/**
 * SimpleFaceTracker.js
 * 
 * Fallback face tracker using browser's native face detection API
 * when MediaPipe fails to load due to WASM issues
 */

export class SimpleFaceTracker {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.faceDetector = null;
    this.isInitialized = false;
    this.lastResults = null;
    this.callbacks = {
      onResults: null,
      onError: null
    };
  }

  /**
   * Initialize the simple face tracker
   */
  async initialize(video, callbacks) {
    try {
      this.video = video;
      this.callbacks = callbacks;
      
      // Create canvas for processing
      this.canvas = document.createElement('canvas');
      this.canvas.width = video.videoWidth || 640;
      this.canvas.height = video.videoHeight || 480;
      this.ctx = this.canvas.getContext('2d');
      
      // Initialize face detection API
      if ('FaceDetector' in window) {
        this.faceDetector = new window.FaceDetector();
        await this.faceDetector.load();
      } else if ('FaceDetectionObserver' in window) {
        // Fallback to older APIs
        this.faceDetector = new window.FaceDetectionObserver();
      } else {
        throw new Error('Face detection not supported in this browser');
      }
      
      this.isInitialized = true;
      console.log('[SIMPLE_TRACKER] Simple face tracker initialized');
      
      return true;
    } catch (error) {
      console.error('[SIMPLE_TRACKER] Initialization failed:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      return false;
    }
  }

  /**
   * Process video frame for face detection
   */
  async processFrame() {
    if (!this.isInitialized || !this.video) {
      return null;
    }

    try {
      // Draw video frame to canvas
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // Detect faces
      const faces = await this.faceDetector.detect(this.canvas);
      
      if (faces && faces.length > 0) {
        const face = faces[0];
        
        // Convert to MediaPipe-like format for compatibility
        const results = {
          faceLandmarks: this._convertLandmarks(face),
          faceDetections: [{
            x: face.boundingBox.x,
            y: face.boundingBox.y,
            width: face.boundingBox.width,
            height: face.boundingBox.height,
            confidence: face.confidence || 0.8
          }],
          image: this.canvas,
          timestamp: Date.now()
        };
        
        this.lastResults = results;
        
        if (this.callbacks.onResults) {
          this.callbacks.onResults(results);
        }
        
        return results;
      }
      
      return null;
    } catch (error) {
      console.error('[SIMPLE_TRACKER] Frame processing failed:', error);
      return null;
    }
  }

  /**
   * Convert face detection results to landmark format
   */
  _convertLandmarks(face) {
    // Create simplified landmark points (468 points like MediaPipe)
    const landmarks = [];
    const numLandmarks = 468;
    
    for (let i = 0; i < numLandmarks; i++) {
      // Generate approximate positions based on face bounding box
      const t = i / numLandmarks;
      const angle = t * Math.PI * 2;
      
      landmarks.push({
        x: face.boundingBox.x + (face.boundingBox.width / 2) + Math.cos(angle) * (face.boundingBox.width / 3),
        y: face.boundingBox.y + (face.boundingBox.height / 2) + Math.sin(angle) * (face.boundingBox.height / 3),
        z: 0
      });
    }
    
    return landmarks;
  }

  /**
   * Get face bounding box
   */
  getFaceBoundingBox() {
    if (this.lastResults && this.lastResults.faceDetections && this.lastResults.faceDetections.length > 0) {
      return this.lastResults.faceDetections[0];
    }
    return null;
  }

  /**
   * Get face landmarks
   */
  getFaceLandmarks() {
    if (this.lastResults && this.lastResults.faceLandmarks) {
      return this.lastResults.faceLandmarks;
    }
    return [];
  }

  /**
   * Get tracking confidence
   */
  getConfidence() {
    if (this.lastResults && this.lastResults.faceDetections && this.lastResults.faceDetections.length > 0) {
      return this.lastResults.faceDetections[0].confidence;
    }
    return 0;
  }

  /**
   * Check if face is detected
   */
  isFaceDetected() {
    return this.getConfidence() > 0.5;
  }

  /**
   * Reset tracker state
   */
  reset() {
    this.lastResults = null;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.isInitialized = false;
    
    if (this.faceDetector) {
      if (this.faceDetector.dispose) {
        this.faceDetector.dispose();
      }
      this.faceDetector = null;
    }
    
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.lastResults = null;
    
    console.log('[SIMPLE_TRACKER] Disposed');
  }

  /**
   * Get device capabilities
   */
  static getDeviceCapabilities() {
    return {
      hasFaceDetection: 'FaceDetector' in window || 'FaceDetectionObserver' in window,
      hasWebGL: (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
          return false;
        }
      })(),
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };
  }
}
