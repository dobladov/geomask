// Geolocation API Override Script
// This script is injected into web pages to override the Geolocation API

(() => {
  'use strict';

  const root = document.documentElement;

  // Store original geolocation methods
  const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const originalWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);

  /** Read geo data from DOM attribute (set by content script) */
  const getGeoData = () => {
    try {
      const data = root.dataset["spGeoData"];
      return data ? JSON.parse(data) : { enabled: false };
    } catch (e) {
      console.error('[Location Spoof] Failed to parse geo data:', e);
      return { enabled: false };
    }
  }

  /**
   * Create a fake position object
   * @param {number} latitude 
   * @param {number} longitude 
   * @param {number} accuracy 
   * @returns {GeolocationPosition}
   */
  const createPosition = (latitude, longitude, accuracy = 100) => {
    const coords = {
      latitude: latitude,
      longitude: longitude,
      accuracy: accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return {
          latitude: this.latitude,
          longitude: this.longitude,
          accuracy: this.accuracy,
          altitude: this.altitude,
          altitudeAccuracy: this.altitudeAccuracy,
          heading: this.heading,
          speed: this.speed
        };
      }
    };
    return {
      coords,
      timestamp: Date.now(),
      toJSON() {
        return {
          coords: coords.toJSON(),
          timestamp: this.timestamp
        };
      }
    };
  }

  // Override getCurrentPosition
  navigator.geolocation.getCurrentPosition = function(successCallback, errorCallback, options) {
    const prefs = getGeoData();
    console.log('[Location Spoof] getCurrentPosition prefs:', prefs);

    if (!prefs.enabled) {
      return originalGetCurrentPosition(successCallback, errorCallback, options);
    }

    if (prefs.latitude !== undefined && prefs.longitude !== undefined) {
      const position = createPosition(prefs.latitude, prefs.longitude, prefs.accuracy || 100);
      console.log('[Location Spoof] Returning spoofed position:', position.coords.latitude, position.coords.longitude);
      // Use setTimeout to match async behavior of real API
      setTimeout(() => successCallback(position), 0);
    } else {
      originalGetCurrentPosition(successCallback, errorCallback, options);
    }
  };

  // Override watchPosition
  navigator.geolocation.watchPosition = function(successCallback, errorCallback, options) {
    const prefs = getGeoData();

    if (!prefs.enabled) {
      return originalWatchPosition(successCallback, errorCallback, options);
    }

    const watchId = Math.floor(Math.random() * 10000);
    let active = true;

    const update = () => {
      if (!active) return;
      const currentPrefs = getGeoData();
      if (currentPrefs.latitude !== undefined && currentPrefs.longitude !== undefined) {
        const position = createPosition(currentPrefs.latitude, currentPrefs.longitude, currentPrefs.accuracy || 100);
        successCallback(position);
      }
    };

    // Initial update (async to match real API behavior)
    setTimeout(update, 0);

    // Periodic updates (every 5 seconds)
    const intervalId = setInterval(update, 5000);

    // Store clear function
    navigator.geolocation._watches = navigator.geolocation._watches || {};
    navigator.geolocation._watches[watchId] = () => {
      active = false;
      clearInterval(intervalId);
    };

    return watchId;
  };

  // Override clearWatch
  const originalClearWatch = navigator.geolocation.clearWatch.bind(navigator.geolocation);
  navigator.geolocation.clearWatch = function(watchId) {
    if (navigator.geolocation._watches && navigator.geolocation._watches[watchId]) {
      navigator.geolocation._watches[watchId]();
      delete navigator.geolocation._watches[watchId];
    }
    originalClearWatch(watchId);
  };

  console.log('[Location Spoof] Geolocation API override active');
})();
