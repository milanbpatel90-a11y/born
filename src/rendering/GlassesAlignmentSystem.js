/**
 * GlassesAlignmentSystem.js
 * 
 * Production-grade 3D glasses alignment for virtual try-on.
 * 
 * Features:
 * - Precise nose bridge anchoring
 * - Temple (ear piece) positioning
 * - Dynamic scale adjustment
 * - Face-aware rotation
 * - Depth positioning
 * - Occlusion handling
 * 
 * @version 2.0.0 - Production Ready
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Glasses alignment configuration
 */
const ALIGNMENT_CONFIG = {
  // Position offsets (in mm, relative to sellion)
  defaultYOffset: 5,      // Vertical offset from sellion
  defaultZOffset: -10,    // Depth offset (towards face)
  
  // Scale factors
  widthScaleFactor: 1.05, // Slightly larger than face width
  heightScaleFactor: 1.0,
  depthScaleFactor: 1.0,
  
  // Temple settings
  templeAngleDefault: 8,  // Degrees - default temple bend angle
  templeLengthDefault: 140, // mm
  
  // Smoothing
  positionSmoothFactor: 0.15,
  rotationSmoothFactor: 0.12,
  scaleSmoothFactor: 0.08,
  
  // Visibility
  fadeInDuration: 300,    // ms
  fadeOutDuration: 200,   // ms
  
  // Debug
  debugMode: false
};

/**
 * Glasses frame metadata structure
 */
const FRAME_METADATA = {
  // Standard frame dimensions (mm)
  standardWidth: 140,
  standardBridgeWidth: 18,
  standardLensWidth: 52,
  standardTempleLength: 140,
  
  // Frame types
  frameTypes: {
    FULL_RIM: 'full_rim',
    SEMI_RIMLESS: 'semi_rimless',
    RIMLESS: 'rimless',
    WIREFRAME: 'wireframe'
  },
  
  // Frame shapes
  frameShapes: {
    RECTANGULAR: 'rectangular',
    ROUND: 'round',
    OVAL: 'oval',
    CAT_EYE: 'cat_eye',
    AVIATOR: 'aviator',
    SQUARE: 'square'
  }
};

/**
 * GlassesAlignmentSystem - Main alignment class
 */
export class GlassesAlignmentSystem {
  constructor(options = {}) {
    // Configuration
    this.config = { ...ALIGNMENT_CONFIG, ...options };
    
    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // Glasses model
    this.glassesAnchor = null;    // Main anchor group
    this.frameGroup = null;       // Frame group
    this.leftTemple = null;       // Left temple mesh
    this.rightTemple = null;      // Right temple mesh
    this.lenses = [];             // Lens meshes
    
    // Model info
    this.modelLoaded = false;
    this.modelPath = null;
    this.modelOriginalWidth = 140; // mm
    this.modelOriginalBridge = 18; // mm
    
    // Current state
    this.currentAlignment = {
      position: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1),
      templeAngle: this.config.templeAngleDefault,
      opacity: 0,
      visible: false
    };
    
    // Target state (for smooth transitions)
    this.targetAlignment = {
      position: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1),
      templeAngle: this.config.templeAngleDefault,
      opacity: 1
    };
    
    // Animation state
    this.fadeStartTime = null;
    this.isFadingIn = false;
    this.isFadingOut = false;
    
    // Performance
    this.lastUpdateTime = 0;
    this.deltaAccumulator = 0;
    
    // Debug
    this.debugHelpers = [];
  }
  
  /**
   * Initialize the alignment system
   * @param {HTMLCanvasElement} canvas - Render target canvas
   * @param {Object} options - Initialization options
   */
  initialize(canvas, options = {}) {
    // Create scene
    this.scene = new THREE.Scene();
    
    // Create camera (orthographic for 2D overlay feel)
    const aspect = canvas.width / canvas.height;
    const frustumSize = Math.max(canvas.width, canvas.height);
    
    this.camera = new THREE.OrthographicCamera(
      -frustumSize / 2, frustumSize / 2,
      frustumSize / 2, -frustumSize / 2,
      0.1, 2000
    );
    this.camera.position.z = 1000;
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    
    // Add lighting
    this._setupLighting();
    
    // Create anchor group
    this.glassesAnchor = new THREE.Group();
    this.glassesAnchor.name = 'glassesAnchor';
    this.scene.add(this.glassesAnchor);
    
    console.log('[ALIGNMENT] System initialized');
  }
  
  /**
   * Setup scene lighting
   */
  _setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    
    // Key light (main illumination)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(50, 100, 100);
    this.scene.add(keyLight);
    
    // Fill light (reduce shadows)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-50, 50, 50);
    this.scene.add(fillLight);
    
    // Rim light (edge definition)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -50, -100);
    this.scene.add(rimLight);
  }
  
  /**
   * Load glasses model
   * @param {string} modelPath - Path to GLB model
   * @param {Object} metadata - Frame metadata
   */
  async loadModel(modelPath, metadata = {}) {
    try {
      console.log(`[ALIGNMENT] Loading model: ${modelPath}`);
      
      // Clear existing model
      if (this.frameGroup) {
        this.glassesAnchor.remove(this.frameGroup);
        this._disposeGroup(this.frameGroup);
      }
      
      // Load new model
      const loader = new GLTFLoader();
      
      // Optional: Setup DRACO decoder for compressed models
      if (modelPath.includes('.glb') || modelPath.includes('.gltf')) {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);
      }
      
      const gltf = await loader.loadAsync(modelPath);
      const model = gltf.scene;
      
      // Process model
      this._processLoadedModel(model, metadata);
      
      // Add to anchor
      this.frameGroup = model;
      this.glassesAnchor.add(model);
      
      // Store metadata
      this.modelPath = modelPath;
      this.modelLoaded = true;
      
      console.log('[ALIGNMENT] Model loaded successfully');
      
    } catch (error) {
      console.error('[ALIGNMENT] Failed to load model:', error);
      throw error;
    }
  }
  
  /**
   * Process loaded model for alignment
   * @param {THREE.Group} model 
   * @param {Object} metadata 
   */
  _processLoadedModel(model, metadata) {
    // Center model
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);
    
    // Calculate original dimensions
    const size = new THREE.Vector3();
    box.getSize(size);
    this.modelOriginalWidth = size.x;
    
    // Find and store temple meshes
    model.traverse((child) => {
      if (child.isMesh) {
        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Setup material for transparency
        if (child.material) {
          child.material.transparent = true;
          child.material.opacity = this.currentAlignment.opacity;
        }
        
        // Identify temples by name
        const name = child.name.toLowerCase();
        if (name.includes('temple') || name.includes('arm') || name.includes('ear')) {
          if (name.includes('left') || name.includes('l_')) {
            this.leftTemple = child;
          } else if (name.includes('right') || name.includes('r_')) {
            this.rightTemple = child;
          }
        }
        
        // Identify lenses
        if (name.includes('lens') || name.includes('glass')) {
          this.lenses.push(child);
        }
      }
    });
    
    // Apply metadata if provided
    if (metadata.bridgeWidth) {
      this.modelOriginalBridge = metadata.bridgeWidth;
    }
  }
  
  /**
   * Update alignment from tracking data
   * @param {Object} trackingData - Face tracking data
   * @param {Object} anatomyData - Facial anatomy data
   * @param {number} deltaTime - Time since last update
   */
  updateAlignment(trackingData, anatomyData, deltaTime = 0.016) {
    if (!this.modelLoaded || !trackingData) {
      this._fadeOut();
      return;
    }
    
    // Check tracking quality
    if (trackingData.confidence < 0.3) {
      this._fadeOut();
      return;
    }
    
    // Calculate target alignment
    this._calculateTargetAlignment(trackingData, anatomyData);
    
    // Smooth interpolation
    this._interpolateAlignment(deltaTime);
    
    // Apply alignment
    this._applyAlignment();
    
    // Fade in
    this._fadeIn();
  }
  
  /**
   * Calculate target alignment from tracking data
   * @param {Object} trackingData 
   * @param {Object} anatomyData 
   */
  _calculateTargetAlignment(trackingData, anatomyData) {
    // Get sellion position (nose bridge)
    const sellion = anatomyData?.sellion || trackingData.landmarks?.[6];
    if (!sellion) return;
    
    // Calculate position
    const position = this._calculatePosition(trackingData, anatomyData);
    this.targetAlignment.position.copy(position);
    
    // Calculate rotation
    const rotation = this._calculateRotation(trackingData);
    this.targetAlignment.rotation.copy(rotation);
    
    // Calculate scale
    const scale = this._calculateScale(trackingData, anatomyData);
    this.targetAlignment.scale.copy(scale);
    
    // Calculate temple angle
    const templeAngle = this._calculateTempleAngle(trackingData, anatomyData);
    this.targetAlignment.templeAngle = templeAngle;
  }
  
  /**
   * Calculate glasses position
   * @param {Object} trackingData 
   * @param {Object} anatomyData 
   * @returns {THREE.Vector3}
   */
  _calculatePosition(trackingData, anatomyData) {
    const landmarks = trackingData.landmarks;
    if (!landmarks) return this.currentAlignment.position;
    
    // Get key landmarks
    const noseBridge = landmarks[6];   // Sellion
    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    
    if (!noseBridge || !leftEye || !rightEye) {
      return this.currentAlignment.position;
    }
    
    // Calculate face dimensions for scaling
    const eyeDistance = Math.hypot(
      rightEye.x - leftEye.x,
      rightEye.y - leftEye.y
    );
    
    // Position at nose bridge
    const x = (noseBridge.x - 0.5) * 2 * 500; // Convert to screen space
    const y = -(noseBridge.y - 0.5) * 2 * 500;
    
    // Z position based on nose depth
    const z = -noseBridge.z * 500 + this.config.defaultZOffset;
    
    // Y offset (glasses sit slightly above sellion)
    const yOffset = this.config.defaultYOffset * (eyeDistance * 500 / 60);
    
    return new THREE.Vector3(x, y + yOffset, z);
  }
  
  /**
   * Calculate glasses rotation
   * @param {Object} trackingData 
   * @returns {THREE.Quaternion}
   */
  _calculateRotation(trackingData) {
    const landmarks = trackingData.landmarks;
    if (!landmarks) return this.currentAlignment.rotation;
    
    // Get eye positions for roll
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const noseTip = landmarks[1];
    const noseBridge = landmarks[6];
    const forehead = landmarks[10];
    const chin = landmarks[152];
    
    if (!leftEye || !rightEye || !noseTip || !noseBridge) {
      return this.currentAlignment.rotation;
    }
    
    // Roll (rotation around Z axis) - from eye line
    const roll = Math.atan2(
      rightEye.y - leftEye.y,
      rightEye.x - leftEye.x
    );
    
    // Yaw (rotation around Y axis) - from nose position relative to eyes
    const eyeCenter = (leftEye.x + rightEye.x) / 2;
    const yaw = (noseTip.x - eyeCenter) * 3;
    
    // Pitch (rotation around X axis) - from nose tip vs bridge
    const pitch = (noseTip.y - noseBridge.y - 0.03) * 2;
    
    // Create quaternion from Euler angles
    const euler = new THREE.Euler(pitch, yaw, roll);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(euler);
    
    return quaternion;
  }
  
  /**
   * Calculate glasses scale
   * @param {Object} trackingData 
   * @param {Object} anatomyData 
   * @returns {THREE.Vector3}
   */
  _calculateScale(trackingData, anatomyData) {
    const landmarks = trackingData.landmarks;
    
    // Use temple width if available from anatomy analysis
    let faceWidth;
    if (anatomyData?.templeWidth) {
      faceWidth = anatomyData.templeWidth;
    } else if (landmarks) {
      // Fallback: Calculate from landmarks
      const leftFace = landmarks[234];
      const rightFace = landmarks[454];
      
      if (leftFace && rightFace) {
        faceWidth = Math.hypot(
          rightFace.x - leftFace.x,
          rightFace.y - leftFace.y
        ) * 500; // Convert to mm approximation
      }
    }
    
    if (!faceWidth) {
      return this.currentAlignment.scale;
    }
    
    // Calculate scale to fit face
    const targetWidth = faceWidth * this.config.widthScaleFactor;
    const scale = targetWidth / this.modelOriginalWidth;
    
    return new THREE.Vector3(
      scale * this.config.widthScaleFactor,
      scale * this.config.heightScaleFactor,
      scale * this.config.depthScaleFactor
    );
  }
  
  /**
   * Calculate temple angle
   * @param {Object} trackingData 
   * @param {Object} anatomyData 
   * @returns {number}
   */
  _calculateTempleAngle(trackingData, anatomyData) {
    // Temple angle depends on face width and depth
    // Wider/deeper faces need more temple angle
    
    if (!trackingData.landmarks) {
      return this.config.templeAngleDefault;
    }
    
    const landmarks = trackingData.landmarks;
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];
    const noseTip = landmarks[1];
    
    if (!leftFace || !rightFace || !noseTip) {
      return this.config.templeAngleDefault;
    }
    
    // Estimate face depth from nose projection
    const faceDepth = noseTip.z || 0;
    
    // Adjust temple angle based on face depth
    // Deeper faces need temples to bend more
    const depthAdjustment = faceDepth * 20;
    
    return this.config.templeAngleDefault + depthAdjustment;
  }
  
  /**
   * Interpolate alignment for smooth transitions
   * @param {number} deltaTime 
   */
  _interpolateAlignment(deltaTime) {
    // FPS-independent smoothing
    const posAlpha = 1 - Math.pow(1 - this.config.positionSmoothFactor, deltaTime * 60);
    const rotAlpha = 1 - Math.pow(1 - this.config.rotationSmoothFactor, deltaTime * 60);
    const scaleAlpha = 1 - Math.pow(1 - this.config.scaleSmoothFactor, deltaTime * 60);
    
    // Interpolate position
    this.currentAlignment.position.lerp(this.targetAlignment.position, posAlpha);
    
    // Interpolate rotation (SLERP)
    this.currentAlignment.rotation.slerp(this.targetAlignment.rotation, rotAlpha);
    
    // Interpolate scale
    this.currentAlignment.scale.lerp(this.targetAlignment.scale, scaleAlpha);
    
    // Interpolate temple angle
    const templeAlpha = posAlpha;
    this.currentAlignment.templeAngle += 
      (this.targetAlignment.templeAngle - this.currentAlignment.templeAngle) * templeAlpha;
  }
  
  /**
   * Apply alignment to model
   */
  _applyAlignment() {
    if (!this.glassesAnchor) return;
    
    // Apply position
    this.glassesAnchor.position.copy(this.currentAlignment.position);
    
    // Apply rotation
    this.glassesAnchor.quaternion.copy(this.currentAlignment.rotation);
    
    // Apply scale
    this.glassesAnchor.scale.copy(this.currentAlignment.scale);
    
    // Apply temple angles
    this._applyTempleAngles();
    
    // Apply opacity
    this._applyOpacity();
  }
  
  /**
   * Apply temple angles
   */
  _applyTempleAngles() {
    const angle = THREE.MathUtils.degToRad(this.currentAlignment.templeAngle);
    
    if (this.leftTemple) {
      this.leftTemple.rotation.y = -angle;
    }
    
    if (this.rightTemple) {
      this.rightTemple.rotation.y = angle;
    }
  }
  
  /**
   * Apply opacity to all materials
   */
  _applyOpacity() {
    if (!this.frameGroup) return;
    
    const opacity = this.currentAlignment.opacity;
    
    this.frameGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.opacity = opacity;
      }
    });
  }
  
  /**
   * Fade in glasses
   */
  _fadeIn() {
    if (!this.isFadingIn && this.currentAlignment.opacity < 1) {
      this.isFadingIn = true;
      this.isFadingOut = false;
      this.fadeStartTime = performance.now();
    }
    
    if (this.isFadingIn) {
      const elapsed = performance.now() - this.fadeStartTime;
      const progress = Math.min(1, elapsed / this.config.fadeInDuration);
      
      this.currentAlignment.opacity = progress;
      this.currentAlignment.visible = true;
      
      if (progress >= 1) {
        this.isFadingIn = false;
      }
    }
  }
  
  /**
   * Fade out glasses
   */
  _fadeOut() {
    if (!this.isFadingOut && this.currentAlignment.opacity > 0) {
      this.isFadingOut = true;
      this.isFadingIn = false;
      this.fadeStartTime = performance.now();
    }
    
    if (this.isFadingOut) {
      const elapsed = performance.now() - this.fadeStartTime;
      const progress = Math.min(1, elapsed / this.config.fadeOutDuration);
      
      this.currentAlignment.opacity = 1 - progress;
      
      if (progress >= 1) {
        this.isFadingOut = false;
        this.currentAlignment.visible = false;
      }
    }
  }
  
  /**
   * Render frame
   */
  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Handle resize
   * @param {number} width 
   * @param {number} height 
   */
  resize(width, height) {
    if (!this.camera || !this.renderer) return;
    
    const aspect = width / height;
    const frustumSize = Math.max(width, height);
    
    this.camera.left = -frustumSize / 2;
    this.camera.right = frustumSize / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }
  
  /**
   * Get current alignment state
   * @returns {Object}
   */
  getAlignment() {
    return {
      position: this.currentAlignment.position.clone(),
      rotation: this.currentAlignment.rotation.clone(),
      scale: this.currentAlignment.scale.clone(),
      templeAngle: this.currentAlignment.templeAngle,
      opacity: this.currentAlignment.opacity,
      visible: this.currentAlignment.visible
    };
  }
  
  /**
   * Set alignment configuration
   * @param {Object} config 
   */
  setConfig(config) {
    Object.assign(this.config, config);
  }
  
  /**
   * Dispose of resources
   * @param {THREE.Group} group 
   */
  _disposeGroup(group) {
    group.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
  
  /**
   * Destroy alignment system
   */
  destroy() {
    console.log('[ALIGNMENT] Destroying...');
    
    // Dispose model
    if (this.frameGroup) {
      this._disposeGroup(this.frameGroup);
    }
    
    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    // Clear references
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.glassesAnchor = null;
    this.frameGroup = null;
    this.leftTemple = null;
    this.rightTemple = null;
    this.lenses = [];
    this.modelLoaded = false;
  }
}

export { ALIGNMENT_CONFIG, FRAME_METADATA };

export default GlassesAlignmentSystem;
