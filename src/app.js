/**
 * app.js - Professional AI Glasses Try-On (Production v3.0)
 * 
 * World-class face tracking with precise glasses alignment
 * Features:
 * - MediaPipe FaceLandmarker (478 landmarks)
 * - Production-grade stabilization
 * - Accurate coordinate mapping
 * - Real-time glasses positioning
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PoseStabilizer } from './tracking/PoseStabilizer.js';

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  // MediaPipe
  WASM_CDN: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
  MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  
  // Glasses model
  GLB_PATH: './assets/models/glasses2/glasses2.glb',
  
  // Alignment settings
  GLASSES_WIDTH_RATIO: 1.08,   // Slightly larger than face for natural look
  Y_OFFSET_RATIO: 0.02,        // Vertical offset from nose bridge (ratio of face height)
  Z_OFFSET: -8,                // Depth offset (mm equivalent)
  
  // Smoothing
  POSITION_SMOOTH: 0.12,
  ROTATION_SMOOTH: 0.08,
  SCALE_SMOOTH: 0.06,
  
  // Debug
  DEBUG: false
};

// ============================================================
// GLOBAL STATE
// ============================================================
const State = {
  // DOM
  video: null,
  canvas: null,
  loadingScreen: null,
  badge: null,
  
  // Three.js
  renderer: null,
  scene: null,
  camera: null,
  glassesAnchor: null,
  modelOrigWidth: 140, // Default glasses width in mm
  
  // Tracking
  faceLandmarker: null,
  stabilizer: null,
  clock: null,
  
  // Layout
  layout: {
    videoWidth: 0,
    videoHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0
  },
  
  // State
  isInitialized: false,
  frameCount: 0
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize the application
 */
async function initialize() {
  try {
    console.log('[APP] Initializing...');
    
    // Get DOM elements
    State.video = document.getElementById('user-video');
    State.canvas = document.getElementById('glasses-overlay');
    State.loadingScreen = document.getElementById('loading-screen');
    State.badge = document.getElementById('features-badge');
    
    if (!State.video || !State.canvas) {
      throw new Error('Required DOM elements not found');
    }
    
    // Initialize in sequence
    await initFaceLandmarker();
    await initCamera();
    initThreeJS();
    await loadGlassesModel();
    
    // Initialize stabilizer
    State.stabilizer = new PoseStabilizer();
    State.clock = new THREE.Clock();
    
    // Hide loading screen
    if (State.loadingScreen) {
      State.loadingScreen.style.display = 'none';
    }
    
    // Start render loop
    State.isInitialized = true;
    requestAnimationFrame(renderLoop);
    
    console.log('[APP] ✅ Ready');
    
  } catch (error) {
    console.error('[APP] Initialization failed:', error);
    showError(error.message);
  }
}

/**
 * Initialize MediaPipe FaceLandmarker
 */
async function initFaceLandmarker() {
  console.log('[APP] Loading FaceLandmarker...');
  
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8');
  const fileset = await vision.FilesetResolver.forVisionTasks(CONFIG.WASM_CDN);
  
  State.faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: CONFIG.MODEL_URL,
      delegate: 'GPU'
    },
    outputFacialTransformationMatrixes: true,
    outputBlendshapes: false,
    runningMode: 'VIDEO',
    numFaces: 1
  });
  
  console.log('[APP] FaceLandmarker loaded');
}

/**
 * Initialize camera
 */
async function initCamera() {
  console.log('[APP] Initializing camera...');
  
  const constraints = {
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  };
  
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  State.video.srcObject = stream;
  
  await new Promise(resolve => {
    State.video.onloadedmetadata = () => {
      State.video.play();
      resolve();
    };
  });
  
  // Store video dimensions
  State.layout.videoWidth = State.video.videoWidth;
  State.layout.videoHeight = State.video.videoHeight;
  
  // Get canvas container dimensions
  const container = document.getElementById('try-on-container') || State.canvas.parentElement;
  State.layout.canvasWidth = container?.clientWidth || State.layout.videoWidth;
  State.layout.canvasHeight = container?.clientHeight || State.layout.videoHeight;
  
  // Set canvas size
  State.canvas.width = State.layout.canvasWidth;
  State.canvas.height = State.layout.canvasHeight;
  
  // Calculate cover-fit scaling
  // Video needs to cover the canvas (like object-fit: cover)
  const scaleX = State.layout.canvasWidth / State.layout.videoWidth;
  const scaleY = State.layout.canvasHeight / State.layout.videoHeight;
  State.layout.scale = Math.max(scaleX, scaleY);
  
  // Calculate offsets for centering
  State.layout.offsetX = (State.layout.videoWidth * State.layout.scale - State.layout.canvasWidth) / 2;
  State.layout.offsetY = (State.layout.videoHeight * State.layout.scale - State.layout.canvasHeight) / 2;
  
  console.log(`[APP] Camera: ${State.layout.videoWidth}x${State.layout.videoHeight}`);
  console.log(`[APP] Canvas: ${State.layout.canvasWidth}x${State.layout.canvasHeight}`);
}

/**
 * Initialize Three.js scene
 */
function initThreeJS() {
  console.log('[APP] Initializing Three.js...');
  
  // Create renderer
  State.renderer = new THREE.WebGLRenderer({
    canvas: State.canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  
  State.renderer.setSize(State.layout.canvasWidth, State.layout.canvasHeight);
  State.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  State.renderer.setClearColor(0x000000, 0);
  
  // Create scene
  State.scene = new THREE.Scene();
  
  // Create orthographic camera (2D-like projection)
  const halfWidth = State.layout.canvasWidth / 2;
  const halfHeight = State.layout.canvasHeight / 2;
  
  State.camera = new THREE.OrthographicCamera(
    -halfWidth, halfWidth,
    halfHeight, -halfHeight,
    0.1, 2000
  );
  State.camera.position.z = 1000;
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  State.scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(0, 100, 200);
  State.scene.add(directionalLight);
  
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(0, -50, 100);
  State.scene.add(fillLight);
  
  console.log('[APP] Three.js initialized');
}

/**
 * Load glasses model
 */
async function loadGlassesModel() {
  console.log('[APP] Loading glasses model...');
  
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(CONFIG.GLB_PATH);
  const model = gltf.scene;
  
  // Center the model
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.sub(center);
  
  // Get original dimensions
  const size = new THREE.Vector3();
  box.getSize(size);
  State.modelOrigWidth = size.x;
  
  console.log(`[APP] Model original width: ${State.modelOrigWidth.toFixed(1)}`);
  
  // Create anchor group
  State.glassesAnchor = new THREE.Group();
  State.glassesAnchor.add(model);
  State.glassesAnchor.visible = false;
  State.scene.add(State.glassesAnchor);
  
  console.log('[APP] Glasses model loaded');
}

// ============================================================
// COORDINATE MAPPING
// ============================================================

/**
 * Map normalized landmark coordinates to canvas pixel coordinates
 * Handles the cover-fit scaling, centering, and mirroring
 * 
 * IMPORTANT: The video is mirrored (scaleX(-1)) for selfie view,
 * but MediaPipe landmarks are in non-mirrored coordinates.
 * We need to mirror the X coordinate to match the mirrored video.
 * 
 * @param {Object} landmark - MediaPipe landmark with x, y, z in [0,1] range
 * @returns {Object} - {x, y, z} in canvas pixel coordinates (center-relative)
 */
function mapLandmarkToCanvas(landmark) {
  // Step 1: Mirror X coordinate to match the mirrored video
  // MediaPipe gives non-mirrored coordinates, but video is displayed mirrored
  const mirroredX = 1 - landmark.x;
  
  // Step 2: Convert from normalized [0,1] to video pixel coordinates
  const videoX = mirroredX * State.layout.videoWidth;
  const videoY = landmark.y * State.layout.videoHeight;
  
  // Step 3: Apply cover-fit scaling
  // Scale video coordinates to canvas space
  const scaledX = videoX * State.layout.scale;
  const scaledY = videoY * State.layout.scale;
  
  // Step 4: Apply offset for centering (cover-fit)
  const canvasX = scaledX - State.layout.offsetX;
  const canvasY = scaledY - State.layout.offsetY;
  
  // Step 5: Convert to center-relative coordinates
  // (0,0) at canvas center, Y inverted for 3D space
  const x = canvasX - State.layout.canvasWidth / 2;
  const y = -(canvasY - State.layout.canvasHeight / 2);
  
  // Z coordinate: Scale by video width for reasonable depth
  // Negative Z means towards the camera
  // Also mirror Z since we mirrored X
  const z = landmark.z * State.layout.videoWidth * State.layout.scale;
  
  return { x, y, z };
}

// ============================================================
// TRACKING & ALIGNMENT
// ============================================================

/**
 * Process landmarks and update glasses position
 */
function updateGlassesPosition(landmarks, deltaTime) {
  if (!State.glassesAnchor || !landmarks) return;
  
  // Key facial landmarks for glasses positioning
  // Using MediaPipe FaceMesh indices
  // Note: After mirroring, left/right appear swapped in canvas space
  // landmarks[33] is anatomically left eye outer, but appears on right after mirroring
  const leftEyeOuter = mapLandmarkToCanvas(landmarks[33]);    // Anatomically left, appears right
  const rightEyeOuter = mapLandmarkToCanvas(landmarks[263]);  // Anatomically right, appears left
  const noseBridge = mapLandmarkToCanvas(landmarks[6]);       // Nose bridge (sellion)
  const noseTip = mapLandmarkToCanvas(landmarks[1]);          // Nose tip
  const leftTemple = mapLandmarkToCanvas(landmarks[234]);     // Anatomically left, appears right
  const rightTemple = mapLandmarkToCanvas(landmarks[454]);    // Anatomically right, appears left
  const forehead = mapLandmarkToCanvas(landmarks[10]);        // Forehead top
  const chin = mapLandmarkToCanvas(landmarks[152]);           // Chin
  
  // =====================
  // POSITION CALCULATION
  // =====================
  
  // Glasses sit on the nose bridge
  const posX = noseBridge.x;
  
  // Y position: slightly above the nose bridge
  const faceHeight = Math.abs(forehead.y - chin.y);
  const posY = noseBridge.y + (CONFIG.Y_OFFSET_RATIO * faceHeight);
  
  // Z position: based on nose depth
  // Positive Z is towards viewer, negative is away
  const posZ = noseBridge.z * 0.8 + CONFIG.Z_OFFSET;
  
  const targetPosition = new THREE.Vector3(posX, posY, posZ);
  
  // =====================
  // SCALE CALCULATION
  // =====================
  
  // Use temple-to-temple distance for accurate width
  // Note: After mirroring, leftTemple and rightTemple are swapped in canvas space
  // But the distance remains the same
  const templeWidth = Math.hypot(
    leftTemple.x - rightTemple.x,
    leftTemple.y - rightTemple.y,
    leftTemple.z - rightTemple.z
  );
  
  // Scale glasses to match face width
  const targetScaleValue = (templeWidth * CONFIG.GLASSES_WIDTH_RATIO) / State.modelOrigWidth;
  const targetScale = new THREE.Vector3(targetScaleValue, targetScaleValue, targetScaleValue);
  
  // =====================
  // ROTATION CALCULATION
  // =====================
  
  // Roll (Z rotation): from eye line
  // Note: Since we mirrored the coordinates, left/right are swapped in canvas space
  const roll = Math.atan2(
    leftEyeOuter.y - rightEyeOuter.y,
    leftEyeOuter.x - rightEyeOuter.x
  );
  
  // Yaw (Y rotation): from nose tip deviation from center
  const eyeCenter = (leftEyeOuter.x + rightEyeOuter.x) / 2;
  const yaw = (noseTip.x - eyeCenter) * 0.015;
  
  // Pitch (X rotation): from nose tip vs bridge vertical difference
  const pitch = (noseTip.y - noseBridge.y - 15) * 0.008;
  
  const targetRotation = new THREE.Quaternion();
  targetRotation.setFromEuler(new THREE.Euler(pitch, yaw, roll));
  
  // =====================
  // STABILIZATION
  // =====================
  
  State.stabilizer.update(targetPosition, targetRotation, targetScale, deltaTime);
  
  // =====================
  // APPLY TRANSFORM
  // =====================
  
  State.glassesAnchor.position.copy(State.stabilizer.position);
  State.glassesAnchor.quaternion.copy(State.stabilizer.rotation);
  State.glassesAnchor.scale.copy(State.stabilizer.scale);
  State.glassesAnchor.visible = true;
  
  // Update stats display
  updateStats(templeWidth, targetScaleValue);
  
  // Debug visualization
  if (CONFIG.DEBUG) {
    drawDebugPoints([leftEyeOuter, rightEyeOuter, noseBridge, noseTip]);
  }
}

/**
 * Update stats display
 */
function updateStats(faceWidth, scale) {
  const faceWidthEl = document.getElementById('face-width');
  const ipdEl = document.getElementById('face-ipd');
  const scaleEl = document.getElementById('glasses-scale');
  
  if (faceWidthEl) faceWidthEl.textContent = `${Math.round(faceWidth)}px`;
  if (ipdEl) ipdEl.textContent = `${Math.round(faceWidth * 0.6)}px`;
  if (scaleEl) scaleEl.textContent = scale.toFixed(2);
}

/**
 * Draw debug points
 */
function drawDebugPoints(points) {
  if (!window.debugLayer) {
    window.debugLayer = new THREE.Group();
    State.scene.add(window.debugLayer);
    
    const geometry = new THREE.SphereGeometry(3, 8, 8);
    for (let i = 0; i < points.length; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i === 2 ? 0x00ff00 : 0xff0000,
        depthTest: false
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 999;
      window.debugLayer.add(mesh);
    }
  }
  
  const meshes = window.debugLayer.children;
  for (let i = 0; i < points.length && i < meshes.length; i++) {
    meshes[i].position.set(points[i].x, points[i].y, 100);
  }
}

// ============================================================
// RENDER LOOP
// ============================================================

/**
 * Main render loop
 */
function renderLoop() {
  if (!State.isInitialized) {
    requestAnimationFrame(renderLoop);
    return;
  }
  
  // Check video readiness
  if (State.video.readyState < 2 || !State.faceLandmarker) {
    requestAnimationFrame(renderLoop);
    return;
  }
  
  const deltaTime = State.clock.getDelta();
  
  try {
    // Detect face landmarks
    const result = State.faceLandmarker.detectForVideo(State.video, performance.now());
    
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      // Update glasses position
      updateGlassesPosition(result.faceLandmarks[0], deltaTime);
      
      // Update badge
      if (State.badge) {
        State.badge.classList.add('active');
      }
    } else {
      // No face detected
      if (State.glassesAnchor) {
        State.glassesAnchor.visible = false;
      }
      
      if (State.badge) {
        State.badge.classList.remove('active');
      }
    }
    
    // Render scene
    State.renderer.render(State.scene, State.camera);
    
  } catch (error) {
    console.error('[APP] Render error:', error);
  }
  
  State.frameCount++;
  requestAnimationFrame(renderLoop);
}

// ============================================================
// ERROR HANDLING
// ============================================================

/**
 * Show error screen
 */
function showError(message) {
  if (State.loadingScreen) {
    State.loadingScreen.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h2 style="margin-bottom: 0.5rem;">Error</h2>
        <p style="color: #888; margin-bottom: 1rem;">${message}</p>
        <button onclick="location.reload()" style="
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 2rem;
          cursor: pointer;
        ">Retry</button>
      </div>
    `;
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Handle window resize
window.addEventListener('resize', () => {
  if (!State.isInitialized || !State.renderer) return;
  
  const container = document.getElementById('try-on-container') || State.canvas.parentElement;
  State.layout.canvasWidth = container?.clientWidth || State.layout.canvasWidth;
  State.layout.canvasHeight = container?.clientHeight || State.layout.canvasHeight;
  
  // Recalculate scaling
  const scaleX = State.layout.canvasWidth / State.layout.videoWidth;
  const scaleY = State.layout.canvasHeight / State.layout.videoHeight;
  State.layout.scale = Math.max(scaleX, scaleY);
  State.layout.offsetX = (State.layout.videoWidth * State.layout.scale - State.layout.canvasWidth) / 2;
  State.layout.offsetY = (State.layout.videoHeight * State.layout.scale - State.layout.canvasHeight) / 2;
  
  // Update camera
  const halfWidth = State.layout.canvasWidth / 2;
  const halfHeight = State.layout.canvasHeight / 2;
  
  State.camera.left = -halfWidth;
  State.camera.right = halfWidth;
  State.camera.top = halfHeight;
  State.camera.bottom = -halfHeight;
  State.camera.updateProjectionMatrix();
  
  // Update renderer
  State.renderer.setSize(State.layout.canvasWidth, State.layout.canvasHeight);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (State.video && State.video.srcObject) {
    State.video.srcObject.getTracks().forEach(track => track.stop());
  }
});

// ============================================================
// START APPLICATION
// ============================================================

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Export for debugging
window.appState = State;
window.appConfig = CONFIG;
