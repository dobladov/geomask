export interface SearchItem extends HTMLElement {
    dataset: {
        lat: string;
        lng: string;
    }
}
export interface LocationName extends HTMLElement {
    dataset: {
        valid?: "true" | "false";
    }
}

export interface SavedLocation {
    latitude: number;
    longitude: number;
    name: string;
}

export interface SavedPreferences {
    latitude: number;
    longitude: number;
    enabled: boolean;
    /** Map latest zoom level */
    zoom?: number;
    /** Nominatim location name */
    locationName?: string;
    /** User selected distance for randomization */
    distanceIndex: number;
    /** User saved locations */
    savedLocations?: SavedLocation[];
}
