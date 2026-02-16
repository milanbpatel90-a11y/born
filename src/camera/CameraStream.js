/**
 * CameraStream.js
 * 
 * Manages video stream lifecycle and performance monitoring
 */

export class CameraStream {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.isActive = false;
    this.performanceMonitor = null;
    this.frameCount = 0;
    this.lastFrameTime = 0;
  }

  /**
   * Initialize stream with performance monitoring
   */
  async initialize(stream) {
    this.stream = stream;
    this.video.srcObject = stream;
    
    try {
      await this.video.play();
      this.isActive = true;
      this.startPerformanceMonitoring();
      console.log('[STREAM] Camera stream initialized successfully');
    } catch (error) {
      console.error('[STREAM] Failed to start video playback:', error);
      throw error;
    }
  }

  /**
   * Start monitoring stream performance
   */
  startPerformanceMonitoring() {
    this.performanceMonitor = setInterval(() => {
      if (!this.isActive) return;
      
      const now = performance.now();
      const fps = this.frameCount / ((now - this.lastFrameTime) / 1000);
      
      if (fps < 15) {
        console.warn('[STREAM] Low FPS detected:', fps.toFixed(1));
      }
      
      this.frameCount = 0;
      this.lastFrameTime = now;
    }, 2000);
  }

  /**
   * Stop monitoring and cleanup
   */
  stop() {
    this.isActive = false;
    
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
    }
    
    console.log('[STREAM] Camera stream stopped');
  }

  /**
   * Get current stream settings
   */
  getSettings() {
    const track = this.stream?.getVideoTracks()[0];
    return track?.getSettings() || null;
  }

  /**
   * Check if stream is healthy
   */
  isHealthy() {
    return this.isActive && 
           this.video.readyState >= 2 && 
           this.video.videoWidth > 0;
  }
}
