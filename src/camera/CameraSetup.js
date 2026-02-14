/**
 * CameraSetup.js
 * 
 * Handles camera initialization with exposure control for retail environments
 */

export class CameraSetup {
  constructor() {
    this.constraints = {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      advanced: [
        { exposureMode: 'continuous' },
        { exposureCompensation: 0 },
        { whiteBalanceMode: 'continuous' },
        { focusMode: 'continuous' },
        { colorTemperature: 5000 },
        { iso: 400 }
      ]
    };
  }

  /**
   * Request camera stream with fallback to basic constraints
   */
  async requestCameraStream() {
    try {
      console.log('[CAMERA] Requesting stream with advanced constraints...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: this.constraints 
      });
      
      this._logStreamInfo(stream);
      return stream;
      
    } catch (advancedError) {
      console.warn('[CAMERA] Advanced constraints failed:', advancedError.message);
      
      try {
        console.log('[CAMERA] Falling back to basic constraints...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user', 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          }
        });
        
        this._logStreamInfo(stream);
        return stream;
        
      } catch (basicError) {
        console.error('[CAMERA] Basic constraints failed:', basicError);
        throw new Error('Camera access denied or not supported. Please allow camera permissions.');
      }
    }
  }

  /**
   * Enhanced camera request with better error handling and device selection
   */
  async requestCameraStreamEnhanced() {
    try {
      // First, get available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`[CAMERA] Found ${videoDevices.length} video devices`);
      
      if (videoDevices.length === 0) {
        throw new Error('No camera devices found');
      }

      // Try multiple constraint strategies
      const strategies = [
        // Strategy 1: Front camera with ideal resolution
        {
          name: 'Front camera ideal',
          constraints: {
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            }
          }
        },
        // Strategy 2: Front camera with exact resolution
        {
          name: 'Front camera exact',
          constraints: {
            video: {
              facingMode: { exact: 'user' },
              width: { exact: 1280 },
              height: { exact: 720 },
              frameRate: { ideal: 30 }
            }
          }
        },
        // Strategy 3: Any camera with ideal resolution
        {
          name: 'Any camera ideal',
          constraints: {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            }
          }
        },
        // Strategy 4: Front camera with lower resolution
        {
          name: 'Front camera low res',
          constraints: {
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 15 }
            }
          }
        },
        // Strategy 5: Minimal constraints
        {
          name: 'Minimal constraints',
          constraints: {
            video: true
          }
        }
      ];

      // Try each strategy in order
      for (const strategy of strategies) {
        try {
          console.log(`[CAMERA] Trying strategy: ${strategy.name}`);
          const stream = await navigator.mediaDevices.getUserMedia(strategy.constraints);
          this._logStreamInfo(stream);
          return stream;
        } catch (error) {
          console.warn(`[CAMERA] Strategy "${strategy.name}" failed:`, error.message);
          continue;
        }
      }

      // If all strategies fail, throw error
      throw new Error('All camera strategies failed');
      
    } catch (error) {
      console.error('[CAMERA] Enhanced camera request failed:', error);
      
      // Final fallback - try without any constraints
      try {
        console.log('[CAMERA] Using no constraints as final fallback...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {}
        });
        this._logStreamInfo(stream);
        return stream;
      } catch (finalError) {
        console.error('[CAMERA] All camera attempts failed:', finalError);
        throw new Error('Unable to access camera. Please check permissions and try again.');
      }
    }
  }

  /**
   * Log stream information for debugging
   */
  _logStreamInfo(stream) {
    const track = stream.getVideoTracks()[0];
    if (track && track.getSettings) {
      const settings = track.getSettings();
      console.log('[CAMERA] Stream settings:', {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode
      });
    }
  }

  /**
   * Check if camera supports advanced constraints
   */
  async checkCapabilities() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      console.log(`[CAMERA] Found ${videoDevices.length} camera(s)`);
      
      const stream = await this.requestCameraStream();
      const track = stream.getVideoTracks()[0];
      
      if (track && track.getCapabilities) {
        const caps = track.getCapabilities();
        console.log('[CAMERA] Capabilities:', {
          exposureModes: caps.exposureMode,
          focusModes: caps.focusMode,
          whiteBalanceModes: caps.whiteBalanceMode,
          isoRanges: caps.iso
        });
      }
      
      track.stop();
      return true;
      
    } catch (e) {
      console.error('[CAMERA] Capability check failed:', e);
      return false;
    }
  }

  /**
   * Adjust exposure settings at runtime
   */
  adjustExposure(track, settings) {
    if (!track || !track.applyConstraints) {
      console.warn('[CAMERA] Cannot adjust exposure: invalid track');
      return Promise.resolve();
    }
    
    const constraints = { advanced: [] };
    
    if (settings.exposureMode) {
      constraints.advanced.push({ exposureMode: settings.exposureMode });
    }
    if (settings.exposureCompensation !== undefined) {
      constraints.advanced.push({ exposureCompensation: settings.exposureCompensation });
    }
    if (settings.focusMode) {
      constraints.advanced.push({ focusMode: settings.focusMode });
    }
    if (settings.whiteBalanceMode) {
      constraints.advanced.push({ whiteBalanceMode: settings.whiteBalanceMode });
    }
    
    return track.applyConstraints({ advanced: constraints.advanced });
  }
}
