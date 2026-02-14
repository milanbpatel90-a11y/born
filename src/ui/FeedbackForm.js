/**
 * FeedbackForm.js
 * 
 * Customer feedback collection system
 */

export class FeedbackForm {
  constructor() {
    this.modal = document.getElementById('feedback-modal');
    this.ratingButtons = null;
    this.commentTextarea = null;
    this.submitButton = null;
    this.skipButton = null;
    
    this.currentRating = 0;
    this.isVisible = false;
    
    this._initializeElements();
    this._initializeEventListeners();
  }

  /**
   * Initialize DOM elements
   */
  _initializeElements() {
    if (!this.modal) return;
    
    this.ratingButtons = this.modal.querySelectorAll('.rating-btn');
    this.commentTextarea = this.modal.getElementById?.('feedback-comment') || 
                          this.modal.querySelector('#feedback-comment');
    this.submitButton = this.modal.getElementById?.('submit-feedback') || 
                       this.modal.querySelector('#submit-feedback');
    this.skipButton = this.modal.getElementById?.('skip-feedback') || 
                     this.modal.querySelector('#skip-feedback');
  }

  /**
   * Initialize event listeners
   */
  _initializeEventListeners() {
    if (!this.modal) return;
    
    // Rating buttons
    this.ratingButtons?.forEach(button => {
      button.addEventListener('click', (e) => {
        this._handleRatingClick(e.target);
      });
    });
    
    // Submit button
    this.submitButton?.addEventListener('click', () => {
      this._handleSubmit();
    });
    
    // Skip button
    this.skipButton?.addEventListener('click', () => {
      this.hide();
    });
    
    // Close modal on outside click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * Handle rating button click
   */
  _handleRatingClick(button) {
    const rating = parseInt(button.dataset.rating);
    this.currentRating = rating;
    
    // Update button states
    this.ratingButtons?.forEach((btn, index) => {
      if (index < rating) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
    
    // Enable submit button if rating is selected
    if (this.submitButton) {
      this.submitButton.disabled = rating === 0;
    }
  }

  /**
   * Handle form submission
   */
  _handleSubmit() {
    if (this.currentRating === 0) {
      this._showError('Please select a rating');
      return;
    }
    
    const feedback = {
      rating: this.currentRating,
      comment: this.commentTextarea?.value || '',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      sessionId: this._getSessionId()
    };
    
    // Save to localStorage
    this._saveFeedback(feedback);
    
    // Show success message
    this._showSuccess('Thank you for your feedback!');
    
    // Hide modal
    setTimeout(() => {
      this.hide();
    }, 1500);
    
    // Reset form
    this._resetForm();
  }

  /**
   * Save feedback to localStorage
   */
  _saveFeedback(feedback) {
    try {
      const existingFeedback = JSON.parse(localStorage.getItem('vto_feedback') || '[]');
      existingFeedback.push(feedback);
      
      // Keep only last 100 feedback entries
      if (existingFeedback.length > 100) {
        existingFeedback.splice(0, existingFeedback.length - 100);
      }
      
      localStorage.setItem('vto_feedback', JSON.stringify(existingFeedback));
      console.log('[FEEDBACK] Feedback saved:', feedback);
      
    } catch (error) {
      console.error('[FEEDBACK] Failed to save feedback:', error);
    }
  }

  /**
   * Get or create session ID
   */
  _getSessionId() {
    let sessionId = sessionStorage.getItem('vto_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('vto_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Show feedback modal
   */
  show() {
    if (!this.modal) return;
    
    this.isVisible = true;
    this.modal.style.display = 'flex';
    this.modal.style.opacity = '0';
    
    // Fade in
    setTimeout(() => {
      this.modal.style.opacity = '1';
    }, 10);
    
    // Focus on first rating button
    if (this.ratingButtons?.length > 0) {
      this.ratingButtons[0].focus();
    }
  }

  /**
   * Hide feedback modal
   */
  hide() {
    if (!this.modal) return;
    
    this.isVisible = false;
    this.modal.style.opacity = '0';
    
    setTimeout(() => {
      this.modal.style.display = 'none';
    }, 300);
  }

  /**
   * Reset form state
   */
  _resetForm() {
    this.currentRating = 0;
    
    // Reset rating buttons
    this.ratingButtons?.forEach(button => {
      button.classList.remove('selected');
    });
    
    // Clear comment
    if (this.commentTextarea) {
      this.commentTextarea.value = '';
    }
    
    // Disable submit button
    if (this.submitButton) {
      this.submitButton.disabled = true;
    }
  }

  /**
   * Show error message
   */
  _showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'feedback-error';
    errorDiv.textContent = message;
    
    this.modal?.querySelector('.modal-content')?.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  /**
   * Show success message
   */
  _showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'feedback-success';
    successDiv.textContent = message;
    
    this.modal?.querySelector('.modal-content')?.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }

  /**
   * Get all feedback from localStorage
   */
  static getAllFeedback() {
    try {
      return JSON.parse(localStorage.getItem('vto_feedback') || '[]');
    } catch (error) {
      console.error('[FEEDBACK] Failed to load feedback:', error);
      return [];
    }
  }

  /**
   * Export feedback as JSON
   */
  static exportFeedback() {
    const feedback = this.getAllFeedback();
    const dataStr = JSON.stringify(feedback, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `vto_feedback_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  /**
   * Get feedback statistics
   */
  static getFeedbackStats() {
    const feedback = this.getAllFeedback();
    
    if (feedback.length === 0) {
      return {
        total: 0,
        averageRating: 0,
        ratingDistribution: {}
      };
    }
    
    const totalRatings = feedback.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = totalRatings / feedback.length;
    
    const ratingDistribution = {};
    feedback.forEach(f => {
      ratingDistribution[f.rating] = (ratingDistribution[f.rating] || 0) + 1;
    });
    
    return {
      total: feedback.length,
      averageRating: averageRating.toFixed(2),
      ratingDistribution
    };
  }

  /**
   * Clear all feedback
   */
  static clearAllFeedback() {
    localStorage.removeItem('vto_feedback');
    console.log('[FEEDBACK] All feedback cleared');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Remove event listeners
    this.ratingButtons?.forEach(button => {
      button.removeEventListener('click', this._handleRatingClick);
    });
    
    this.submitButton?.removeEventListener('click', this._handleSubmit);
    this.skipButton?.removeEventListener('click', this.hide);
    
    document.removeEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
    
    console.log('[FEEDBACK] FeedbackForm destroyed');
  }
}
