/**
 * FaceAnatomyAnalyzer.js
 * 
 * Production-grade facial anatomy analysis for precise glasses fitting.
 * 
 * Features:
 * - Accurate facial measurements from landmarks
 * - Face shape classification
 * - Nose bridge analysis
 * - Temple width calculation
 * - IPD (Inter-Pupillary Distance) estimation
 * - Face symmetry analysis
 * 
 * References:
 * - ISO 8624:2011 - Ophthalmic instruments
 * - ANSI Z80.5 - Ophthalmic frame requirements
 * - "Facial Anthropometry in Ophthalmic Dispensing" (Brooks & Borish)
 * 
 * @version 2.0.0 - Production Ready
 */

import * as THREE from 'three';

/**
 * Standard facial measurements in millimeters
 * Based on anthropometric studies
 */
const ANTHROPOMETRIC_STANDARDS = {
  // Average adult face dimensions
  faceWidth: {
    male: { mean: 145, sd: 8 },
    female: { mean: 138, sd: 7 }
  },
  faceHeight: {
    male: { mean: 190, sd: 12 },
    female: { mean: 178, sd: 10 }
  },
  interPupillaryDistance: {
    male: { mean: 64, sd: 3 },
    female: { mean: 62, sd: 3 }
  },
  noseBridgeWidth: {
    male: { mean: 18, sd: 3 },
    female: { mean: 16, sd: 2 }
  },
  noseBridgeHeight: {
    male: { mean: 12, sd: 3 },
    female: { mean: 10, sd: 2 }
  },
  eyeWidth: {
    male: { mean: 32, sd: 2 },
    female: { mean: 30, sd: 2 }
  },
  templeLength: {
    male: { mean: 145, sd: 10 },
    female: { mean: 140, sd: 8 }
  }
};

/**
 * Face shape categories
 */
const FACE_SHAPES = {
  OVAL: 'oval',
  ROUND: 'round',
  SQUARE: 'square',
  HEART: 'heart',
  OBLONG: 'oblong',
  DIAMOND: 'diamond',
  PEAR: 'pear'
};

/**
 * Key landmark indices for facial measurements
 * Based on MediaPipe FaceMesh 478-point model
 */
const LANDMARK_INDICES = {
  // Face outline
  faceOutline: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 
                397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 
                172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  
  // Eyes
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  leftPupil: 468,
  
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  rightPupil: 473,
  
  // Nose
  noseTip: 1,
  noseBridge: 6,
  noseBottom: 2,
  noseLeft: 98,
  noseRight: 327,
  noseRoot: 168,
  
  // Mouth
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  
  // Face sides (approximate ear positions)
  leftFaceSide: 234,
  rightFaceSide: 454,
  
  // Chin and forehead
  chin: 152,
  forehead: 10,
  
  // Eyebrows
  leftEyebrowOuter: 70,
  leftEyebrowInner: 107,
  rightEyebrowOuter: 300,
  rightEyebrowInner: 336,
  
  // Jaw
  leftJaw: 172,
  rightJaw: 397,
  chinLeft: 148,
  chinRight: 377
};

/**
 * FaceAnatomyAnalyzer - Production-grade facial measurement
 */
export class FaceAnatomyAnalyzer {
  constructor(options = {}) {
    // Configuration
    this.options = {
      // Reference scale (pixels per mm at typical working distance)
      referenceScale: options.referenceScale || null,
      // Use gender-specific standards
      gender: options.gender || 'neutral',
      // Calibration mode
      calibrationMode: options.calibrationMode || 'auto',
      ...options
    };
    
    // Cached measurements
    this.measurements = null;
    this.lastLandmarks = null;
    
    // Calibration data
    this.calibrationSamples = [];
    this.isCalibrated = false;
    this.calibratedScale = null;
    
    // Face shape
    this.faceShape = null;
    
    // Symmetry analysis
    this.symmetryScore = 1;
  }
  
  /**
   * Analyze face from landmarks
   * @param {Array} landmarks - MediaPipe face landmarks
   * @param {Object} options - Analysis options
   * @returns {Object} - Facial measurements
   */
  analyze(landmarks, options = {}) {
    if (!landmarks || landmarks.length === 0) {
      return null;
    }
    
    const width = options.width || 640;
    const height = options.height || 480;
    
    // Calculate scale factor
    const scale = this._calculateScale(landmarks, width, height);
    
    // Compute all measurements
    this.measurements = {
      // Face dimensions
      faceWidth: this._measureFaceWidth(landmarks, scale),
      faceHeight: this._measureFaceHeight(landmarks, scale),
      
      // Eye measurements
      interPupillaryDistance: this._measureIPD(landmarks, scale),
      eyeWidth: this._measureEyeWidth(landmarks, scale),
      eyeSpacing: this._measureEyeSpacing(landmarks, scale),
      
      // Nose measurements
      noseBridgeWidth: this._measureNoseBridgeWidth(landmarks, scale),
      noseBridgeHeight: this._measureNoseBridgeHeight(landmarks, scale),
      noseLength: this._measureNoseLength(landmarks, scale),
      
      // Temple measurements
      templeWidth: this._measureTempleWidth(landmarks, scale),
      templeLength: this._estimateTempleLength(landmarks, scale),
      
      // Key positions (normalized)
      sellion: this._getSellionPosition(landmarks),
      leftEyeCenter: this._getEyeCenter(landmarks, 'left'),
      rightEyeCenter: this._getEyeCenter(landmarks, 'right'),
      noseBridgeCenter: this._getNoseBridgeCenter(landmarks),
      
      // Face shape
      faceShape: this._classifyFaceShape(landmarks),
      
      // Symmetry
      symmetryScore: this._analyzeSymmetry(landmarks),
      
      // Scale info
      scale,
      isCalibrated: this.isCalibrated,
      
      // Timestamp
      timestamp: performance.now()
    };
    
    this.lastLandmarks = landmarks;
    this.faceShape = this.measurements.faceShape;
    this.symmetryScore = this.measurements.symmetryScore;
    
    return this.measurements;
  }
  
  /**
   * Calculate scale factor (pixels to mm)
   * @param {Array} landmarks 
   * @param {number} width 
   * @param {number} height 
   * @returns {number}
   */
  _calculateScale(landmarks, width, height) {
    // If calibrated, use calibrated scale
    if (this.isCalibrated && this.calibratedScale) {
      return this.calibratedScale;
    }
    
    // Use IPD as reference (most reliable)
    // Average IPD is ~63mm for adults
    const ipdPixels = this._measureIPD(landmarks, 1);
    const averageIPD = this.options.gender === 'female' ? 62 : 64;
    
    // Scale = mm / pixels
    return averageIPD / ipdPixels;
  }
  
  /**
   * Measure face width (bizygomatic width)
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureFaceWidth(landmarks, scale) {
    const left = landmarks[LANDMARK_INDICES.leftFaceSide];
    const right = landmarks[LANDMARK_INDICES.rightFaceSide];
    
    if (!left || !right) return 0;
    
    const width = Math.hypot(
      (right.x - left.x),
      (right.y - left.y)
    );
    
    return width * scale;
  }
  
  /**
   * Measure face height (trichion to menton)
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureFaceHeight(landmarks, scale) {
    const forehead = landmarks[LANDMARK_INDICES.forehead];
    const chin = landmarks[LANDMARK_INDICES.chin];
    
    if (!forehead || !chin) return 0;
    
    const height = Math.hypot(
      (forehead.x - chin.x),
      (forehead.y - chin.y)
    );
    
    return height * scale;
  }
  
  /**
   * Measure Inter-Pupillary Distance (IPD)
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureIPD(landmarks, scale) {
    // Use iris landmarks if available (refined landmarks)
    const leftPupil = landmarks[LANDMARK_INDICES.leftPupil];
    const rightPupil = landmarks[LANDMARK_INDICES.rightPupil];
    
    if (leftPupil && rightPupil) {
      const ipd = Math.hypot(
        (rightPupil.x - leftPupil.x),
        (rightPupil.y - leftPupil.y)
      );
      return ipd * scale;
    }
    
    // Fallback: Use eye centers
    const leftEye = this._getEyeCenter(landmarks, 'left');
    const rightEye = this._getEyeCenter(landmarks, 'right');
    
    if (leftEye && rightEye) {
      const ipd = Math.hypot(
        rightEye.x - leftEye.x,
        rightEye.y - leftEye.y
      );
      return ipd * scale;
    }
    
    return 0;
  }
  
  /**
   * Measure eye width
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {Object}
   */
  _measureEyeWidth(landmarks, scale) {
    const leftOuter = landmarks[LANDMARK_INDICES.leftEyeOuter];
    const leftInner = landmarks[LANDMARK_INDICES.leftEyeInner];
    const rightOuter = landmarks[LANDMARK_INDICES.rightEyeOuter];
    const rightInner = landmarks[LANDMARK_INDICES.rightEyeInner];
    
    const leftWidth = leftOuter && leftInner ? 
      Math.hypot(leftInner.x - leftOuter.x, leftInner.y - leftOuter.y) * scale : 0;
    
    const rightWidth = rightOuter && rightInner ?
      Math.hypot(rightInner.x - rightOuter.x, rightInner.y - rightOuter.y) * scale : 0;
    
    return {
      left: leftWidth,
      right: rightWidth,
      average: (leftWidth + rightWidth) / 2
    };
  }
  
  /**
   * Measure eye spacing (distance between inner corners)
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureEyeSpacing(landmarks, scale) {
    const leftInner = landmarks[LANDMARK_INDICES.leftEyeInner];
    const rightInner = landmarks[LANDMARK_INDICES.rightEyeInner];
    
    if (!leftInner || !rightInner) return 0;
    
    return Math.hypot(
      rightInner.x - leftInner.x,
      rightInner.y - leftInner.y
    ) * scale;
  }
  
  /**
   * Measure nose bridge width
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureNoseBridgeWidth(landmarks, scale) {
    const noseLeft = landmarks[LANDMARK_INDICES.noseLeft];
    const noseRight = landmarks[LANDMARK_INDICES.noseRight];
    
    if (!noseLeft || !noseRight) return 0;
    
    return Math.hypot(
      noseRight.x - noseLeft.x,
      noseRight.y - noseLeft.y
    ) * scale;
  }
  
  /**
   * Measure nose bridge height (from sellion to tip)
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureNoseBridgeHeight(landmarks, scale) {
    const noseBridge = landmarks[LANDMARK_INDICES.noseBridge];
    const noseTip = landmarks[LANDMARK_INDICES.noseTip];
    
    if (!noseBridge || !noseTip) return 0;
    
    return Math.hypot(
      noseTip.x - noseBridge.x,
      noseTip.y - noseBridge.y
    ) * scale;
  }
  
  /**
   * Measure nose length
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureNoseLength(landmarks, scale) {
    const noseRoot = landmarks[LANDMARK_INDICES.noseRoot];
    const noseTip = landmarks[LANDMARK_INDICES.noseTip];
    
    if (!noseRoot || !noseTip) return 0;
    
    return Math.hypot(
      noseTip.x - noseRoot.x,
      noseTip.y - noseRoot.y
    ) * scale;
  }
  
  /**
   * Measure temple width (for glasses frame width)
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _measureTempleWidth(landmarks, scale) {
    // Temple width is the distance from ear to ear
    // This determines the frame width needed
    const leftFace = landmarks[LANDMARK_INDICES.leftFaceSide];
    const rightFace = landmarks[LANDMARK_INDICES.rightFaceSide];
    
    if (!leftFace || !rightFace) return 0;
    
    // Add a small margin for comfort
    const templeWidth = Math.hypot(
      rightFace.x - leftFace.x,
      rightFace.y - leftFace.y
    ) * scale;
    
    return templeWidth;
  }
  
  /**
   * Estimate temple length (for glasses arms)
   * @param {Array} landmarks 
   * @param {number} scale 
   * @returns {number}
   */
  _estimateTempleLength(landmarks, scale) {
    // Temple length is from the frame front to behind the ear
    // We estimate this from face depth and typical proportions
    
    const leftEye = landmarks[LANDMARK_INDICES.leftEyeOuter];
    const leftFace = landmarks[LANDMARK_INDICES.leftFaceSide];
    
    if (!leftEye || !leftFace) {
      // Use standard value
      return this.options.gender === 'female' ? 140 : 145;
    }
    
    // Estimate from eye-to-face-side distance
    const eyeToFace = Math.hypot(
      leftFace.x - leftEye.x,
      leftFace.y - leftEye.y
    ) * scale;
    
    // Temple length is typically 1.5-2x this distance
    return eyeToFace * 1.8;
  }
  
  /**
   * Get sellion position (nose bridge point for glasses)
   * @param {Array} landmarks 
   * @returns {Object}
   */
  _getSellionPosition(landmarks) {
    // Sellion is the deepest point of the nasal bridge
    // For glasses, this is where the bridge rests
    const noseBridge = landmarks[LANDMARK_INDICES.noseBridge];
    const noseRoot = landmarks[LANDMARK_INDICES.noseRoot];
    
    if (!noseBridge) return null;
    
    // Use nose bridge as primary sellion approximation
    return {
      x: noseBridge.x,
      y: noseBridge.y,
      z: noseBridge.z || 0
    };
  }
  
  /**
   * Get eye center position
   * @param {Array} landmarks 
   * @param {string} side - 'left' or 'right'
   * @returns {Object}
   */
  _getEyeCenter(landmarks, side) {
    const indices = side === 'left' ? {
      outer: LANDMARK_INDICES.leftEyeOuter,
      inner: LANDMARK_INDICES.leftEyeInner,
      top: LANDMARK_INDICES.leftEyeTop,
      bottom: LANDMARK_INDICES.leftEyeBottom,
      pupil: LANDMARK_INDICES.leftPupil
    } : {
      outer: LANDMARK_INDICES.rightEyeOuter,
      inner: LANDMARK_INDICES.rightEyeInner,
      top: LANDMARK_INDICES.rightEyeTop,
      bottom: LANDMARK_INDICES.rightEyeBottom,
      pupil: LANDMARK_INDICES.rightPupil
    };
    
    // Use pupil if available
    const pupil = landmarks[indices.pupil];
    if (pupil) {
      return { x: pupil.x, y: pupil.y, z: pupil.z || 0 };
    }
    
    // Calculate center from eye corners
    const outer = landmarks[indices.outer];
    const inner = landmarks[indices.inner];
    
    if (!outer || !inner) return null;
    
    return {
      x: (outer.x + inner.x) / 2,
      y: (outer.y + inner.y) / 2,
      z: ((outer.z || 0) + (inner.z || 0)) / 2
    };
  }
  
  /**
   * Get nose bridge center
   * @param {Array} landmarks 
   * @returns {Object}
   */
  _getNoseBridgeCenter(landmarks) {
    const noseBridge = landmarks[LANDMARK_INDICES.noseBridge];
    const noseRoot = landmarks[LANDMARK_INDICES.noseRoot];
    
    if (!noseBridge) return null;
    
    if (noseRoot) {
      return {
        x: (noseBridge.x + noseRoot.x) / 2,
        y: (noseBridge.y + noseRoot.y) / 2,
        z: ((noseBridge.z || 0) + (noseRoot.z || 0)) / 2
      };
    }
    
    return { x: noseBridge.x, y: noseBridge.y, z: noseBridge.z || 0 };
  }
  
  /**
   * Classify face shape
   * @param {Array} landmarks 
   * @returns {string}
   */
  _classifyFaceShape(landmarks) {
    // Get key measurements
    const faceWidth = this._measureFaceWidth(landmarks, 1);
    const faceHeight = this._measureFaceHeight(landmarks, 1);
    
    if (faceWidth === 0 || faceHeight === 0) {
      return FACE_SHAPES.OVAL; // Default
    }
    
    // Calculate ratios
    const widthHeightRatio = faceWidth / faceHeight;
    
    // Get jaw and forehead widths
    const leftJaw = landmarks[LANDMARK_INDICES.leftJaw];
    const rightJaw = landmarks[LANDMARK_INDICES.rightJaw];
    const forehead = landmarks[LANDMARK_INDICES.forehead];
    const chin = landmarks[LANDMARK_INDICES.chin];
    
    let jawWidth = 0;
    if (leftJaw && rightJaw) {
      jawWidth = Math.hypot(rightJaw.x - leftJaw.x, rightJaw.y - leftJaw.y);
    }
    
    // Face shape classification based on ratios
    // Oval: width < height, forehead slightly wider than jaw
    // Round: width ≈ height, similar widths throughout
    // Square: width ≈ height, strong jaw
    // Heart: wide forehead, narrow jaw
    // Oblong: height >> width
    // Diamond: narrow forehead and jaw, wide cheekbones
    
    const jawToFaceRatio = jawWidth / faceWidth;
    
    if (widthHeightRatio > 0.85 && widthHeightRatio < 1.15) {
      // Width ≈ Height
      if (jawToFaceRatio > 0.85) {
        return FACE_SHAPES.SQUARE;
      }
      return FACE_SHAPES.ROUND;
    }
    
    if (widthHeightRatio < 0.75) {
      return FACE_SHAPES.OBLONG;
    }
    
    if (jawToFaceRatio < 0.75) {
      return FACE_SHAPES.HEART;
    }
    
    if (jawToFaceRatio > 0.9 && widthHeightRatio < 0.85) {
      return FACE_SHAPES.DIAMOND;
    }
    
    return FACE_SHAPES.OVAL;
  }
  
  /**
   * Analyze face symmetry
   * @param {Array} landmarks 
   * @returns {number}
   */
  _analyzeSymmetry(landmarks) {
    // Calculate symmetry by comparing left and right sides
    const noseTip = landmarks[LANDMARK_INDICES.noseTip];
    const forehead = landmarks[LANDMARK_INDICES.forehead];
    const chin = landmarks[LANDMARK_INDICES.chin];
    
    if (!noseTip || !forehead || !chin) return 1;
    
    // Calculate midline
    const midlineX = (forehead.x + chin.x) / 2;
    
    // Compare symmetric points
    const symmetricPairs = [
      [LANDMARK_INDICES.leftEyeOuter, LANDMARK_INDICES.rightEyeOuter],
      [LANDMARK_INDICES.leftEyeInner, LANDMARK_INDICES.rightEyeInner],
      [LANDMARK_INDICES.leftEyebrowOuter, LANDMARK_INDICES.rightEyebrowOuter],
      [LANDMARK_INDICES.mouthLeft, LANDMARK_INDICES.mouthRight]
    ];
    
    let totalAsymmetry = 0;
    let pairCount = 0;
    
    for (const [leftIdx, rightIdx] of symmetricPairs) {
      const left = landmarks[leftIdx];
      const right = landmarks[rightIdx];
      
      if (left && right) {
        // Distance from midline should be equal
        const leftDist = Math.abs(left.x - midlineX);
        const rightDist = Math.abs(right.x - midlineX);
        
        const asymmetry = Math.abs(leftDist - rightDist) / Math.max(leftDist, rightDist);
        totalAsymmetry += asymmetry;
        pairCount++;
      }
    }
    
    if (pairCount === 0) return 1;
    
    // Convert to symmetry score (1 = perfectly symmetric)
    const avgAsymmetry = totalAsymmetry / pairCount;
    return Math.max(0, 1 - avgAsymmetry);
  }
  
  /**
   * Get glasses fitting recommendations
   * @returns {Object}
   */
  getGlassesRecommendations() {
    if (!this.measurements) return null;
    
    const { faceWidth, templeWidth, noseBridgeWidth, faceShape, interPupillaryDistance } = this.measurements;
    
    // Calculate recommended frame dimensions
    const frameWidth = templeWidth * 1.05; // Slightly larger than face
    const bridgeWidth = noseBridgeWidth * 0.9; // Slightly smaller than nose
    const lensWidth = (frameWidth - bridgeWidth - 10) / 2; // 10mm for frame thickness
    
    // Frame style recommendations based on face shape
    const styleRecommendations = {
      [FACE_SHAPES.OVAL]: ['Most styles work well', 'Consider rectangular or geometric frames'],
      [FACE_SHAPES.ROUND]: ['Angular frames add definition', 'Rectangular or square shapes', 'Avoid round frames'],
      [FACE_SHAPES.SQUARE]: ['Round or oval frames soften features', 'Avoid angular frames', 'Consider cat-eye styles'],
      [FACE_SHAPES.HEART]: ['Bottom-heavy frames balance face', 'Light or rimless bottoms', 'Avoid top-heavy designs'],
      [FACE_SHAPES.OBLONG]: ['Wide frames add balance', 'Decorative temples', 'Avoid narrow frames'],
      [FACE_SHAPES.DIAMOND]: ['Oval or cat-eye frames', 'Rimless or light frames', 'Avoid narrow or boxy shapes'],
      [FACE_SHAPES.PEAR]: ['Top-heavy frames', 'Decorative upper rims', 'Wider temples']
    };
    
    return {
      frameWidth: Math.round(frameWidth),
      bridgeWidth: Math.round(bridgeWidth),
      lensWidth: Math.round(lensWidth),
      templeLength: Math.round(this.measurements.templeLength),
      ipd: Math.round(interPupillaryDistance),
      faceShape,
      styleRecommendations: styleRecommendations[faceShape] || [],
      fitQuality: this._calculateFitQuality()
    };
  }
  
  /**
   * Calculate fit quality score
   * @returns {number}
   */
  _calculateFitQuality() {
    if (!this.measurements) return 0;
    
    // Factors affecting fit quality
    const symmetryFactor = this.symmetryScore;
    const calibrationFactor = this.isCalibrated ? 1 : 0.8;
    
    // Check if measurements are within reasonable ranges
    const { faceWidth, interPupillaryDistance } = this.measurements;
    const widthReasonable = faceWidth > 100 && faceWidth < 200;
    const ipdReasonable = interPupillaryDistance > 50 && interPupillaryDistance < 80;
    
    const measurementQuality = (widthReasonable ? 1 : 0.5) * (ipdReasonable ? 1 : 0.5);
    
    return symmetryFactor * calibrationFactor * measurementQuality;
  }
  
  /**
   * Calibrate scale using known measurement
   * @param {number} knownMeasurement - Known measurement in mm
   * @param {string} type - Measurement type ('ipd', 'faceWidth', etc.)
   */
  calibrate(knownMeasurement, type = 'ipd') {
    if (!this.lastLandmarks) {
      console.warn('[ANATOMY] No landmarks available for calibration');
      return;
    }
    
    let pixelMeasurement;
    
    switch (type) {
      case 'ipd':
        pixelMeasurement = this._measureIPD(this.lastLandmarks, 1);
        break;
      case 'faceWidth':
        pixelMeasurement = this._measureFaceWidth(this.lastLandmarks, 1);
        break;
      default:
        console.warn(`[ANATOMY] Unknown calibration type: ${type}`);
        return;
    }
    
    if (pixelMeasurement > 0) {
      this.calibratedScale = knownMeasurement / pixelMeasurement;
      this.isCalibrated = true;
      
      console.log(`[ANATOMY] Calibrated scale: ${this.calibratedScale.toFixed(4)} mm/pixel`);
    }
  }
  
  /**
   * Add calibration sample for averaging
   * @param {number} knownMeasurement 
   * @param {string} type 
   */
  addCalibrationSample(knownMeasurement, type = 'ipd') {
    if (!this.lastLandmarks) return;
    
    let pixelMeasurement;
    
    switch (type) {
      case 'ipd':
        pixelMeasurement = this._measureIPD(this.lastLandmarks, 1);
        break;
      case 'faceWidth':
        pixelMeasurement = this._measureFaceWidth(this.lastLandmarks, 1);
        break;
      default:
        return;
    }
    
    if (pixelMeasurement > 0) {
      this.calibrationSamples.push(knownMeasurement / pixelMeasurement);
      
      // Use average after enough samples
      if (this.calibrationSamples.length >= 5) {
        const sum = this.calibrationSamples.reduce((a, b) => a + b, 0);
        this.calibratedScale = sum / this.calibrationSamples.length;
        this.isCalibrated = true;
        
        console.log(`[ANATOMY] Calibrated with ${this.calibrationSamples.length} samples`);
      }
    }
  }
  
  /**
   * Get current measurements
   * @returns {Object|null}
   */
  getMeasurements() {
    return this.measurements;
  }
  
  /**
   * Get face shape
   * @returns {string}
   */
  getFaceShape() {
    return this.faceShape;
  }
  
  /**
   * Reset analyzer
   */
  reset() {
    this.measurements = null;
    this.lastLandmarks = null;
    this.calibrationSamples = [];
    this.isCalibrated = false;
    this.calibratedScale = null;
    this.faceShape = null;
    this.symmetryScore = 1;
  }
}

// Export constants
export { ANTHROPOMETRIC_STANDARDS, FACE_SHAPES, LANDMARK_INDICES };

export default FaceAnatomyAnalyzer;
