import * as THREE from 'three';

/**
 * PoseStabilizer.js
 * Commercial-grade smoothing for AR Try-On
 * Implements: EMA Position, SLERP Rotation, Scale Inertia, Velocity Prediction
 */
export class PoseStabilizer {

    constructor() {
        // State
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.scale = new THREE.Vector3(1, 1, 1);

        // Physics
        this.velocity = new THREE.Vector3();
        this.lastPosition = new THREE.Vector3();
        
        this.initialized = false;
        
        // Configuration
        this.predictionFactor = 0.6; // Tune for lag compensation
    }

    /**
     * Update the stabilizer with a new raw target pose
     * @param {THREE.Vector3} targetPos 
     * @param {THREE.Quaternion} targetRot 
     * @param {THREE.Vector3} targetScale 
     * @param {number} delta Time delta in seconds (for FPS independence)
     */
    update(targetPos, targetRot, targetScale, delta) {
        if (!this.initialized) {
            this.position.copy(targetPos);
            this.rotation.copy(targetRot);
            this.scale.copy(targetScale);
            this.lastPosition.copy(targetPos);
            this.initialized = true;
            return;
        }

        // FPS Independent Smoothing Factors
        // Derived from: strength = 1 - 0.001^delta
        // Higher base = faster convergence
        const kPos = 1 - Math.pow(0.001, delta);
        const kRot = 1 - Math.pow(0.0005, delta);
        const kScale = 1 - Math.pow(0.01, delta); // High inertia for scale

        // 1. Position Smoothing (EMA)
        this.position.lerp(targetPos, kPos);

        // 2. Rotation Smoothing (SLERP - Critical for 3D)
        this.rotation.slerp(targetRot, kRot);

        // 3. Scale Inertia
        this.scale.lerp(targetScale, kScale);

        // 4. Motion Prediction / Velocity Compensation
        // Calculates delta movement to "guess" where head will be next frame
        this.velocity.subVectors(this.position, this.lastPosition);
        // Apply prediction
        this.position.addScaledVector(this.velocity, this.predictionFactor);
        
        // Update history
        this.lastPosition.copy(this.position);
    }
}
