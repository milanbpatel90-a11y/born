/**
 * Optical Try-On v5.0 - Main Application Entry Point
 * 
 * Initializes all systems and starts the tracking loop
 */

import { CameraSetup } from './camera/CameraSetup.js';
import { ProfessionalFaceTracker } from './tracking/ProfessionalFaceTracker.js';
import { GlassesRenderer } from './rendering/GlassesRenderer.js';
import { UIManager } from './ui/UIManager.js';
import { analytics } from './utils/analytics.js';

// Global state
let faceTracker = null;
let glassesRenderer = null;
let stream = null;
let animationFrameId = null;
let isInitialized = false;

// DOM Elements
const video = document.getElementById('user-video');
const canvas = document.getElementById('tracking-canvas');
const glassesCanvas = document.getElementById('glasses-canvas');
const loadingScreen = document.getElementById('loading-screen');
const mainContent = document.getElementById('main-content');
const loadingMessage = document.getElementById('loading-message');
const loadingProgress = document.getElementById('loading-progress');

// Initialize application
async function initApplication() {
  try {
    // Step 1: Wait for OpenCV.js
    updateLoadingProgress(10, 'Loading OpenCV.js...');
    await waitForOpenCV();
    updateLoadingProgress(30, 'OpenCV loaded. Initializing trackers...');
    
    // Step 2: Setup camera
    updateLoadingProgress(40, 'Requesting camera access...');
    const cameraSetup = new CameraSetup();
    
    try {
      stream = await cameraSetup.requestCameraStreamEnhanced();
      video.srcObject = stream;
      await video.play();
    } catch (cameraError) {
      console.error('[MAIN] Camera setup failed:', cameraError);
      throw new Error(`Camera access failed: ${cameraError.message}`);
    }
    
    // Set canvas dimensions
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    updateLoadingProgress(60, 'Initializing face tracker...');
    
    // Step 3: Initialize UI Manager
    const uiManager = new UIManager({
      onFrameSelected: (frameId) => {
        loadFrameModel(frameId);
      }
    });
    
    // Step 4: Initialize tracker with tracking canvas (2D context)
    faceTracker = new ProfessionalFaceTracker(video, canvas, {
      onCalibrated: () => {
        uiManager.hideCalibration();
        uiManager.showInstructions();
      },
      onCalibrationProgress: (current, total) => {
        uiManager.updateCalibrationProgress(current, total);
      },
      onConfidenceUpdate: (confidence) => {
        uiManager.updateConfidence(confidence);
      },
      onEarDetection: (hasEars) => {
        uiManager.updateEarDetectionStatus(hasEars);
      },
      onTrackingStateChange: (state) => {
        uiManager.updateTrackingState(state);
      }
    });
    
    updateLoadingProgress(80, 'Setting up 3D renderer...');
    
    // Step 5: Initialize renderer with separate canvas for glasses
    if (glassesCanvas) {
      glassesCanvas.width = canvas.width;
      glassesCanvas.height = canvas.height;
      glassesRenderer = new GlassesRenderer(glassesCanvas);
    } else {
      // Fallback to tracking canvas if glasses canvas not found
      glassesRenderer = new GlassesRenderer(canvas);
    }
    
    // Load default frame model
    await loadDefaultFrame();
    updateLoadingProgress(95, 'Finalizing setup...');
    
    // Step 6: Start render loop
    setTimeout(() => {
      startRenderLoop();
      uiManager.showMainContent();
      hideLoadingScreen();
      
      isInitialized = true;
      analytics.trackEvent('app_initialized');
      
      updateLoadingProgress(100, 'Ready!');
      setTimeout(hideLoadingScreen, 500);
    }, 300);
    
  } catch (error) {
    console.error('[MAIN] Initialization failed:', error);
    showErrorScreen(error.message || 'Failed to initialize application');
  }
}

// Wait for OpenCV.js to load
function waitForOpenCV() {
  return new Promise((resolve, reject) => {
    if (window.opencvReady && typeof cv !== 'undefined') {
      console.log('[INIT] OpenCV.js already loaded');
      resolve();
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('OpenCV.js failed to load within 30 seconds'));
    }, 30000);
    
    window.addEventListener('opencvLoaded', () => {
      clearTimeout(timeout);
      console.log('[INIT] OpenCV.js loaded successfully');
      resolve();
    });
    
    // Fallback check
    const checkInterval = setInterval(() => {
      if (window.opencvReady && typeof cv !== 'undefined') {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        console.log('[INIT] OpenCV.js detected');
        resolve();
      }
    }, 100);
  });
}

// Update loading progress UI
function updateLoadingProgress(percent, message) {
  if (loadingProgress) {
    loadingProgress.style.width = `${percent}%`;
  }
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}

// Hide loading screen
function hideLoadingScreen() {
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 300);
  }
  if (mainContent) {
    mainContent.style.display = 'block';
  }
}

// Show error screen
function showErrorScreen(message) {
  hideLoadingScreen();
  const app = document.getElementById('app');
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

// Load default frame model
async function loadDefaultFrame() {
  try {
    // Load imported glasses model by default
    await glassesRenderer.loadModel('glasses2');
    analytics.trackEvent('frame_loaded', { frameId: 'glasses2' });
  } catch (error) {
    console.error('[MAIN] Failed to load default frame:', error);
  }
}

// Load specific frame model
async function loadFrameModel(frameId) {
  try {
    await glassesRenderer.loadModel(frameId);
    analytics.trackEvent('frame_selected', { frameId });
  } catch (error) {
    console.error(`[MAIN] Failed to load frame ${frameId}:`, error);
    // Fallback to glasses2
    await loadDefaultFrame();
  }
}

// Start render loop
function startRenderLoop() {
  async function renderFrame() {
    if (!isInitialized || !faceTracker || !glassesRenderer) {
      animationFrameId = requestAnimationFrame(renderFrame);
      return;
    }
    
    try {
      const trackingData = await faceTracker.processFrame(performance.now());
      
      if (trackingData && trackingData.effectiveConfidence > 0.35) {
        glassesRenderer.updateFromTrackingData(trackingData);
        analytics.trackEvent('frame_rendered');
      } else {
        glassesRenderer.fadeOut();
      }
    } catch (error) {
      console.error('[MAIN] Render error:', error);
    }
    
    animationFrameId = requestAnimationFrame(renderFrame);
  }
  
  renderFrame();
}

// Cleanup on unload
function cleanup() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  if (faceTracker) {
    faceTracker.destroy();
  }
  
  if (glassesRenderer) {
    glassesRenderer.destroy();
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  
  analytics.trackEvent('app_destroyed');
}

// Event listeners
window.addEventListener('beforeunload', cleanup);
window.addEventListener('unload', cleanup);

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApplication);
} else {
  initApplication();
}

// Export for debugging
window.app = {
  faceTracker,
  glassesRenderer,
  reload: () => location.reload(),
  exportFeedback: () => {
    const feedback = localStorage.getItem('vto_feedback');
    if (feedback) {
      console.log('Customer Feedback:', JSON.parse(feedback));
      return JSON.parse(feedback);
    }
    return [];
  }
};
