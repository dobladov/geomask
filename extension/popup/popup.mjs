const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const nominatimBaseURL = 'https://nominatim.openstreetmap.org';

import { DEFAULT_LOCATION } from '../constants.mjs';

// Rate limiter for Nominatim API (max 1 request per second)
const NOMINATIM_MIN_INTERVAL = 1000;
/** @type {number} */
let lastNominatimRequest = 0;
/** @type {Promise<void> | null} */
let pendingRateLimitPromise = null;

/**
 * Rate-limited fetch for Nominatim API
 * Ensures at least 1 second between requests
 * @param {string} url
 */
const nominatimFetch = async (url) => {
  // Wait for any pending rate limit
  if (pendingRateLimitPromise) {
    await pendingRateLimitPromise;
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastNominatimRequest;
  
  if (timeSinceLastRequest < NOMINATIM_MIN_INTERVAL) {
    const waitTime = NOMINATIM_MIN_INTERVAL - timeSinceLastRequest;
    pendingRateLimitPromise = new Promise(resolve => setTimeout(resolve, waitTime));
    await pendingRateLimitPromise;
    pendingRateLimitPromise = null;
  }

  lastNominatimRequest = Date.now();
  return fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
};

/**
 * Update extension badge
 * @param {boolean} enabled 
 */
const updateBadge = (enabled) => {
  const color = enabled ? '#4ade80' : '#ef4444';
  const text = enabled ? 'ON' : 'OFF';

  try {
    browserAPI.action.setBadgeBackgroundColor({ color });
    browserAPI.action.setBadgeText({ text });
  } catch {
    // Fallback for older APIs
    try {
      browserAPI.browserAction.setBadgeBackgroundColor({ color });
      browserAPI.browserAction.setBadgeText({ text });
    } catch {
      // Badge not supported
    }
  }
}

const searchInput = /** @type {HTMLInputElement} */(document.getElementById('searchInput')); 
const searchResults =  /** @type {HTMLDivElement} */(document.getElementById('searchResults'));
const toggleBtn = /** @type {HTMLButtonElement} */(document.getElementById('toggleBtn'));
const latInput = /** @type {HTMLInputElement} */(document.getElementById('latInput'));
const lngInput = /** @type {HTMLInputElement} */(document.getElementById('lngInput'));
const randomBtn = /** @type {HTMLButtonElement} */(document.getElementById('randomBtn'));
const randomRange = /** @type {HTMLInputElement} */(document.getElementById('randomRange'));
const locationName = /** @type {LocationName} */(document.getElementById('locationName'));
const savedLocations = /** @type {HTMLDivElement} */(document.getElementById('savedLocations'));
const saveLocationBtn = /** @type {HTMLButtonElement} */(document.getElementById('saveLocationBtn'));
const toggleText = /** @type {HTMLSpanElement} */(toggleBtn.querySelector('.toggle-text'));

/** @type {L.Map} */
let map;
/** @type {L.Marker} */
let marker;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let searchTimeout;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let coordInputTimeout;

/** @type {SavedPreferences["zoom"]} */
let savedZoom = 13;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initMap();
  setupEventListeners();
});

// Load saved state from storage
const loadState = async () => {
  try {
    const result = /** @type {SavedPreferences} */(await browserAPI.storage.local.get({
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
      enabled: true,
      zoom: 13,
      locationName: '',
      distanceIndex: 0,
      savedLocations: []
    }));

    savedZoom = result.zoom ?? 13;

    latInput.value = String(result.latitude);
    lngInput.value = String(result.longitude);
    randomRange.value = String(result.distanceIndex);
    updateToggleButton(result.enabled);
    updateBadge(result.enabled);
    
    // Render saved locations
    renderSavedLocations(result.savedLocations ?? []);
    
    // Use saved location name if available, otherwise fetch it
    if (result.locationName) {
      locationName.textContent = result.locationName;
    } else {
      reverseGeocode(result.latitude, result.longitude);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
    latInput.value = String(DEFAULT_LOCATION.latitude); 
    lngInput.value = String(DEFAULT_LOCATION.longitude);
  }
}

// Initialize Leaflet map
const initMap = () => {
  const lat = parseFloat(latInput.value) || DEFAULT_LOCATION.latitude;
  const lng = parseFloat(lngInput.value) || DEFAULT_LOCATION.longitude;

  map = L.map('map', {
    zoomControl: true,
  }).setView([lat, lng], savedZoom);

  // Add themed class for custom styling
  map.getContainer().classList.add('themed-map');

  // OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    minZoom: 2,
  }).addTo(map);

  // Custom marker icon
  /** @type {L.DivIcon} */
  const markerIcon = L.divIcon({
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  // Add marker
  /** @type {L.Marker} */
  marker = L.marker([lat, lng], { 
    icon: markerIcon,
    draggable: true 
  }).addTo(map);

  // Map click handler
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setLocation(lat, lng);
  });

  // Marker drag handler
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    setLocation(pos.lat, pos.lng);
  });

  // Save zoom level when changed
  map.on('zoomend', () => {
    saveZoom(map.getZoom());
  });
}

// Reverse geocode to get location name (debounced)
/** @type {ReturnType<typeof setTimeout> | undefined} */
let reverseGeocodeTimeout;
/**
 * 
 * @param {number} lat 
 * @param {number} lng 
 */
const reverseGeocodeImpl = async (lat, lng) => {
  locationName.dataset.valid = "false";

  try {
    const response = await nominatimFetch(
      `${nominatimBaseURL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`
    );
    
    /** @type {{ display_name?: string }} */
    const data = await response.json();
    
    if (data.display_name) {
      // Shorten the display name (take first 2-3 parts)
      const parts = data.display_name.split(', ');
      const shortName = parts.slice(0, 3).join(', ');
      locationName.textContent = shortName;
      locationName.dataset.valid = "true";
      saveLocationName(shortName);
    } else {
      throw new Error('No display_name in response');
    }
  } catch (e) {
    console.error('Reverse geocode failed:', e);
    locationName.textContent = `No name found for this location`;
    saveLocationName(locationName.textContent);
  } finally {
    locationName.classList.remove('loading');
  }
}

/**
 * Debounced reverse geocode
 * @param {number} lat 
 * @param {number} lng 
 */
const reverseGeocode = (lat, lng) => {
  locationName.textContent = 'Finding location name...';
  locationName.classList.add('loading');
  
  clearTimeout(reverseGeocodeTimeout);
  reverseGeocodeTimeout = setTimeout(() => {
    reverseGeocodeImpl(lat, lng);
  }, 500);
}

/**
 * Set location and update UI
 * @param {number} lat 
 * @param {number} lng 
 * @param {string} [name] - Optional location name to skip reverse geocoding
 */
const setLocation = (lat, lng, name) => {
  const latitude = parseFloat(lat.toFixed(6));
  const longitude = parseFloat(lng.toFixed(6));

  latInput.value = String(latitude);
  lngInput.value = String(longitude);

  marker.setLatLng([latitude, longitude]);
  map.flyTo([latitude, longitude], map.getZoom(), { animate: true, duration: 0.7 });
  
  // Use provided name or get location name via reverse geocoding
  if (name) {
    locationName.textContent = name;
    saveLocationName(name);
  } else {
    reverseGeocode(latitude, longitude);
  }

  saveLocation(latitude, longitude);
}

/**
 * Save location to storage
 * @param {number} lat 
 * @param {number} lng 
 */
const saveLocation = async (lat, lng) => {
  try {
    await browserAPI.storage.local.set({ latitude: lat, longitude: lng });
  } catch (e) {
    console.error('Failed to save location:', e);
  }
}

/**
 * Save zoom level to storage
 * @param {number} zoom 
 */
const saveZoom = async (zoom) => {
  try {
    await browserAPI.storage.local.set({ zoom });
  } catch (e) {
    console.error('Failed to save zoom:', e);
  }
}

/**
 * Save location name to storage
 * @param {string} name 
 */
const saveLocationName = async (name) => {
  try {
    await browserAPI.storage.local.set({ locationName: name });
  } catch (e) {
    console.error('Failed to save location name:', e);
  }
}

/**
 * Save distance index to storage
 * @param {number} index 
 */
const saveDistanceIndex = async (index) => {
  try {
    await browserAPI.storage.local.set({ distanceIndex: index });
  } catch (e) {
    console.error('Failed to save distance index:', e);
  }
}

/**
 * Save current location to saved locations list
 */
const saveCurrentLocation = async () => {
  try {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    
    if (isNaN(lat) || isNaN(lng)) return;
    
    // Use location name if available, otherwise use coordinates
    const currentName = locationName.textContent || '';
    const isValidName = locationName.dataset.valid === "true";
    const name = isValidName ? currentName : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    const result = /** @type {SavedPreferences} */(await browserAPI.storage.local.get({ savedLocations: [] }));
    /** @type {SavedLocation[]} */
    const locations = result.savedLocations ?? [];
    
    // Check if this location already exists (within 0.0001 degrees)
    const exists = locations.some(
      item => Math.abs(item.latitude - lat) < 0.0001 && Math.abs(item.longitude - lng) < 0.0001
    );
    
    if (exists) return; // Don't add duplicates
    
    // Add new location
    locations.push({ latitude: lat, longitude: lng, name });
    
    await browserAPI.storage.local.set({ savedLocations: locations });
    renderSavedLocations(locations);
  } catch (e) {
    console.error('Failed to save location:', e);
  }
}

/**
 * Remove a saved location by index
 * @param {number} index 
 */
const removeSavedLocation = async (index) => {
  try {
    const result = /** @type {SavedPreferences} */(await browserAPI.storage.local.get({ savedLocations: [] }));
    /** @type {SavedLocation[]} */
    const locations = result.savedLocations ?? [];
    
    locations.splice(index, 1);
    
    await browserAPI.storage.local.set({ savedLocations: locations });
    renderSavedLocations(locations);
  } catch (e) {
    console.error('Failed to remove saved location:', e);
  }
}

/**
 * Render saved locations buttons
 * @param {SavedLocation[]} locations 
 */
const renderSavedLocations = (locations) => {
  savedLocations.innerHTML = locations.map((item, index) => `
    <button class="saved-item" data-index="${index}" data-lat="${item.latitude}" data-lng="${item.longitude}" title="${item.name}">
      <span class="saved-item-name">${item.name}</span>
      <span class="saved-item-delete" data-delete="${index}">×</span>
    </button>
  `).join('');
}

/** Toggle enabled state */
const toggleEnabled = async () => {
  try {
    const result = await browserAPI.storage.local.get({ enabled: true });
    const newState = !result["enabled"];
    await browserAPI.storage.local.set({ enabled: newState });
    updateToggleButton(newState);
    updateBadge(newState);
  } catch (e) {
    console.error('Failed to toggle state:', e);
  }
}

/**
 * Update toggle button appearance
 * @param {boolean} enabled 
 */
const updateToggleButton = (enabled) => {
  toggleBtn.classList.toggle('enabled', enabled);
  toggleBtn.classList.toggle('disabled', !enabled);
  toggleText.textContent = enabled ? 'Enabled' : 'Disabled';
}

/**
 * Search location using Nominatim
 * @param {string} query 
 * @returns 
 */
const searchLocation = async (query) => {
  if (!query || query.length < 2) {
    searchResults.classList.remove('active');
    return;
  }

  try {
    const response = await nominatimFetch(
      `${nominatimBaseURL}/search?format=json&q=${encodeURIComponent(query)}&limit=5`
    );

    /** @type {Array<{ lat: string, lon: string, display_name: string }>} */
    const data = await response.json();

    if (data.length > 0) {
      searchResults.innerHTML = data.map(item => `
        <div class="search-result-item" data-lat="${item.lat}" data-lng="${item.lon}">
          ${item.display_name}
        </div>
      `).join('');
      searchResults.classList.add('active');
    } else {
      searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
      searchResults.classList.add('active');
    }
  } catch (e) {
    console.error('Search failed:', e);
    searchResults.classList.remove('active');
  }
}

/** Distance steps in meters: 100m, 1km, 10km 100km */
const RANDOM_DISTANCES = [100, 1000, 10000, 100000];

/** 
 * Generate random location offset from current position
 * Uses the selected distance from the range slider
 */
const generateRandomLocation = () => {
  const currentLat = parseFloat(latInput.value) || DEFAULT_LOCATION.latitude;
  const currentLng = parseFloat(lngInput.value) || DEFAULT_LOCATION.longitude;
  
  const distanceIndex = parseInt(randomRange.value, 10);
  const distanceMeters = RANDOM_DISTANCES[distanceIndex] || 100;
  
  // Random angle in radians
  const angle = Math.random() * 2 * Math.PI;
  
  // Convert distance to degrees (approximate)
  // 1 degree latitude ≈ 111,320 meters
  // 1 degree longitude ≈ 111,320 * cos(latitude) meters
  const latOffset = (distanceMeters / 111320) * Math.cos(angle);
  const lngOffset = (distanceMeters / (111320 * Math.cos(currentLat * Math.PI / 180))) * Math.sin(angle);
  
  const newLat = Math.max(-90, Math.min(90, currentLat + latOffset));
  const newLng = ((currentLng + lngOffset + 540) % 360) - 180; // Wrap longitude
  
  setLocation(newLat, newLng);
}

/** Apply manually entered coordinates */ 
const applyManualCoords = () => {
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);

  // Validate latitude
  const latValid = !isNaN(lat) && Math.abs(lat) <= 90;
  latInput.classList.toggle('error', !latValid);

  // Validate longitude
  const lngValid = !isNaN(lng) && Math.abs(lng) <= 180;
  lngInput.classList.toggle('error', !lngValid);

  if (!latValid || !lngValid) {
    return;
  }

  setLocation(lat, lng);
}

/** Debounced handler for coordinate input changes */
const handleCoordInputChange = () => {
  clearTimeout(coordInputTimeout);
  coordInputTimeout = setTimeout(() => {
    applyManualCoords();
  }, 500);
}

// Setup event listeners
const setupEventListeners = () => {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const target = /** @type {HTMLInputElement | null} */ (e.target);
    searchTimeout = setTimeout(() => {
      searchLocation(target?.value ?? '');
    }, 500);
  });

  searchResults.addEventListener('click', (e) => {    
    const item = /** @type {SearchItem} */(/** @type {HTMLElement} */(e.target).closest('.search-result-item'));
    if (item && item.dataset.lat) {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      setLocation(lat, lng, item.textContent || '');
      searchInput.value = '';
      searchResults.classList.remove('active');
    }
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    if (target && !target.closest('.search-container')) {
      searchResults.classList.remove('active');
    }
  });

  toggleBtn.addEventListener('click', toggleEnabled);
  randomBtn.addEventListener('click', generateRandomLocation);
  
  latInput.addEventListener('input', handleCoordInputChange);
  lngInput.addEventListener('input', handleCoordInputChange);
  
  randomRange.addEventListener('input', () => {
    saveDistanceIndex(parseInt(randomRange.value, 10));
  });
  
  // Save location button
  saveLocationBtn.addEventListener('click', saveCurrentLocation);
  
  // Saved locations click handler
  savedLocations.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */(e.target);
    
    // Check if delete button was clicked
    if (target.classList.contains('saved-item-delete')) {
      const deleteIndex = target.dataset['delete'];
      if (deleteIndex !== undefined) {
        e.stopPropagation();
        removeSavedLocation(parseInt(deleteIndex, 10));
      }
      return;
    }
    
    // Otherwise, select the location
    const item = /** @type {HTMLElement | null} */(target.closest('.saved-item'));
    if (item && item.dataset['lat'] && item.dataset['lng']) {
      const lat = parseFloat(item.dataset['lat']);
      const lng = parseFloat(item.dataset['lng']);
      const name = item.getAttribute('title') || undefined;
      setLocation(lat, lng, name);
    }
  });
}

/**
 * @import { SearchItem, SavedPreferences, SavedLocation, LocationName } from './interfaces.d.ts';
 */
