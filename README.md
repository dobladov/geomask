## GeoMask

### About

GeoMask is a browser extension that allows users to spoof their geolocation data for privacy and security purposes. By intercepting geolocation requests made by websites, GeoMask can provide fake location data based on user-defined preferences.

This extension **never asks for your real location**

> [!WARNING] Some services use your IP address to determine location, this extension does not change that. It only spoofs the geolocation data provided by the browser's Geolocation API.

### Features

- Set custom latitude and longitude
- Randomize location within a specified distance
- Search for locations by name using Nominatim
- Interactive map to select location

### Services used
- [Nominatim](https://nominatim.org/) to search for locations by name and to convert coordinates into human-readable addresses (reverse geocoding).
- [Leaflet](https://leafletjs.com/) to display an interactive map

### Development

```sh
npm install # install dependencies and copies leaflet assets
```

Add the extension to your browser in developer mode, pointing to `extension/manifest.json`.

### Build and package

```sh
npm install # install dependencies
npm run package # generates a zip file in the dist/ folder
```
