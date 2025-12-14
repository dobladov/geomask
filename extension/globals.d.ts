import * as Leaflet from 'leaflet';

declare global {
  const L: typeof Leaflet;
  namespace L {
    export type Map = Leaflet.Map;
    export type Marker = Leaflet.Marker;
    export type DivIcon = Leaflet.DivIcon;
  }

  interface Geolocation {
    _watches?: Record<number, () => void>;
  }
}

export {};
