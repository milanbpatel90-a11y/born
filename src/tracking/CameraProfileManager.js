/**
 * CameraProfileManager.js
 * 
 * LocalStorage profile management for device-specific calibration
 */

export class CameraProfileManager {
  constructor() {
    this.storageKey = 'vto_camera_profiles';
    this.profiles = this._loadProfiles();
  }

  /**
   * Load all camera profiles from localStorage
   */
  _loadProfiles() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[PROFILE] Failed to load profiles:', error);
      return {};
    }
  }

  /**
   * Save profiles to localStorage
   */
  _saveProfiles() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
    } catch (error) {
      console.error('[PROFILE] Failed to save profiles:', error);
    }
  }

  /**
   * Generate profile key for device
   */
  _generateProfileKey(deviceId, width, height) {
    return `${deviceId}_${width}x${height}`;
  }

  /**
   * Save camera profile
   */
  save(deviceId, focalLength, width, height) {
    const key = this._generateProfileKey(deviceId, width, height);
    
    this.profiles[key] = {
      deviceId,
      focalLength,
      width,
      height,
      timestamp: Date.now(),
      version: '5.0'
    };
    
    this._saveProfiles();
    console.log(`[PROFILE] Saved profile: ${key} (focal: ${focalLength.toFixed(1)}px)`);
  }

  /**
   * Load camera profile
   */
  load(deviceId, width, height) {
    const key = this._generateProfileKey(deviceId, width, height);
    const profile = this.profiles[key];
    
    if (!profile) {
      console.log(`[PROFILE] No profile found for: ${key}`);
      return null;
    }
    
    // Check if profile is recent (within 30 days)
    const age = Date.now() - profile.timestamp;
    if (age > 30 * 24 * 60 * 60 * 1000) {
      console.log(`[PROFILE] Profile expired for: ${key}`);
      delete this.profiles[key];
      this._saveProfiles();
      return null;
    }
    
    console.log(`[PROFILE] Loaded profile: ${key} (focal: ${profile.focalLength.toFixed(1)}px)`);
    return profile;
  }

  /**
   * Get all profiles
   */
  getAllProfiles() {
    return Object.entries(this.profiles).map(([key, profile]) => ({
      key,
      ...profile
    }));
  }

  /**
   * Clear all profiles
   */
  clearAll() {
    this.profiles = {};
    this._saveProfiles();
    console.log('[PROFILE] Cleared all profiles');
  }

  /**
   * Clear expired profiles
   */
  clearExpired() {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    let cleared = 0;
    for (const [key, profile] of Object.entries(this.profiles)) {
      if (now - profile.timestamp > maxAge) {
        delete this.profiles[key];
        cleared++;
      }
    }
    
    if (cleared > 0) {
      this._saveProfiles();
      console.log(`[PROFILE] Cleared ${cleared} expired profiles`);
    }
    
    return cleared;
  }

  /**
   * Export profiles for backup
   */
  export() {
    return JSON.stringify(this.profiles, null, 2);
  }

  /**
   * Import profiles from backup
   */
  import(profilesJson) {
    try {
      const imported = JSON.parse(profilesJson);
      this.profiles = { ...this.profiles, ...imported };
      this._saveProfiles();
      console.log('[PROFILE] Imported profiles successfully');
      return true;
    } catch (error) {
      console.error('[PROFILE] Failed to import profiles:', error);
      return false;
    }
  }
}
