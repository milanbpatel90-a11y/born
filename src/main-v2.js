/**
 * main.js - Main Application Entry Point
 * 
 * World-class virtual glasses try-on application
 * Integrates all tracking, stabilization, and rendering components
 * 
 * @version 2.0.0 - Production Ready
 */

import { WorldClassFaceTracker } from './tracking/WorldClassFaceTracker.js';
import { GlassesAlignmentSystem } from './rendering/GlassesAlignmentSystem.js';

// ============================================================
// APPLICATION STATE
// ============================================================

const AppState = {
  // DOM Elements
  video: null,
  canvas: null,
  glassesCanvas: null,
  loadingScreen: null,
  mainContent: null,
  
  // Core systems
  tracker: null,
  alignment: null,
  
  // State
  isInitialized: false,
  isRunning: false,
  animationFrameId: null,
  
  // Frame model
  currentFrameId: 'glasses2',
  frameModels: {
    glasses2: './assets/models/glasses2/glasses2.glb'
  },
  
  // Performance
  frameCount: 0,
  lastFpsUpdate: 0,
  fps: 0,
  
  // Debug
  debugMode: false
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    console.log('[APP] Initializing virtual try-on application...');
    
    // Get DOM elements
    AppState.video = document.getElementById('user-video');
    AppState.canvas = document.getElementById('tracking-canvas');
    AppState.glassesCanvas = document.getElementById('glasses-canvas');
    AppState.loadingScreen = document.getElementById('loading-screen');
    AppState.mainContent = document.getElementById('main-content');
    
    updateLoadingProgress(10, 'Requesting camera access...');
    
    // Initialize camera
    await initializeCamera();
    updateLoadingProgress(30, 'Camera ready. Loading AI models...');
    
    // Initialize tracker
    await initializeTracker();
    updateLoadingProgress(60, 'AI models loaded. Setting up renderer...');
    
    // Initialize alignment system
    await initializeAlignment();
    updateLoadingProgress(80, 'Loading glasses model...');
    
    // Load default glasses model
    await loadGlassesModel(AppState.currentFrameId);
    updateLoadingProgress(95, 'Finalizing...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Start render loop
    AppState.isInitialized = true;
    startRenderLoop();
    
    // Hide loading screen
    setTimeout(() => {
      hideLoadingScreen();
      console.log('[APP] ✅ Application ready');
    }, 300);
    
  } catch (error) {
    console.error('[APP] Initialization failed:', error);
    showErrorScreen(error.message);
  }
}

/**
 * Initialize camera
 */
async function initializeCamera() {
  const constraints = {
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    AppState.video.srcObject = stream;
    
    await new Promise((resolve) => {
      AppState.video.onloadedmetadata = () => {
        AppState.video.play();
        resolve();
      };
    });
    
    // Set canvas dimensions
    if (AppState.canvas) {
      AppState.canvas.width = AppState.video.videoWidth;
      AppState.canvas.height = AppState.video.videoHeight;
    }
    
    if (AppState.glassesCanvas) {
      AppState.glassesCanvas.width = AppState.video.videoWidth;
      AppState.glassesCanvas.height = AppState.video.videoHeight;
    }
    
    console.log(`[APP] Camera: ${AppState.video.videoWidth}x${AppState.video.videoHeight}`);
    
  } catch (error) {
    throw new Error(`Camera access denied: ${error.message}`);
  }
}

/**
 * Initialize face tracker
 */
async function initializeTracker() {
  AppState.tracker = new WorldClassFaceTracker({
    performanceProfile: 'auto',
    
    // Stabilization settings
    positionMinCutoff: 0.8,
    positionBeta: 0.005,
    rotationMinCutoff: 1.2,
    rotationBeta: 0.01,
    useKalman: true,
    adaptiveSmoothing: true,
    
    // Quality thresholds
    excellentThreshold: 0.9,
    goodThreshold: 0.75,
    acceptableThreshold: 0.5,
    poorThreshold: 0.3,
    
    // Callbacks
    onInitialized: () => {
      console.log('[APP] Tracker initialized');
    },
    
    onTrackingUpdate: (data) => {
      updateTrackingUI(data);
    },
    
    onStateChange: (data) => {
      console.log(`[APP] Tracking state: ${data.from} -> ${data.to}`);
      updateStateUI(data.to);
    },
    
    onQualityChange: (quality) => {
      updateQualityUI(quality);
    },
    
    onTrackingLost: () => {
      console.log('[APP] Tracking lost');
      showTrackingLostUI();
    },
    
    onTrackingRecovered: () => {
      console.log('[APP] Tracking recovered');
      hideTrackingLostUI();
    },
    
    onError: (error) => {
      console.error('[APP] Tracker error:', error);
    }
  });
  
  await AppState.tracker.initialize(AppState.video, AppState.canvas);
}

/**
 * Initialize alignment system
 */
async function initializeAlignment() {
  AppState.alignment = new GlassesAlignmentSystem({
    defaultYOffset: 5,
    defaultZOffset: -10,
    widthScaleFactor: 1.05,
    positionSmoothFactor: 0.15,
    rotationSmoothFactor: 0.12,
    scaleSmoothFactor: 0.08
  });
  
  AppState.alignment.initialize(AppState.glassesCanvas || AppState.canvas);
}

/**
 * Load glasses model
 * @param {string} frameId 
 */
async function loadGlassesModel(frameId) {
  const modelPath = AppState.frameModels[frameId];
  
  if (!modelPath) {
    console.warn(`[APP] Unknown frame: ${frameId}`);
    return;
  }
  
  try {
    await AppState.alignment.loadModel(modelPath);
    AppState.currentFrameId = frameId;
    console.log(`[APP] Loaded frame: ${frameId}`);
    
  } catch (error) {
    console.error(`[APP] Failed to load frame ${frameId}:`, error);
    
    // Fallback to default
    if (frameId !== 'glasses2') {
      await loadGlassesModel('glasses2');
    }
  }
}

// ============================================================
// RENDER LOOP
// ============================================================

/**
 * Start the render loop
 */
function startRenderLoop() {
  AppState.isRunning = true;
  renderFrame();
}

/**
 * Main render frame
 */
async function renderFrame() {
  if (!AppState.isInitialized || !AppState.isRunning) {
    AppState.animationFrameId = requestAnimationFrame(renderFrame);
    return;
  }
  
  const timestamp = performance.now();
  
  try {
    // Process frame with tracker
    const trackingData = await AppState.tracker.processFrame(timestamp);
    
    // Update alignment if tracking is good
    if (trackingData && trackingData.quality?.isTracking) {
      AppState.alignment.updateAlignment(
        trackingData,
        trackingData.anatomy,
        0.016 // Approximate delta
      );
    }
    
    // Render
    AppState.alignment.render();
    
    // Update FPS
    AppState.frameCount++;
    if (timestamp - AppState.lastFpsUpdate > 1000) {
      AppState.fps = AppState.frameCount;
      AppState.frameCount = 0;
      AppState.lastFpsUpdate = timestamp;
      updateFpsUI(AppState.fps);
    }
    
  } catch (error) {
    console.error('[APP] Render error:', error);
  }
  
  AppState.animationFrameId = requestAnimationFrame(renderFrame);
}

/**
 * Stop the render loop
 */
function stopRenderLoop() {
  AppState.isRunning = false;
  if (AppState.animationFrameId) {
    cancelAnimationFrame(AppState.animationFrameId);
    AppState.animationFrameId = null;
  }
}

// ============================================================
// UI UPDATES
// ============================================================

/**
 * Update loading progress
 * @param {number} percent 
 * @param {string} message 
 */
function updateLoadingProgress(percent, message) {
  const progressBar = document.getElementById('loading-progress');
  const loadingMessage = document.getElementById('loading-message');
  
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
  
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}

/**
 * Hide loading screen
 */
function hideLoadingScreen() {
  if (AppState.loadingScreen) {
    AppState.loadingScreen.style.opacity = '0';
    setTimeout(() => {
      AppState.loadingScreen.style.display = 'none';
    }, 300);
  }
  
  if (AppState.mainContent) {
    AppState.mainContent.style.display = 'block';
  }
}

/**
 * Show error screen
 * @param {string} message 
 */
function showErrorScreen(message) {
  hideLoadingScreen();
  
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="error-screen centered">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <h2>Initialization Failed</h2>
          <p>${message}</p>
          <div class="error-details">
            <p>✅ Use Chrome/Firefox on desktop or modern mobile</p>
            <p>✅ Allow camera permissions</p>
            <p>✅ Ensure good lighting</p>
            <p>✅ Refresh page if loading fails</p>
          </div>
          <button onclick="location.reload()" class="btn-primary">Retry</button>
        </div>
      </div>
    `;
  }
}

/**
 * Update tracking UI
 * @param {Object} data 
 */
function updateTrackingUI(data) {
  // Update confidence display
  const confidenceEl = document.getElementById('confidence-value');
  if (confidenceEl) {
    confidenceEl.textContent = `${Math.round(data.confidence * 100)}%`;
  }
  
  // Update face width
  const faceWidthEl = document.getElementById('face-width');
  if (faceWidthEl && data.anatomy?.faceWidth) {
    faceWidthEl.textContent = `${Math.round(data.anatomy.faceWidth)}mm`;
  }
  
  // Update IPD
  const ipdEl = document.getElementById('face-ipd');
  if (ipdEl && data.anatomy?.interPupillaryDistance) {
    ipdEl.textContent = `${Math.round(data.anatomy.interPupillaryDistance)}mm`;
  }
  
  // Update glasses scale
  const scaleEl = document.getElementById('glasses-scale');
  if (scaleEl && data.scale) {
    scaleEl.textContent = data.scale.x.toFixed(2);
  }
}

/**
 * Update state UI
 * @param {string} state 
 */
function updateStateUI(state) {
  const stateEl = document.getElementById('tracking-state');
  if (stateEl) {
    stateEl.textContent = state.replace(/_/g, ' ').toUpperCase();
    stateEl.className = `tracking-state state-${state}`;
  }
}

/**
 * Update quality UI
 * @param {number} quality 
 */
function updateQualityUI(quality) {
  const qualityEl = document.getElementById('quality-bar');
  if (qualityEl) {
    qualityEl.style.width = `${quality * 100}%`;
    
    // Color based on quality
    if (quality >= 0.75) {
      qualityEl.style.backgroundColor = '#4CAF50';
    } else if (quality >= 0.5) {
      qualityEl.style.backgroundColor = '#FFC107';
    } else {
      qualityEl.style.backgroundColor = '#F44336';
    }
  }
}

/**
 * Update FPS UI
 * @param {number} fps 
 */
function updateFpsUI(fps) {
  const fpsEl = document.getElementById('fps-value');
  if (fpsEl) {
    fpsEl.textContent = fps;
  }
}

/**
 * Show tracking lost UI
 */
function showTrackingLostUI() {
  const overlay = document.getElementById('tracking-lost-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
}

/**
 * Hide tracking lost UI
 */
function hideTrackingLostUI() {
  const overlay = document.getElementById('tracking-lost-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Window resize
  window.addEventListener('resize', handleResize);
  
  // Page visibility
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Cleanup on unload
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);
  
  // Frame selection (if UI exists)
  const frameButtons = document.querySelectorAll('.frame-select-btn');
  frameButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const frameId = e.target.dataset.frameId;
      if (frameId) {
        loadGlassesModel(frameId);
      }
    });
  });
  
  // Debug toggle
  document.addEventListener('keydown', (e) => {
    if (e.key === 'd' && e.ctrlKey) {
      AppState.debugMode = !AppState.debugMode;
      console.log(`[APP] Debug mode: ${AppState.debugMode}`);
    }
  });
}

/**
 * Handle window resize
 */
function handleResize() {
  if (!AppState.video || !AppState.alignment) return;
  
  const width = AppState.video.videoWidth;
  const height = AppState.video.videoHeight;
  
  AppState.alignment.resize(width, height);
}

/**
 * Handle page visibility change
 */
function handleVisibilityChange() {
  if (document.hidden) {
    stopRenderLoop();
  } else {
    startRenderLoop();
  }
}

/**
 * Cleanup resources
 */
function cleanup() {
  console.log('[APP] Cleaning up...');
  
  stopRenderLoop();
  
  if (AppState.tracker) {
    AppState.tracker.destroy();
    AppState.tracker = null;
  }
  
  if (AppState.alignment) {
    AppState.alignment.destroy();
    AppState.alignment = null;
  }
  
  // Stop camera stream
  if (AppState.video && AppState.video.srcObject) {
    AppState.video.srcObject.getTracks().forEach(track => track.stop());
  }
  
  AppState.isInitialized = false;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Switch glasses frame
 * @param {string} frameId 
 */
window.switchFrame = async function(frameId) {
  await loadGlassesModel(frameId);
};

/**
 * Get current tracking data
 * @returns {Object|null}
 */
window.getTrackingData = function() {
  return AppState.tracker?.getTrackingData();
};

/**
 * Get glasses recommendations
 * @returns {Object|null}
 */
window.getRecommendations = function() {
  return AppState.tracker?.getGlassesRecommendations();
};

/**
 * Calibrate with known IPD
 * @param {number} ipd - IPD in mm
 */
window.calibrateIPD = function(ipd) {
  AppState.tracker?.calibrate(ipd, 'ipd');
};

/**
 * Get performance metrics
 * @returns {Object}
 */
window.getPerformance = function() {
  return AppState.tracker?.getPerformanceMetrics();
};

/**
 * Reset tracking
 */
window.resetTracking = function() {
  AppState.tracker?.reset();
};

// ============================================================
// BOOTSTRAP
// ============================================================

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

export { AppState, initializeApp, cleanup };
