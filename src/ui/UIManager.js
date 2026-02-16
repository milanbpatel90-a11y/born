/**
 * UIManager.js
 * 
 * All UI state management for the optical try-on application
 */

import { FeedbackForm } from './FeedbackForm.js';

export class UIManager {
  constructor(options = {}) {
    this.options = options;
    this.feedbackForm = new FeedbackForm();
    
    // UI Elements
    this.loadingScreen = document.getElementById('loading-screen');
    this.mainContent = document.getElementById('main-content');
    this.calibrationUI = document.getElementById('calibration-ui');
    this.confidenceIndicator = document.getElementById('confidence-indicator');
    this.featuresBadge = document.getElementById('features-badge');
    this.instructions = document.getElementById('instructions');
    this.frameSelector = document.getElementById('frame-selector');
    
    // Progress elements
    this.calProgressBar = document.getElementById('cal-progress-bar');
    this.calCurrent = document.getElementById('cal-current');
    this.calTotal = document.getElementById('cal-total');
    this.confidenceFill = document.getElementById('confidence-fill');
    this.badgeText = document.getElementById('badge-text');
    
    // Initialize event listeners
    this._initializeEventListeners();
    
    // Load frame library
    this._loadFrameLibrary();
  }

  /**
   * Initialize event listeners
   */
  _initializeEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this._handleResize());
    
    // Frame selection
    if (this.frameSelector) {
      this.frameSelector.addEventListener('click', (e) => {
        const frameOption = e.target.closest('.frame-option');
        if (!frameOption || !this.frameSelector.contains(frameOption)) return;
        const frameId = frameOption.dataset.frameId;
        this._setSelectedFrame(frameId);
        this.options.onFrameSelected?.(frameId);
      });
    }
    
    // Instructions dismiss
    const instructionsBox = this.instructions?.querySelector('.instructions-box');
    if (instructionsBox) {
      instructionsBox.addEventListener('click', () => {
        this.hideInstructions();
      });
    }
  }

  /**
   * Load frame library and populate selector
   */
  async _loadFrameLibrary() {
    try {
      const response = await fetch('./assets/config/frameLibrary.json');
      const library = await response.json();
      
      this._populateFrameSelector(library.frames);
      
    } catch (error) {
      console.warn('[UI] Failed to load frame library:', error);
      this._populateFrameSelector(this._getDefaultFrames());
    }
  }

  /**
   * Populate frame selector with available frames
   */
  _populateFrameSelector(frames) {
    if (!this.frameSelector) return;
    
    this.frameSelector.innerHTML = '';
    
    frames.forEach(frame => {
      const frameOption = document.createElement('div');
      frameOption.className = 'frame-option';
      frameOption.dataset.frameId = frame.id;
      frameOption.innerHTML = `
        <div class="frame-thumbnail">
          <img src="${frame.thumbnail || './assets/images/placeholder-frame.png'}" alt="${frame.name}">
        </div>
        <div class="frame-info">
          <div class="frame-name">${frame.name}</div>
          <div class="frame-price">${frame.price || ''}</div>
        </div>
      `;
      
      this.frameSelector.appendChild(frameOption);
    });

    this._setSelectedFrame('glasses2');
  }

  _setSelectedFrame(frameId) {
    if (!this.frameSelector) return;
    this.frameSelector.querySelectorAll('.frame-option').forEach((el) => {
      if (el.dataset.frameId === frameId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  /**
   * Get default frames for fallback
   */
  _getDefaultFrames() {
    return [
      { id: 'glasses2', name: 'Glasses 2', price: 'INR 3999' }
    ];
  }

  /**
   * Update calibration progress
   */
  updateCalibrationProgress(current, total) {
    if (this.calProgressBar) {
      const percentage = (current / total) * 100;
      this.calProgressBar.style.width = `${percentage}%`;
    }
    
    if (this.calCurrent) {
      this.calCurrent.textContent = current;
    }
    
    if (this.calTotal) {
      this.calTotal.textContent = total;
    }
  }

  /**
   * Update confidence indicator
   */
  updateConfidence(confidence) {
    if (!this.confidenceFill) return;
    
    // Convert confidence (0-1) to percentage
    const percentage = Math.max(0, Math.min(100, confidence * 100));
    this.confidenceFill.style.width = `${percentage}%`;
    
    // Update color based on confidence level
    if (confidence > 0.7) {
      this.confidenceFill.style.backgroundColor = '#4CAF50'; // Green
    } else if (confidence > 0.4) {
      this.confidenceFill.style.backgroundColor = '#FF9800'; // Orange
    } else {
      this.confidenceFill.style.backgroundColor = '#F44336'; // Red
    }
  }

  /**
   * Update ear detection status
   */
  updateEarDetectionStatus(hasEars) {
    if (!this.badgeText) return;
    
    if (hasEars) {
      this.badgeText.textContent = 'Ear Detection Active';
      this.featuresBadge?.classList.add('active');
    } else {
      this.badgeText.textContent = 'Ear Detection Inactive';
      this.featuresBadge?.classList.remove('active');
    }
  }

  /**
   * Update tracking state
   */
  updateTrackingState(state) {
    // Update UI based on tracking state
    switch (state) {
      case 'TRACKING':
        this._showTrackingActive();
        break;
      case 'LOST':
        this._showTrackingLost();
        break;
      case 'CALIBRATING':
        this._showCalibrating();
        break;
    }
  }

  /**
   * Show tracking active state
   */
  _showTrackingActive() {
    this.confidenceIndicator?.classList.add('active');
    this.featuresBadge?.classList.add('active');
  }

  /**
   * Show tracking lost state
   */
  _showTrackingLost() {
    this.confidenceIndicator?.classList.remove('active');
    this.updateConfidence(0);
  }

  /**
   * Show calibrating state
   */
  _showCalibrating() {
    this.calibrationUI?.classList.add('active');
  }

  /**
   * Show main content
   */
  showMainContent() {
    if (this.mainContent) {
      this.mainContent.style.display = 'block';
      this.mainContent.style.opacity = '1';
    }
  }

  /**
   * Hide calibration UI
   */
  hideCalibration() {
    if (this.calibrationUI) {
      this.calibrationUI.style.opacity = '0';
      setTimeout(() => {
        this.calibrationUI.style.display = 'none';
      }, 300);
    }
  }

  /**
   * Show instructions
   */
  showInstructions() {
    if (this.instructions) {
      this.instructions.style.display = 'block';
      this.instructions.style.opacity = '1';
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        this.hideInstructions();
      }, 10000);
    }
  }

  /**
   * Hide instructions
   */
  hideInstructions() {
    if (this.instructions) {
      this.instructions.style.opacity = '0';
      setTimeout(() => {
        this.instructions.style.display = 'none';
      }, 300);
    }
  }

  /**
   * Show feedback modal
   */
  showFeedbackModal() {
    this.feedbackForm.show();
  }

  /**
   * Handle window resize
   */
  _handleResize() {
    // Update canvas size if needed
    const canvas = document.getElementById('tracking-canvas');
    const video = document.getElementById('user-video');
    
    if (canvas && video) {
      canvas.width = video.videoWidth || window.innerWidth;
      canvas.height = video.videoHeight || window.innerHeight;
    }
  }

  /**
   * Show error message
   */
  showError(message, duration = 5000) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">${message}</span>
        <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, duration);
  }

  /**
   * Show success message
   */
  showSuccess(message, duration = 3000) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-toast';
    successDiv.innerHTML = `
      <div class="success-content">
        <span class="success-icon">✅</span>
        <span class="success-message">${message}</span>
        <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (successDiv.parentElement) {
        successDiv.remove();
      }
    }, duration);
  }

  /**
   * Get current UI state
   */
  getState() {
    return {
      calibrationVisible: this.calibrationUI?.style.display !== 'none',
      instructionsVisible: this.instructions?.style.display !== 'none',
      confidenceLevel: this.confidenceFill?.style.width || '0%',
      earDetectionActive: this.badgeText?.textContent?.includes('Active') || false
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.feedbackForm) {
      this.feedbackForm.destroy();
    }
    
    // Remove event listeners
    window.removeEventListener('resize', this._handleResize);
    
    console.log('[UI] UIManager destroyed');
  }
}

