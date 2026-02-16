/**
 * earDetection.js
 * 
 * Temple angle calculation from ear landmarks (v5.0 feature)
 */

export const EAR_CONFIG = {
  DEFAULT_TEMPLE_ANGLE: 8.5,    // Default temple angle in degrees
  MIN_TEMPLE_ANGLE: 0,          // Minimum temple angle
  MAX_TEMPLE_ANGLE: 25,         // Maximum temple angle
  SMOOTHING_FACTOR: 0.3,        // Angle smoothing
  CONFIDENCE_THRESHOLD: 0.6     // Minimum confidence for ear detection
};

/**
 * Compute temple angle from ear landmarks and head pose
 */
export function computeTempleAngle(poseLandmarks, headPose = {}) {
  try {
    if (!poseLandmarks) {
      // Fallback to default angle when no ear data
      return {
        angle: EAR_CONFIG.DEFAULT_TEMPLE_ANGLE,
        confidence: 0.3,
        hasEars: false,
        method: 'fallback'
      };
    }
    
    // Holistic ear landmarks
    const leftEar = poseLandmarks[7]; // Left ear
    const rightEar = poseLandmarks[8]; // Right ear
    const leftShoulder = poseLandmarks[11]; // Left shoulder
    const rightShoulder = poseLandmarks[12]; // Right shoulder
    
    if (!leftEar || !rightEar || !leftShoulder || !rightShoulder) {
      return {
        angle: EAR_CONFIG.DEFAULT_TEMPLE_ANGLE,
        confidence: 0.2,
        hasEars: false,
        method: 'missing_landmarks'
      };
    }
    
    // Calculate ear positions relative to head center
    const earSpread = Math.abs(rightEar.x - leftEar.x);
    const earHeight = (leftEar.y + rightEar.y) / 2;
    
    // Calculate shoulder width for reference
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    
    // Normalize ear spread by shoulder width
    const normalizedEarSpread = earSpread / shoulderWidth;
    
    // Calculate temple angle based on ear position and head roll
    let baseAngle = _calculateBaseTempleAngle(normalizedEarSpread, earHeight);
    
    // Adjust for head roll
    if (headPose.roll !== undefined) {
      baseAngle += _adjustForHeadRoll(headPose.roll);
    }
    
    // Apply constraints
    const constrainedAngle = Math.max(
      EAR_CONFIG.MIN_TEMPLE_ANGLE,
      Math.min(EAR_CONFIG.MAX_TEMPLE_ANGLE, baseAngle)
    );
    
    // Calculate confidence based on landmark visibility
    const confidence = _calculateEarConfidence(poseLandmarks, normalizedEarSpread);
    
    return {
      angle: constrainedAngle,
      confidence: confidence,
      hasEars: confidence > EAR_CONFIG.CONFIDENCE_THRESHOLD,
      method: 'ear_detection',
      measurements: {
        earSpread,
        normalizedEarSpread,
        earHeight,
        shoulderWidth,
        headRoll: headPose.roll || 0
      }
    };
    
  } catch (error) {
    console.error('[EAR] Temple angle calculation failed:', error);
    return {
      angle: EAR_CONFIG.DEFAULT_TEMPLE_ANGLE,
      confidence: 0.1,
      hasEars: false,
      method: 'error'
    };
  }
}

/**
 * Calculate base temple angle from ear measurements
 */
function _calculateBaseTempleAngle(normalizedEarSpread, earHeight) {
  // Base angle calculation based on ear spread
  // Wider ear spread = larger temple angle
  let angle = EAR_CONFIG.DEFAULT_TEMPLE_ANGLE;
  
  if (normalizedEarSpread > 0.8) {
    angle += 6; // Wide face
  } else if (normalizedEarSpread > 0.6) {
    angle += 3; // Medium face
  } else {
    angle -= 2; // Narrow face
  }
  
  // Adjust for ear height (higher ears = slightly different angle)
  if (earHeight < 0.4) {
    angle += 1; // High ears
  } else if (earHeight > 0.6) {
    angle -= 1; // Low ears
  }
  
  return angle;
}

/**
 * Adjust temple angle for head roll
 */
function _adjustForHeadRoll(roll) {
  // Convert roll to degrees
  const rollDegrees = roll * (180 / Math.PI);
  
  // Small adjustment based on head tilt
  // Positive roll (right tilt) = slight angle increase
  // Negative roll (left tilt) = slight angle decrease
  return rollDegrees * 0.1; // 10% of roll angle
}

/**
 * Calculate confidence for ear detection
 */
function _calculateEarConfidence(poseLandmarks, normalizedEarSpread) {
  try {
    const leftEar = poseLandmarks[7];
    const rightEar = poseLandmarks[8];
    
    // Base confidence from landmark visibility
    let confidence = Math.min(
      leftEar.visibility || 0.5,
      rightEar.visibility || 0.5
    );
    
    // Adjust confidence based on ear spread consistency
    if (normalizedEarSpread > 0.3 && normalizedEarSpread < 1.2) {
      confidence *= 1.2; // Boost confidence for realistic measurements
    } else {
      confidence *= 0.7; // Reduce confidence for unusual measurements
    }
    
    // Check for ear symmetry
    const earHeightDiff = Math.abs(leftEar.y - rightEar.y);
    if (earHeightDiff < 0.1) {
      confidence *= 1.1; // Boost for symmetric ears
    }
    
    return Math.min(1.0, Math.max(0.0, confidence));
    
  } catch (error) {
    console.error('[EAR] Confidence calculation failed:', error);
    return 0.1;
  }
}

/**
 * Smooth temple angle changes over time
 */
export class TempleAngleSmoother {
  constructor() {
    this.currentAngle = EAR_CONFIG.DEFAULT_TEMPLE_ANGLE;
    this.targetAngle = EAR_CONFIG.DEFAULT_TEMPLE_ANGLE;
    this.smoothingFactor = EAR_CONFIG.SMOOTHING_FACTOR;
  }

  update(newAngleData) {
    if (!newAngleData || newAngleData.confidence < 0.3) {
      return this.currentAngle;
    }
    
    this.targetAngle = newAngleData.angle;
    
    // Apply exponential smoothing
    const smoothedAngle = this.smoothingFactor * this.targetAngle + 
                         (1 - this.smoothingFactor) * this.currentAngle;
    
    this.currentAngle = smoothedAngle;
    
    return this.currentAngle;
  }

  setSmoothingFactor(factor) {
    this.smoothingFactor = Math.max(0.1, Math.min(0.9, factor));
  }

  reset() {
    this.currentAngle = EAR_CONFIG.DEFAULT_TEMPLE_ANGLE;
    this.targetAngle = EAR_CONFIG.DEFAULT_TEMPLE_ANGLE;
  }
}

/**
 * Analyze ear shape for frame recommendations
 */
export function analyzeEarShape(poseLandmarks) {
  try {
    if (!poseLandmarks) {
      return { shape: 'unknown', confidence: 0 };
    }
    
    const leftEar = poseLandmarks[7];
    const rightEar = poseLandmarks[8];
    
    if (!leftEar || !rightEar) {
      return { shape: 'unknown', confidence: 0 };
    }
    
    // Simple ear shape analysis based on landmark distribution
    const earWidth = Math.abs(rightEar.x - leftEar.x);
    const earHeight = (leftEar.y + rightEar.y) / 2;
    
    let shape = 'medium';
    let confidence = 0.7;
    
    if (earWidth > 0.8) {
      shape = 'wide';
      confidence = 0.8;
    } else if (earWidth < 0.4) {
      shape = 'narrow';
      confidence = 0.8;
    }
    
    return {
      shape,
      confidence,
      measurements: {
        earWidth,
        earHeight
      }
    };
    
  } catch (error) {
    console.error('[EAR] Ear shape analysis failed:', error);
    return { shape: 'unknown', confidence: 0 };
  }
}
