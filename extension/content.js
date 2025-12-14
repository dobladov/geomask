// Content script - bridges between inject script and background

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const root = document.documentElement;

const DEFAULT_PREFS = {
  latitude: 52.509948,
  longitude: 13.404264,
  accuracy: 100,
  enabled: true
};

/** Update the geo data in the DOM for the inject script to read */
const updateGeoData = async () => {
  try {
    const prefs = await browserAPI.storage.local.get(DEFAULT_PREFS);
    root.dataset["spGeoData"] = JSON.stringify(prefs);
  } catch (e) {
    console.error('[Location Spoof] Error getting preferences:', e);
    root.dataset["spGeoData"] = JSON.stringify({ enabled: false });
  }
};

/** Inject the geolocation override script into the page */
const injectScript = () => {
  const script = document.createElement('script');
  script.src = browserAPI.runtime.getURL('inject.js');
  script.onload = script.remove;
  (document.head || document.documentElement).appendChild(script);
};

// Set initial data, then inject script
updateGeoData().then(injectScript);

// Update data when storage changes
browserAPI.storage.onChanged.addListener(() => updateGeoData());

console.log('[Location Spoof] Content script loaded');
