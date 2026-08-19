// src/utils/geo.ts

const EARTH_RADIUS_M = 6_371_000;

export type Point = {
  lat: number;
  lon: number;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function withinRadius<T extends { lat?: number; lon?: number }>(
  records: T[],
  origin: Point,
  radiusMeters: number
): Array<T & { distance_m: number }> {
  return records
    .filter((record): record is T & { lat: number; lon: number } =>
      Number.isFinite(record.lat) && Number.isFinite(record.lon)
    )
    .map((record) => ({
      ...record,
      distance_m: Math.round(distanceMeters(origin, record)),
    }))
    .filter((record) => record.distance_m <= radiusMeters)
    .sort((a, b) => a.distance_m - b.distance_m);
}

