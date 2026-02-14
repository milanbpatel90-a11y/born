/**
 * deviceDetection.js
 * 
 * Device tier detection and performance optimization
 */

export class DeviceDetection {
  constructor() {
    this.deviceInfo = this._analyzeDevice();
    this.performanceTier = this._determinePerformanceTier();
    this.supportedFeatures = this._checkSupportedFeatures();
    
    console.log('[DEVICE] Device analysis complete:', {
      tier: this.performanceTier,
      features: this.supportedFeatures
    });
  }

  /**
   * Analyze device capabilities
   */
  _analyzeDevice() {
    const info = {
      // Basic info
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      
      // Hardware
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: navigator.deviceMemory || 0,
      
      // Display
      screenResolution: `${screen.width}x${screen.height}`,
      pixelRatio: window.devicePixelRatio || 1,
      colorDepth: screen.colorDepth,
      
      // Browser capabilities
      isWebGLSupported: this._checkWebGLSupport(),
      isWebGL2Supported: this._checkWebGL2Support(),
      isWebRTCSupported: this._checkWebRTCSupport(),
      isMediaPipeSupported: this._checkMediaPipeSupport(),
      
      // Performance
      isLowEndDevice: this._isLowEndDevice(),
      isMobile: this._isMobile(),
      isTablet: this._isTablet()
    };
    
    return info;
  }

  /**
   * Determine performance tier
   */
  _determinePerformanceTier() {
    let score = 0;
    
    // CPU cores
    if (this.deviceInfo.hardwareConcurrency >= 8) score += 3;
    else if (this.deviceInfo.hardwareConcurrency >= 4) score += 2;
    else if (this.deviceInfo.hardwareConcurrency >= 2) score += 1;
    
    // Memory
    if (this.deviceInfo.deviceMemory >= 8) score += 3;
    else if (this.deviceInfo.deviceMemory >= 4) score += 2;
    else if (this.deviceInfo.deviceMemory >= 2) score += 1;
    
    // WebGL support
    if (this.deviceInfo.isWebGL2Supported) score += 2;
    else if (this.deviceInfo.isWebGLSupported) score += 1;
    
    // Screen resolution
    const pixelCount = screen.width * screen.height;
    if (pixelCount >= 1920 * 1080) score += 2;
    else if (pixelCount >= 1280 * 720) score += 1;
    
    // Device type penalty
    if (this.deviceInfo.isMobile) score -= 1;
    if (this.deviceInfo.isLowEndDevice) score -= 2;
    
    // Determine tier
    if (score >= 8) return 'high';
    if (score >= 4) return 'medium';
    if (score >= 1) return 'low';
    return 'minimal';
  }

  /**
   * Check supported features
   */
  _checkSupportedFeatures() {
    return {
      // MediaPipe features
      faceMesh: this.deviceInfo.isMediaPipeSupported,
      holistic: this.deviceInfo.isMediaPipeSupported && this.performanceTier !== 'minimal',
      
      // Rendering features
      webgl: this.deviceInfo.isWebGLSupported,
      webgl2: this.deviceInfo.isWebGL2Supported,
      shadows: this.performanceTier !== 'minimal',
      antialiasing: this.performanceTier !== 'minimal',
      
      // Camera features
      highResolutionCamera: !this.deviceInfo.isMobile || this.performanceTier === 'high',
      advancedConstraints: !this.deviceInfo.isMobile,
      
      // Processing features
      kalmanFilter: this.performanceTier === 'high',
      realTimeCalibration: this.performanceTier !== 'minimal',
      earDetection: this.performanceTier !== 'minimal',
      
      // UI features
      highQualityUI: this.performanceTier !== 'low',
      animations: this.performanceTier !== 'minimal',
      blurEffects: this.performanceTier !== 'low'
    };
  }

  /**
   * Check WebGL support
   */
  _checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check WebGL2 support
   */
  _checkWebGL2Support() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check WebRTC support
   */
  _checkWebRTCSupport() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Check MediaPipe support
   */
  _checkMediaPipeSupport() {
    // Basic checks for MediaPipe compatibility
    const hasWebGL = this._checkWebGLSupport();
    const hasWebAssembly = typeof WebAssembly === 'object';
    const hasRequiredAPIs = hasWebGL && hasWebAssembly;
    
    // Check browser compatibility
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    
    return hasRequiredAPIs && (isChrome || isFirefox || isEdge || (isSafari && this.performanceTier !== 'minimal'));
  }

  /**
   * Check if device is low-end
   */
  _isLowEndDevice() {
    const lowMemory = this.deviceInfo.deviceMemory <= 2;
    const lowCores = this.deviceInfo.hardwareConcurrency <= 2;
    const lowResolution = screen.width * screen.height <= 1280 * 720;
    
    return lowMemory || lowCores || lowResolution;
  }

  /**
   * Check if device is mobile
   */
  _isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Check if device is tablet
   */
  _isTablet() {
    const userAgent = navigator.userAgent;
    const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);
    const isLargeScreen = Math.min(screen.width, screen.height) >= 768;
    
    return isTablet || (this._isMobile() && isLargeScreen);
  }

  /**
   * Get optimized settings for current device
   */
  getOptimizedSettings() {
    const baseSettings = {
      // Camera settings
      camera: {
        width: 1280,
        height: 720,
        frameRate: 30
      },
      
      // MediaPipe settings
      mediaPipe: {
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
        refineLandmarks: true
      },
      
      // Rendering settings
      rendering: {
        antialias: true,
        shadows: true,
        pixelRatio: window.devicePixelRatio
      },
      
      // Performance settings
      performance: {
        kalmanFilter: false,
        smoothingFactor: 0.3,
        maxFPS: 30
      }
    };
    
    // Adjust based on performance tier
    switch (this.performanceTier) {
      case 'high':
        return {
          ...baseSettings,
          camera: { ...baseSettings.camera, width: 1920, height: 1080 },
          mediaPipe: { ...baseSettings.mediaPipe, modelComplexity: 2 },
          performance: { ...baseSettings.performance, kalmanFilter: true, maxFPS: 60 }
        };
        
      case 'medium':
        return baseSettings;
        
      case 'low':
        return {
          ...baseSettings,
          camera: { ...baseSettings.camera, width: 640, height: 480 },
          mediaPipe: { ...baseSettings.mediaPipe, modelComplexity: 0, refineLandmarks: false },
          rendering: { ...baseSettings.rendering, shadows: false, antialias: false },
          performance: { ...baseSettings.performance, maxFPS: 20 }
        };
        
      case 'minimal':
        return {
          ...baseSettings,
          camera: { ...baseSettings.camera, width: 480, height: 360, frameRate: 15 },
          mediaPipe: { ...baseSettings.mediaPipe, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 },
          rendering: { ...baseSettings.rendering, shadows: false, antialias: false, pixelRatio: 1 },
          performance: { ...baseSettings.performance, maxFPS: 15, smoothingFactor: 0.1 }
        };
        
      default:
        return baseSettings;
    }
  }

  /**
   * Get device recommendation
   */
  getRecommendation() {
    const recommendations = [];
    
    if (this.performanceTier === 'minimal') {
      recommendations.push('Consider using a more powerful device for better experience');
      recommendations.push('Close other applications to free up resources');
    }
    
    if (!this.supportedFeatures.earDetection) {
      recommendations.push('Ear detection not available on this device');
    }
    
    if (!this.supportedFeatures.highResolutionCamera) {
      recommendations.push('Using lower camera resolution for better performance');
    }
    
    if (this.deviceInfo.isMobile) {
      recommendations.push('For best results, use in portrait mode with good lighting');
    }
    
    return recommendations;
  }

  /**
   * Export device info
   */
  exportDeviceInfo() {
    return {
      deviceInfo: this.deviceInfo,
      performanceTier: this.performanceTier,
      supportedFeatures: this.supportedFeatures,
      optimizedSettings: this.getOptimizedSettings(),
      recommendations: this.getRecommendation(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create performance monitor
   */
  createPerformanceMonitor() {
    return new PerformanceMonitor(this.performanceTier);
  }
}

/**
 * Performance monitor for tracking device performance
 */
export class PerformanceMonitor {
  constructor(performanceTier) {
    this.performanceTier = performanceTier;
    this.metrics = {
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      lastFrameTime: performance.now(),
      frameCount: 0
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.metrics.lastFrameTime = performance.now();
    this.metrics.frameCount = 0;
    
    this.monitoringInterval = setInterval(() => {
      this._updateMetrics();
    }, 1000);
    
    console.log('[PERF] Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('[PERF] Performance monitoring stopped');
  }

  /**
   * Update performance metrics
   */
  _updateMetrics() {
    const now = performance.now();
    const deltaTime = now - this.metrics.lastFrameTime;
    
    if (deltaTime > 0) {
      this.metrics.fps = this.metrics.frameCount;
      this.metrics.frameTime = deltaTime / this.metrics.frameCount;
    }
    
    // Memory usage (if available)
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    
    // Reset counters
    this.metrics.lastFrameTime = now;
    this.metrics.frameCount = 0;
  }

  /**
   * Record a frame
   */
  recordFrame() {
    if (this.isMonitoring) {
      this.metrics.frameCount++;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Check if performance is acceptable
   */
  isPerformanceAcceptable() {
    const targetFPS = this.performanceTier === 'high' ? 60 : 
                     this.performanceTier === 'medium' ? 30 : 15;
    
    return this.metrics.fps >= targetFPS * 0.8; // 80% of target
  }
}
