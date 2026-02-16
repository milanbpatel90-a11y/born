/**
 * demo-glasses.js
 * 
 * Fallback demo glasses model generation
 * Creates a procedural 3D glasses model when GLB files are not available
 */

import * as THREE from 'three';

export class DemoGlassesGenerator {
  constructor() {
    this.defaultConfig = {
      frameColor: 0x333333,
      frameMetalness: 0.1,
      frameRoughness: 0.2,
      lensColor: 0xffffff,
      lensTransmission: 0.9,
      lensOpacity: 0.3
    };
  }

  /**
   * Generate demo glasses model
   */
  generateModel(config = {}) {
    const finalConfig = { ...this.defaultConfig, ...config };
    const group = new THREE.Group();
    
    // Create materials
    const frameMaterial = this._createFrameMaterial(finalConfig);
    const lensMaterial = this._createLensMaterial(finalConfig);
    
    // Create frame components
    const leftFrame = this._createFrameCircle(-40, finalConfig, frameMaterial);
    const rightFrame = this._createFrameCircle(40, finalConfig, frameMaterial);
    const bridge = this._createBridge(finalConfig, frameMaterial);
    const leftTemple = this._createTemple(-80, finalConfig, frameMaterial);
    const rightTemple = this._createTemple(80, finalConfig, frameMaterial);
    
    // Create lenses
    const leftLens = this._createLens(-40, finalConfig, lensMaterial);
    const rightLens = this._createLens(40, finalConfig, lensMaterial);
    
    // Add all components to group
    group.add(leftFrame);
    group.add(rightFrame);
    group.add(bridge);
    group.add(leftTemple);
    group.add(rightTemple);
    group.add(leftLens);
    group.add(rightLens);
    
    // Set scale (1 unit = 1mm)
    group.scale.set(1, 1, 1);
    
    // Add metadata
    group.userData = {
      isDemo: true,
      config: finalConfig,
      generatedAt: Date.now()
    };
    
    return group;
  }

  /**
   * Create frame material
   */
  _createFrameMaterial(config) {
    return new THREE.MeshPhysicalMaterial({
      color: config.frameColor,
      metalness: config.frameMetalness,
      roughness: config.frameRoughness,
      clearcoat: 0.3,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
  }

  /**
   * Create lens material
   */
  _createLensMaterial(config) {
    return new THREE.MeshPhysicalMaterial({
      color: config.lensColor,
      metalness: 0,
      roughness: 0,
      transmission: config.lensTransmission,
      transparent: true,
      opacity: config.lensOpacity,
      side: THREE.DoubleSide,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0
    });
  }

  /**
   * Create frame circle (lens rim)
   */
  _createFrameCircle(xOffset, config, material) {
    const shape = new THREE.Shape();
    const radius = 35;
    const thickness = 4;
    
    // Create torus-like shape for frame
    shape.absarc(0, 0, radius + thickness/2, 0, Math.PI * 2, false);
    shape.absarc(0, 0, radius - thickness/2, 0, Math.PI * 2, true);
    
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(xOffset, 0, 0);
    mesh.name = xOffset < 0 ? 'leftFrame' : 'rightFrame';
    
    return mesh;
  }

  /**
   * Create bridge between frames
   */
  _createBridge(config, material) {
    const geometry = new THREE.CylinderGeometry(2, 2, 20, 8);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(0, 0, 0);
    mesh.name = 'bridge';
    
    return mesh;
  }

  /**
   * Create temple (ear piece)
   */
  _createTemple(xOffset, config, material) {
    const group = new THREE.Group();
    
    // Main temple arm
    const armGeometry = new THREE.CylinderGeometry(2, 3, 100, 8);
    const arm = new THREE.Mesh(armGeometry, material);
    arm.position.set(xOffset, 0, -30);
    arm.rotation.z = xOffset < 0 ? Math.PI / 6 : -Math.PI / 6;
    arm.name = xOffset < 0 ? 'leftTemple' : 'rightTemple';
    
    // Temple tip
    const tipGeometry = new THREE.SphereGeometry(4, 8, 6);
    const tip = new THREE.Mesh(tipGeometry, material);
    tip.position.set(xOffset, 0, -80);
    tip.name = xOffset < 0 ? 'leftTempleTip' : 'rightTempleTip';
    
    group.add(arm);
    group.add(tip);
    
    return group;
  }

  /**
   * Create lens
   */
  _createLens(xOffset, config, material) {
    const geometry = new THREE.CircleGeometry(33, 32);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(xOffset, 0, 2);
    mesh.name = xOffset < 0 ? 'leftLens' : 'rightLens';
    
    return mesh;
  }

  /**
   * Generate variant with different style
   */
  generateVariant(style) {
    const configs = {
      aviator: {
        frameColor: 0x8B4513,
        frameMetalness: 0.8,
        frameRoughness: 0.1,
        lensColor: 0x4169E1,
        lensTransmission: 0.7,
        lensOpacity: 0.4
      },
      catEye: {
        frameColor: 0x000000,
        frameMetalness: 0.0,
        frameRoughness: 0.3,
        lensColor: 0x000000,
        lensTransmission: 0.8,
        lensOpacity: 0.2
      },
      sport: {
        frameColor: 0xFF4500,
        frameMetalness: 0.2,
        frameRoughness: 0.4,
        lensColor: 0x000000,
        lensTransmission: 0.6,
        lensOpacity: 0.3
      },
      professional: {
        frameColor: 0x2F4F4F,
        frameMetalness: 0.3,
        frameRoughness: 0.2,
        lensColor: 0xF0F8FF,
        lensTransmission: 0.9,
        lensOpacity: 0.25
      }
    };
    
    return this.generateModel(configs[style] || this.defaultConfig);
  }

  /**
   * Create animated demo glasses
   */
  createAnimatedDemo() {
    const model = this.generateModel();
    
    // Add animation data
    model.userData.animation = {
      rotate: true,
      float: true,
      speed: 0.01
    };
    
    return model;
  }

  /**
   * Update animation for demo model
   */
  updateAnimation(model, time) {
    if (!model.userData.animation) return;
    
    const { rotate, float, speed } = model.userData.animation;
    
    if (rotate) {
      model.rotation.y = Math.sin(time * speed) * 0.1;
    }
    
    if (float) {
      model.position.y = Math.sin(time * speed * 2) * 5;
    }
  }

  /**
   * Export model as JSON (for saving)
   */
  exportModel(model) {
    const json = {
      config: model.userData.config,
      metadata: {
        isDemo: model.userData.isDemo,
        generatedAt: model.userData.generatedAt,
        version: '5.0'
      },
      geometry: this._serializeGeometry(model),
      materials: this._serializeMaterials(model)
    };
    
    return JSON.stringify(json, null, 2);
  }

  /**
   * Serialize geometry data
   */
  _serializeGeometry(model) {
    const geometries = {};
    
    model.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry;
        geometries[child.name] = {
          type: geo.type,
          data: geo.toJSON()
        };
      }
    });
    
    return geometries;
  }

  /**
   * Serialize material data
   */
  _serializeMaterials(model) {
    const materials = {};
    
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = child.material;
        materials[child.name] = {
          type: mat.type,
          color: mat.color?.getHex(),
          metalness: mat.metalness,
          roughness: mat.roughness,
          transmission: mat.transmission,
          opacity: mat.opacity
        };
      }
    });
    
    return materials;
  }
}

// Create singleton instance
export const demoGlassesGenerator = new DemoGlassesGenerator();
