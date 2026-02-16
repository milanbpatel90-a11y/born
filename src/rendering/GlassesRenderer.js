/**
 * GlassesRenderer.js
 * 
 * Three.js renderer with temple groups and dynamic adjustment
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TempleAdjuster } from './TempleAdjuster.js';

export class GlassesRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.glassesModel = null;
    this.templeAdjuster = null;
    
    this.currentFrameId = 'glasses2';
    this.isVisible = false;
    this.opacity = 0;
    this.targetOpacity = 1;
    
    this._initializeRenderer();
    this._initializeScene();
    this._initializeLighting();
    this._initializeTempleAdjuster();
  }

  /**
   * Initialize Three.js renderer
   */
  _initializeRenderer() {
    try {
      // Check if canvas already has a context and handle it
      let gl = null;
      try {
        gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
      } catch (e) {
        console.warn('[RENDERER] Could not get existing context:', e.message);
      }

      // Create renderer with proper context handling
      const rendererOptions = {
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      };

      // If there's an existing context, try to use it
      if (gl) {
        console.log('[RENDERER] Using existing WebGL context');
        rendererOptions.context = gl;
      }

      this.renderer = new THREE.WebGLRenderer(rendererOptions);
      
      this.renderer.setSize(this.canvas.width, this.canvas.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      console.log('[RENDERER] Three.js renderer initialized successfully');
      
    } catch (error) {
      console.error('[RENDERER] Failed to initialize renderer:', error);
      
      // Try fallback renderer without antialias
      try {
        console.log('[RENDERER] Trying fallback renderer without antialias...');
        this.renderer = new THREE.WebGLRenderer({ 
          canvas: this.canvas,
          alpha: true,
          antialias: false
        });
        
        this.renderer.setSize(this.canvas.width, this.canvas.height);
        this.renderer.setPixelRatio(1); // Use lower pixel ratio for fallback
        this.renderer.setClearColor(0x000000, 0);
        
        console.log('[RENDERER] Fallback renderer initialized');
        
      } catch (fallbackError) {
        console.error('[RENDERER] Fallback renderer also failed:', fallbackError);
        throw new Error('WebGL not supported or canvas context conflict');
      }
    }
  }

  /**
   * Initialize 3D scene
   */
  _initializeScene() {
    this.scene = new THREE.Scene();
    
    // Create camera
    const aspect = this.canvas.width / this.canvas.height;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 1, 2000);
    this.camera.position.z = 500;
    
    console.log('[RENDERER] Scene initialized');
  }

  /**
   * Initialize lighting for realistic rendering
   */
  _initializeLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    // Directional light for shadows and depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    this.scene.add(directionalLight);
    
    // Fill light for better detail
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-100, -50, -50);
    this.scene.add(fillLight);
    
    console.log('[RENDERER] Lighting initialized');
  }

  /**
   * Initialize temple adjuster
   */
  _initializeTempleAdjuster() {
    this.templeAdjuster = new TempleAdjuster();
  }

  /**
   * Load glasses model
   */
  async loadModel(frameId) {
    try {
      console.log(`[RENDERER] Loading frame model: ${frameId}`);
      
      // Remove existing model
      if (this.glassesModel) {
        this.scene.remove(this.glassesModel);
        this._disposeModel(this.glassesModel);
      }
      
      // Load new model
      this.glassesModel = await this._loadModel(frameId);
      
      if (this.glassesModel) {
        this.scene.add(this.glassesModel);
        this.currentFrameId = frameId;
        this.isVisible = true;
        
        console.log(`[RENDERER] ✅ Model loaded: ${frameId}`);
      }
      
    } catch (error) {
      console.error(`[RENDERER] Failed to load model ${frameId}:`, error);
      // Fallback only to glasses2 model
      if (frameId !== 'glasses2') {
        await this.loadModel('glasses2');
      }
    }
  }

  /**
   * Load model from file or create demo
   */
  async _loadModel(frameId) {
    if (frameId === 'demo') {
      return this._createModelAnchor(this._createDemoModel());
    }
    
    try {
      // Try to load GLB model
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(`./assets/models/${frameId}/${frameId}.glb`);
      
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Enable transparency if needed
          if (child.material) {
            child.material.transparent = true;
            child.material.opacity = 0.9;
          }
        }
      });

      this._normalizeModelDimensions(model);
      
      return this._createModelAnchor(model);
      
    } catch (error) {
      console.warn(`[RENDERER] GLB model not found, creating demo: ${error.message}`);
      return this._createModelAnchor(this._createDemoModel());
    }
  }

  /**
   * Normalize model size and center so arbitrary GLB files align better to face tracking.
   */
  _normalizeModelDimensions(model) {
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const width = Math.max(size.x, 1);
    const targetWidthMm = 145;
    const uniformScale = targetWidthMm / width;
    model.scale.multiplyScalar(uniformScale);
  }

  _createModelAnchor(model) {
    const anchor = new THREE.Group();
    anchor.name = 'glassesAnchor';
    anchor.add(model);
    return anchor;
  }

  /**
   * Create demo glasses model
   */
  _createDemoModel() {
    const group = new THREE.Group();
    
    // Frame material
    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x333333,
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 0.3,
      transparent: true,
      opacity: 0.9
    });
    
    // Lens material
    const lensMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0,
      transmission: 0.9,
      transparent: true,
      opacity: 0.3
    });
    
    // Create frame parts
    const frameGeometry = new THREE.TorusGeometry(80, 4, 8, 100);
    const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    leftFrame.position.set(-40, 0, 0);
    leftFrame.rotation.z = Math.PI / 2;
    
    const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
    rightFrame.position.set(40, 0, 0);
    rightFrame.rotation.z = Math.PI / 2;
    
    // Create lenses
    const lensGeometry = new THREE.CircleGeometry(35, 32);
    const leftLens = new THREE.Mesh(lensGeometry, lensMaterial);
    leftLens.position.set(-40, 0, 2);
    
    const rightLens = new THREE.Mesh(lensGeometry, lensMaterial);
    rightLens.position.set(40, 0, 2);
    
    // Create bridge
    const bridgeGeometry = new THREE.CylinderGeometry(2, 2, 20, 8);
    const bridge = new THREE.Mesh(bridgeGeometry, frameMaterial);
    bridge.rotation.z = Math.PI / 2;
    
    // Create temples (ear pieces)
    const templeGeometry = new THREE.CylinderGeometry(2, 3, 100, 8);
    
    const leftTemple = new THREE.Mesh(templeGeometry, frameMaterial);
    leftTemple.position.set(-80, 0, -30);
    leftTemple.rotation.z = Math.PI / 6;
    leftTemple.name = 'leftTemple';
    
    const rightTemple = new THREE.Mesh(templeGeometry, frameMaterial);
    rightTemple.position.set(80, 0, -30);
    rightTemple.rotation.z = -Math.PI / 6;
    rightTemple.name = 'rightTemple';
    
    // Add all parts to group
    group.add(leftFrame);
    group.add(rightFrame);
    group.add(leftLens);
    group.add(rightLens);
    group.add(bridge);
    group.add(leftTemple);
    group.add(rightTemple);
    
    // Set scale (1 unit = 1mm)
    group.scale.set(1, 1, 1);
    
    console.log('[RENDERER] Demo model created');
    return group;
  }

  /**
   * Update glasses from tracking data
   */
  updateFromTrackingData(trackingData) {
    if (!this.glassesModel || !trackingData) return;
    
    try {
      // Update position and rotation
      this._updateTransform(trackingData);
      
      // Update scale
      this._updateScale(trackingData);
      
      // Update temple angles
      this._updateTempleAngles(trackingData);
      
      // Update opacity
      this._updateOpacity(trackingData);
      
      // Render frame
      this.renderer.render(this.scene, this.camera);
      
    } catch (error) {
      console.error('[RENDERER] Update failed:', error);
    }
  }

  /**
   * Update model transform
   */
  _updateTransform(trackingData) {
    const { rvec, tvec, sellionOffset } = trackingData;
    
    if (!rvec || !tvec || !sellionOffset) return;
    
    // Convert rotation vector to quaternion
    const quaternion = new THREE.Quaternion();
    const angle = Math.hypot(rvec[0], rvec[1], rvec[2]);
    if (angle > 1e-6) {
      const axis = new THREE.Vector3(
        rvec[0] / angle,
        rvec[1] / angle,
        rvec[2] / angle
      );
      quaternion.setFromAxisAngle(axis, angle);
    } else {
      quaternion.identity();
    }
    
    // Position glasses at sellion offset
    const position = new THREE.Vector3(
      sellionOffset.x * this.canvas.width - this.canvas.width / 2,
      -(sellionOffset.y * this.canvas.height - this.canvas.height / 2),
      sellionOffset.z * 100
    );
    
    // Apply transform
    this.glassesModel.position.copy(position);
    this.glassesModel.quaternion.copy(quaternion);
  }

  /**
   * Update model scale
   */
  _updateScale(trackingData) {
    const { scale } = trackingData;
    if (!scale) return;
    
    this.glassesModel.scale.set(scale.x, scale.y, scale.z);
  }

  /**
   * Update temple angles
   */
  _updateTempleAngles(trackingData) {
    const { templeAngle, templeAngleData } = trackingData;
    if (templeAngle == null || !this.templeAdjuster) return;
    
    this.templeAdjuster.updateTempleAngles(this.glassesModel, templeAngle, templeAngleData);
  }

  /**
   * Update opacity for smooth transitions
   */
  _updateOpacity(trackingData) {
    const { effectiveConfidence } = trackingData;
    
    if (effectiveConfidence > 0.5) {
      this.targetOpacity = 1;
    } else {
      this.targetOpacity = effectiveConfidence * 2;
    }
    
    // Smooth opacity transition
    this.opacity += (this.targetOpacity - this.opacity) * 0.1;
    
    if (this.glassesModel) {
      this.glassesModel.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = this.opacity;
        }
      });
    }
  }

  /**
   * Fade out glasses
   */
  fadeOut() {
    this.targetOpacity = 0;
  }

  /**
   * Dispose of model resources
   */
  _disposeModel(model) {
    model.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  /**
   * Handle window resize
   */
  onResize(width, height) {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    console.log('[RENDERER] Destroying...');
    
    if (this.glassesModel) {
      this._disposeModel(this.glassesModel);
      this.scene.remove(this.glassesModel);
    }
    
    if (this.templeAdjuster) {
      this.templeAdjuster.destroy();
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
