const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const nominatimBaseURL = 'https://nominatim.openstreetmap.org';

import { DEFAULT_LOCATION } from '../constants.mjs';

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
const locationName = /** @type {HTMLDivElement} */(document.getElementById('locationName'));
const toggleText = /** @type {HTMLSpanElement} */(toggleBtn.querySelector('.toggle-text'));

/** @type {L.Map} */
let map;
/** @type {L.Marker} */
let marker;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let searchTimeout;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let coordInputTimeout;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initMap();
  setupEventListeners();
});

// Load saved state from storage
const loadState = async () => {
  try {
    const result = await browserAPI.storage.local.get({
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
      enabled: true
    });

    latInput.value = result["latitude"];
    lngInput.value = result["longitude"];
    updateToggleButton(result["enabled"]);
    updateBadge(result["enabled"]);
    
    // Fetch location name for saved coordinates
    reverseGeocode(result["latitude"], result["longitude"]);
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
  }).setView([lat, lng], 13);

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
  try {
    const response = await fetch(
      `${nominatimBaseURL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    /** @type {{ display_name?: string }} */
    const data = await response.json();
    
    if (data.display_name) {
      // Shorten the display name (take first 2-3 parts)
      const parts = data.display_name.split(', ');
      const shortName = parts.slice(0, 3).join(', ');
      locationName.textContent = shortName;
    } else {
      locationName.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  } catch (e) {
    console.error('Reverse geocode failed:', e);
    locationName.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
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
  }, 200);
}

/**
 * Set location and update UI
 * @param {number} lat 
 * @param {number} lng 
 * @param {boolean} [save] 
 */
const setLocation = (lat, lng, save = true) => {
  const latitude = parseFloat(lat.toFixed(6));
  const longitude = parseFloat(lng.toFixed(6));

  latInput.value = String(latitude);
  lngInput.value = String(longitude);

  marker.setLatLng([latitude, longitude]);
  map.panTo([latitude, longitude]);
  
  // Get location name via reverse geocoding
  reverseGeocode(latitude, longitude);

  if (save) {
    saveLocation(latitude, longitude);
  }
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
    const response = await fetch(
      `${nominatimBaseURL}/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
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
  const currentLat = parseFloat(latInput.value) || DEFAULT_LAT;
  const currentLng = parseFloat(lngInput.value) || DEFAULT_LNG;
  
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
    }, 300);
  });

  searchResults.addEventListener('click', (e) => {    
    const item = /** @type {SearchItem} */(/** @type {HTMLElement} */(e.target).closest('.search-result-item'));
    if (item && item.dataset.lat) {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      setLocation(lat, lng);
      searchInput.value = '';
      searchResults.classList.remove('active');
      map.setZoom(13);
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
}

/**
 * @import { SearchItem } from './interfaces.d.ts';
 */
