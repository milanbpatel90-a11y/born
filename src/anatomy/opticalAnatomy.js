/**
 * opticalAnatomy.js
 * 
 * Anatomically correct calculations for optical fitting
 */

export const ANATOMY_CONFIG = {
  REAL_IPD_MM: 63,              // Average interpupillary distance
  CALIBRATION_DISTANCE_MM: 500, // Standard fitting distance
  SELLION_DEPTH_OFFSET: -7.8,   // Sellion depth from nose tip
  TEMPLE_SCALE: 0.92,           // Temple width scaling factor
  REF_HEAD_WIDTH_PX: 182        // Reference head width at 500mm
};

/**
 * Compute sellion offset for anatomically correct nose bridge placement
 */
export function computeSellionOffset(landmarks, cameraIntrinsics, tvec) {
  try {
    // Key landmarks for sellion calculation
    const noseTip = landmarks[1];
    const noseBridge = landmarks[6]; // Between eyes
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    
    if (!noseTip || !noseBridge || !leftEye || !rightEye) {
      return null;
    }
    
    // Calculate eye center
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
      z: (leftEye.z + rightEye.z) / 2
    };
    
    // Calculate sellion position (nose bridge area)
    const sellionNormalized = {
      x: noseBridge.x,
      y: noseBridge.y,
      z: noseBridge.z
    };
    
    // Apply depth offset for realistic nose bridge placement
    const depthOffset = ANATOMY_CONFIG.SELLION_DEPTH_OFFSET;
    const distance = Math.abs(tvec[2]) || ANATOMY_CONFIG.CALIBRATION_DISTANCE_MM;
    
    // Scale offset based on distance
    const scaledOffset = (depthOffset * ANATOMY_CONFIG.CALIBRATION_DISTANCE_MM) / distance;
    
    // Calculate confidence based on landmark visibility
    const confidence = Math.min(
      noseTip.visibility || 0.5,
      noseBridge.visibility || 0.5,
      leftEye.visibility || 0.5,
      rightEye.visibility || 0.5
    );
    
    return {
      x: sellionNormalized.x,
      y: sellionNormalized.y,
      z: sellionNormalized.z + scaledOffset,
      confidence: confidence,
      eyeCenter: eyeCenter,
      noseTip: { x: noseTip.x, y: noseTip.y, z: noseTip.z }
    };
    
  } catch (error) {
    console.error('[ANATOMY] Sellion offset calculation failed:', error);
    return null;
  }
}

/**
 * Compute temple width for proper frame scaling
 */
export function computeTempleWidth(landmarks, imageWidth) {
  try {
    // Face width landmarks
    const leftCheek = landmarks[50]; // Left cheek bone
    const rightCheek = landmarks[280]; // Right cheek bone
    const leftJaw = landmarks[172]; // Left jaw
    const rightJaw = landmarks[398]; // Right jaw
    
    if (!leftCheek || !rightCheek || !leftJaw || !rightJaw) {
      return null;
    }
    
    // Calculate face width at different levels
    const cheekWidth = Math.abs(rightCheek.x - leftCheek.x) * imageWidth;
    const jawWidth = Math.abs(rightJaw.x - leftJaw.x) * imageWidth;
    
    // Average face width
    const avgFaceWidth = (cheekWidth + jawWidth) / 2;
    
    // Calculate temple width (typically 80-90% of face width)
    const templeWidth = avgFaceWidth * ANATOMY_CONFIG.TEMPLE_SCALE;
    
    // Normalize to reference width for scaling
    const scale = templeWidth / ANATOMY_CONFIG.REF_HEAD_WIDTH_PX;
    
    // Calculate confidence
    const confidence = Math.min(
      leftCheek.visibility || 0.5,
      rightCheek.visibility || 0.5,
      leftJaw.visibility || 0.5,
      rightJaw.visibility || 0.5
    );
    
    return {
      width: templeWidth,
      scale: scale,
      faceWidth: avgFaceWidth,
      confidence: confidence,
      measurements: {
        cheekWidth,
        jawWidth,
        imageWidth
      }
    };
    
  } catch (error) {
    console.error('[ANATOMY] Temple width calculation failed:', error);
    return null;
  }
}

/**
 * Calculate interpupillary distance (IPD) for lens positioning
 */
export function calculateIPD(landmarks, imageWidth, focalLength) {
  try {
    const leftIris = landmarks[468]; // Left iris center
    const rightIris = landmarks[473]; // Right iris center
    
    if (!leftIris || !rightIris) {
      return null;
    }
    
    // Pixel distance between irises
    const pixelDistance = Math.hypot(
      (rightIris.x - leftIris.x) * imageWidth,
      (rightIris.y - leftIris.y) * imageWidth
    );
    
    // Convert to real-world distance using focal length
    const realDistance = (pixelDistance * ANATOMY_CONFIG.REAL_IPD_MM) / 60; // 60px average at 500mm
    
    // Calculate confidence
    const confidence = Math.min(
      leftIris.visibility || 0.5,
      rightIris.visibility || 0.5
    );
    
    return {
      pixelDistance,
      realDistance,
      confidence,
      leftIris: { x: leftIris.x, y: leftIris.y },
      rightIris: { x: rightIris.x, y: rightIris.y }
    };
    
  } catch (error) {
    console.error('[ANATOMY] IPD calculation failed:', error);
    return null;
  }
}

/**
 * Calculate nose bridge width for frame selection
 */
export function calculateNoseBridgeWidth(landmarks, imageWidth) {
  try {
    // Nose bridge landmarks
    const bridgeTop = landmarks[6];   // Top of nose bridge
    const bridgeBottom = landmarks[19]; // Bottom of nose bridge
    const leftNostril = landmarks[31];  // Left nostril
    const rightNostril = landmarks[35]; // Right nostril
    
    if (!bridgeTop || !bridgeBottom || !leftNostril || !rightNostril) {
      return null;
    }
    
    // Calculate bridge width
    const bridgeWidth = Math.abs(rightNostril.x - leftNostril.x) * imageWidth;
    
    // Calculate bridge height
    const bridgeHeight = Math.abs(bridgeBottom.y - bridgeTop.y) * imageWidth;
    
    // Bridge width to height ratio
    const ratio = bridgeWidth / bridgeHeight;
    
    // Calculate confidence
    const confidence = Math.min(
      bridgeTop.visibility || 0.5,
      bridgeBottom.visibility || 0.5,
      leftNostril.visibility || 0.5,
      rightNostril.visibility || 0.5
    );
    
    return {
      width: bridgeWidth,
      height: bridgeHeight,
      ratio: ratio,
      confidence: confidence,
      bridgeType: ratio > 0.8 ? 'wide' : ratio > 0.6 ? 'medium' : 'narrow'
    };
    
  } catch (error) {
    console.error('[ANATOMY] Nose bridge calculation failed:', error);
    return null;
  }
}
