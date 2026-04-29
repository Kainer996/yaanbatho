// Small self-contained geo helpers. No deps.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Great-circle distance in km between two points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Rough minutes-to-drive estimate.
 * Uses a 1.3 road-factor on top of great-circle distance plus an assumed average
 * speed (default 60 km/h). Good enough to rank candidates, not for ETA.
 */
export function estimateDriveMinutes(
  a: LatLng,
  b: LatLng,
  assumedKmh = Number(process.env.NOMAD_ASSUMED_KMH ?? 60),
): number {
  const km = haversineKm(a, b) * 1.3;
  return Math.round((km / assumedKmh) * 60);
}

/** Build a Google Maps search deeplink for a coordinate + label. */
export function mapsSearchLink(dest: LatLng, label: string): string {
  const q = `${dest.lat},${dest.lng}`;
  const placeName = encodeURIComponent(label);
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${placeName}`;
}

/** Build a Google Maps directions deeplink from origin to destination. */
export function mapsDirectionsLink(origin: LatLng, dest: LatLng, travelMode = "driving"): string {
  return [
    "https://www.google.com/maps/dir/?api=1",
    `origin=${origin.lat},${origin.lng}`,
    `destination=${dest.lat},${dest.lng}`,
    `travelmode=${travelMode}`,
  ].join("&");
}
