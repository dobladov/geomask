[![Firefox](https://img.shields.io/amo/v/geomask.svg?label=Firefox)](https://addons.mozilla.org/en-US/firefox/addon/geomask/)
[![Chrome](https://img.shields.io/chrome-web-store/v/onmhohhfidpbfmgkplobnjlfnfnopehm.svg?color=%234A88EE&label=Chrome)](https://chromewebstore.google.com/detail/geomask-change-your-locat/onmhohhfidpbfmgkplobnjlfnfnopehm)

## GeoMask

### About

GeoMask is a browser extension that allows users to spoof their geolocation data for privacy and security purposes. By intercepting geolocation requests made by websites, GeoMask can provide fake location data based on user-defined preferences.

This extension **never asks for your real location**

> [!WARNING]
> Some services use your IP address to determine location, this extension does not change that. It only spoofs the geolocation data provided by the browser's Geolocation API.

<img width="409" height="584" alt="Screenshot 2025-12-16 at 17 02 31" src="https://github.com/user-attachments/assets/23677946-ecc9-4d73-975d-86d3ba57e0e6" />

### Features

- Set custom latitude and longitude
- Randomize location within a specified distance
- Search for locations by name using Nominatim
- Interactive map to select location
- Save prefered locations

https://github.com/user-attachments/assets/394f3cb6-8c69-46eb-8f20-437c675e45e3

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
