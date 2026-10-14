/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

export type LatLng = { lat: number; lng: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

function assertCoordinate({ lat, lng }: LatLng): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError(`Invalid latitude: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError(`Invalid longitude: ${lng}`);
  }
}

/** Great-circle distance in metres between two points (Haversine formula). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  assertCoordinate(a);
  assertCoordinate(b);

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  // Clamp guards against h creeping just above 1 from rounding (antipodal points).
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when `point` is within `radiusMeters` of `center` (inclusive). */
export function isWithinRadius(point: LatLng, center: LatLng, radiusMeters: number): boolean {
  return distanceMeters(point, center) <= radiusMeters;
}
