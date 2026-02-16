/**
 * faceProfile.js
 * 
 * Face curvature estimation for natural frame wrap
 */

export const FACE_PROFILE_CONFIG = {
  PROFILE_SAMPLES: 20,           // Number of samples along face profile
  SMOOTHING_WINDOW: 3,           // Smoothing window size
  CURVATURE_THRESHOLD: 0.1,      // Threshold for curvature detection
  REFERENCE_CURVATURE: 0.05      // Reference face curvature
};

/**
 * Estimate face profile curvature for frame fitting
 */
export function estimateFaceProfile(landmarks) {
  try {
    // Extract profile landmarks from nose bridge to chin
    const profileLandmarks = _extractProfileLandmarks(landmarks);
    if (!profileLandmarks || profileLandmarks.length < 5) {
      return null;
    }
    
    // Calculate curvature along profile
    const curvature = _calculateProfileCurvature(profileLandmarks);
    
    // Estimate face shape type
    const faceShape = _classifyFaceShape(curvature, profileLandmarks);
    
    // Calculate wrap angle for temples
    const wrapAngle = _calculateWrapAngle(curvature, faceShape);
    
    // Calculate confidence
    const confidence = _calculateProfileConfidence(profileLandmarks);
    
    return {
      curvature: curvature,
      faceShape: faceShape,
      wrapAngle: wrapAngle,
      confidence: confidence,
      profilePoints: profileLandmarks,
      measurements: {
        noseBridgeHeight: _measureNoseBridgeHeight(profileLandmarks),
        cheekProminence: _measureCheekProminence(profileLandmarks),
        jawAngle: _measureJawAngle(profileLandmarks)
      }
    };
    
  } catch (error) {
    console.error('[PROFILE] Face profile estimation failed:', error);
    return null;
  }
}

/**
 * Extract profile landmarks from face mesh
 */
function _extractProfileLandmarks(landmarks) {
  try {
    // Profile path: forehead -> nose bridge -> nose tip -> philtrum -> chin
    const profileIndices = [
      10,  // Forehead center
      6,   // Nose bridge
      1,   // Nose tip
      2,   // Upper lip
      18,  // Chin center
      172, // Left jaw
      398  // Right jaw
    ];
    
    const profilePoints = [];
    
    for (const index of profileIndices) {
      const landmark = landmarks[index];
      if (landmark && landmark.visibility > 0.5) {
        profilePoints.push({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
          visibility: landmark.visibility
        });
      }
    }
    
    // Interpolate additional points for smoother profile
    const interpolatedProfile = _interpolateProfile(profilePoints, FACE_PROFILE_CONFIG.PROFILE_SAMPLES);
    
    return interpolatedProfile;
    
  } catch (error) {
    console.error('[PROFILE] Profile extraction failed:', error);
    return null;
  }
}

/**
 * Interpolate profile points for smoother analysis
 */
function _interpolateProfile(points, targetCount) {
  if (points.length < 2) return points;
  
  const interpolated = [];
  const step = (points.length - 1) / (targetCount - 1);
  
  for (let i = 0; i < targetCount; i++) {
    const index = i * step;
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const fraction = index - lowerIndex;
    
    if (lowerIndex === upperIndex) {
      interpolated.push(points[lowerIndex]);
    } else {
      const lower = points[lowerIndex];
      const upper = points[upperIndex];
      
      interpolated.push({
        x: lower.x + fraction * (upper.x - lower.x),
        y: lower.y + fraction * (upper.y - lower.y),
        z: lower.z + fraction * (upper.z - lower.z),
        visibility: Math.min(lower.visibility, upper.visibility)
      });
    }
  }
  
  return interpolated;
}

/**
 * Calculate curvature along face profile
 */
function _calculateProfileCurvature(profilePoints) {
  try {
    if (profilePoints.length < 3) return 0;
    
    let totalCurvature = 0;
    let validPoints = 0;
    
    // Calculate curvature at each point using three-point method
    for (let i = 1; i < profilePoints.length - 1; i++) {
      const p1 = profilePoints[i - 1];
      const p2 = profilePoints[i];
      const p3 = profilePoints[i + 1];
      
      // Calculate angle between segments
      const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = dot / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
        const curvature = Math.PI - angle;
        
        totalCurvature += curvature;
        validPoints++;
      }
    }
    
    return validPoints > 0 ? totalCurvature / validPoints : 0;
    
  } catch (error) {
    console.error('[PROFILE] Curvature calculation failed:', error);
    return 0;
  }
}

/**
 * Classify face shape based on profile curvature
 */
function _classifyFaceShape(curvature, profilePoints) {
  try {
    // Simple face shape classification
    if (curvature > FACE_PROFILE_CONFIG.CURVATURE_THRESHOLD * 2) {
      return 'round';
    } else if (curvature > FACE_PROFILE_CONFIG.CURVATURE_THRESHOLD) {
      return 'oval';
    } else if (curvature > FACE_PROFILE_CONFIG.CURVATURE_THRESHOLD * 0.5) {
      return 'square';
    } else {
      return 'oblong';
    }
    
  } catch (error) {
    console.error('[PROFILE] Face shape classification failed:', error);
    return 'unknown';
  }
}

/**
 * Calculate optimal wrap angle for temples
 */
function _calculateWrapAngle(curvature, faceShape) {
  try {
    // Base wrap angle by face shape
    let baseAngle = 10; // Default wrap angle
    
    switch (faceShape) {
      case 'round':
        baseAngle = 12; // More wrap for round faces
        break;
      case 'oval':
        baseAngle = 10; // Standard wrap
        break;
      case 'square':
        baseAngle = 8;  // Less wrap for square faces
        break;
      case 'oblong':
        baseAngle = 6;  // Minimal wrap for oblong faces
        break;
    }
    
    // Adjust based on actual curvature
    const curvatureAdjustment = (curvature - FACE_PROFILE_CONFIG.REFERENCE_CURVATURE) * 20;
    const finalAngle = baseAngle + curvatureAdjustment;
    
    // Constrain to reasonable range
    return Math.max(0, Math.min(20, finalAngle));
    
  } catch (error) {
    console.error('[PROFILE] Wrap angle calculation failed:', error);
    return 10;
  }
}

/**
 * Measure nose bridge height
 */
function _measureNoseBridgeHeight(profilePoints) {
  try {
    if (profilePoints.length < 3) return 0;
    
    const noseBridge = profilePoints[1]; // Approximate nose bridge position
    const noseTip = profilePoints[2];    // Approximate nose tip position
    
    if (!noseBridge || !noseTip) return 0;
    
    return Math.abs(noseTip.y - noseBridge.y);
    
  } catch (error) {
    console.error('[PROFILE] Nose bridge measurement failed:', error);
    return 0;
  }
}

/**
 * Measure cheek prominence
 */
function _measureCheekProminence(profilePoints) {
  try {
    if (profilePoints.length < 4) return 0;
    
    // Approximate cheek position
    const cheekIndex = Math.floor(profilePoints.length * 0.4);
    const cheek = profilePoints[cheekIndex];
    
    if (!cheek) return 0;
    
    // Simple prominence based on z-depth
    return Math.abs(cheek.z || 0);
    
  } catch (error) {
    console.error('[PROFILE] Cheek prominence measurement failed:', error);
    return 0;
  }
}

/**
 * Measure jaw angle
 */
function _measureJawAngle(profilePoints) {
  try {
    if (profilePoints.length < 3) return 0;
    
    const chin = profilePoints[profilePoints.length - 3];
    const leftJaw = profilePoints[profilePoints.length - 2];
    const rightJaw = profilePoints[profilePoints.length - 1];
    
    if (!chin || !leftJaw || !rightJaw) return 0;
    
    // Calculate jaw angle
    const v1 = { x: leftJaw.x - chin.x, y: leftJaw.y - chin.y };
    const v2 = { x: rightJaw.x - chin.x, y: rightJaw.y - chin.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 > 0 && mag2 > 0) {
      const cosAngle = dot / (mag1 * mag2);
      return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
    }
    
    return 0;
    
  } catch (error) {
    console.error('[PROFILE] Jaw angle measurement failed:', error);
    return 0;
  }
}

/**
 * Calculate confidence for profile estimation
 */
function _calculateProfileConfidence(profilePoints) {
  try {
    if (!profilePoints || profilePoints.length === 0) return 0;
    
    // Average visibility of profile points
    const avgVisibility = profilePoints.reduce((sum, point) => 
      sum + (point.visibility || 0), 0) / profilePoints.length;
    
    // Boost confidence if we have enough points
    const pointCountBonus = profilePoints.length >= 10 ? 0.2 : 0;
    
    return Math.min(1.0, avgVisibility + pointCountBonus);
    
  } catch (error) {
    console.error('[PROFILE] Confidence calculation failed:', error);
    return 0.1;
  }
}
