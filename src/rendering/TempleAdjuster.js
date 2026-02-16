/**
 * TempleAdjuster.js
 * 
 * Smooth temple angle animation and adjustment
 */

export class TempleAdjuster {
  constructor() {
    this.currentLeftAngle = 0;
    this.currentRightAngle = 0;
    this.targetLeftAngle = 0;
    this.targetRightAngle = 0;
    this.smoothingFactor = 0.15;
    this.templeGroups = new Map();
  }

  /**
   * Update temple angles based on tracking data
   */
  updateTempleAngles(glassesModel, templeAngle, templeAngleData) {
    try {
      if (!glassesModel) return;
      
      // Find temple groups
      this._findTempleGroups(glassesModel);
      
      // Calculate target angles
      const { leftAngle, rightAngle } = this._calculateTargetAngles(templeAngle, templeAngleData);
      
      this.targetLeftAngle = leftAngle;
      this.targetRightAngle = rightAngle;
      
      // Smooth angle transitions
      this._smoothAngleTransitions();
      
      // Apply angles to temple groups
      this._applyTempleAngles();
      
    } catch (error) {
      console.error('[TEMPLE] Angle adjustment failed:', error);
    }
  }

  /**
   * Find temple groups in the model
   */
  _findTempleGroups(glassesModel) {
    if (this.templeGroups.size > 0) return; // Already found
    
    glassesModel.traverse((child) => {
      if (child.isMesh || child.isGroup) {
        const name = child.name?.toLowerCase() || '';
        
        if (name.includes('temple') || name.includes('ear')) {
          if (name.includes('left') || child.position.x < 0) {
            this.templeGroups.set('left', child);
          } else if (name.includes('right') || child.position.x > 0) {
            this.templeGroups.set('right', child);
          }
        }
      }
    });
    
    console.log(`[TEMPLE] Found ${this.templeGroups.size} temple groups`);
  }

  /**
   * Calculate target angles for temples
   */
  _calculateTargetAngles(baseAngle, angleData) {
    try {
      let leftAngle = baseAngle;
      let rightAngle = baseAngle;
      
      // Adjust based on ear detection data
      if (angleData && angleData.measurements) {
        const { earSpread, normalizedEarSpread, headRoll } = angleData.measurements;
        
        // Asymmetric adjustment based on ear position
        if (normalizedEarSpread > 0.7) {
          // Wide face - increase temple angle
          leftAngle += 2;
          rightAngle += 2;
        } else if (normalizedEarSpread < 0.4) {
          // Narrow face - decrease temple angle
          leftAngle -= 2;
          rightAngle -= 2;
        }
        
        // Adjust for head roll
        if (headRoll !== undefined) {
          const rollAdjustment = headRoll * 5; // Scale roll effect
          leftAngle -= rollAdjustment;
          rightAngle += rollAdjustment;
        }
      }
      
      // Apply constraints
      leftAngle = Math.max(-15, Math.min(25, leftAngle));
      rightAngle = Math.max(-15, Math.min(25, rightAngle));
      
      return { leftAngle, rightAngle };
      
    } catch (error) {
      console.error('[TEMPLE] Angle calculation failed:', error);
      return { leftAngle: baseAngle, rightAngle: baseAngle };
    }
  }

  /**
   * Smooth angle transitions
   */
  _smoothAngleTransitions() {
    this.currentLeftAngle += (this.targetLeftAngle - this.currentLeftAngle) * this.smoothingFactor;
    this.currentRightAngle += (this.targetRightAngle - this.currentRightAngle) * this.smoothingFactor;
  }

  /**
   * Apply angles to temple groups
   */
  _applyTempleAngles() {
    const leftTemple = this.templeGroups.get('left');
    const rightTemple = this.templeGroups.get('right');
    
    if (leftTemple) {
      this._applyTempleRotation(leftTemple, this.currentLeftAngle, 'left');
    }
    
    if (rightTemple) {
      this._applyTempleRotation(rightTemple, this.currentRightAngle, 'right');
    }
  }

  /**
   * Apply rotation to individual temple
   */
  _applyTempleRotation(temple, angle, side) {
    try {
      // Store original rotation if not already stored
      if (!temple.userData.originalRotation) {
        temple.userData.originalRotation = temple.rotation.clone();
      }
      
      const original = temple.userData.originalRotation;
      
      // Apply temple angle rotation (around Y axis for forward/backward tilt)
      const radians = angle * (Math.PI / 180);
      
      if (side === 'left') {
        temple.rotation.y = original.y + radians;
        temple.rotation.z = original.z + radians * 0.3; // Slight Z rotation for natural look
      } else {
        temple.rotation.y = original.y - radians;
        temple.rotation.z = original.z - radians * 0.3;
      }
      
    } catch (error) {
      console.error(`[TEMPLE] Failed to apply ${side} temple rotation:`, error);
    }
  }

  /**
   * Set smoothing factor
   */
  setSmoothingFactor(factor) {
    this.smoothingFactor = Math.max(0.05, Math.min(0.5, factor));
  }

  /**
   * Reset temple angles
   */
  reset() {
    this.currentLeftAngle = 0;
    this.currentRightAngle = 0;
    this.targetLeftAngle = 0;
    this.targetRightAngle = 0;
    
    // Reset temple rotations
    this.templeGroups.forEach((temple) => {
      if (temple.userData.originalRotation) {
        temple.rotation.copy(temple.userData.originalRotation);
      }
    });
    
    console.log('[TEMPLE] Temple angles reset');
  }

  /**
   * Get current temple angles
   */
  getCurrentAngles() {
    return {
      left: this.currentLeftAngle,
      right: this.currentRightAngle,
      target: {
        left: this.targetLeftAngle,
        right: this.targetRightAngle
      }
    };
  }

  /**
   * Animate temple angle to specific value
   */
  animateToAngle(leftAngle, rightAngle, duration = 1000) {
    const startLeft = this.currentLeftAngle;
    const startRight = this.currentRightAngle;
    const startTime = performance.now();
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const eased = 1 - Math.pow(1 - progress, 3);
      
      this.currentLeftAngle = startLeft + (leftAngle - startLeft) * eased;
      this.currentRightAngle = startRight + (rightAngle - startRight) * eased;
      
      this.targetLeftAngle = leftAngle;
      this.targetRightAngle = rightAngle;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.templeGroups.clear();
    console.log('[TEMPLE] Temple adjuster destroyed');
  }
}
