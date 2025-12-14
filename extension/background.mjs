import { DEFAULT_LOCATION } from "./constants.mjs";

// Background script
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Initialize default settings on install
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    browserAPI.storage.local.set({
      enabled: true,
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
      accuracy: 100
    });
    console.log('[Location Spoof] Extension installed with default settings');
  }
});
