import { distanceKm } from "./veggie-data";

type Coordinates = { lat: number; lng: number };
export function sellerPosition(
  live: Coordinates | null,
  saved: { lat: number | null; lng: number | null } | null,
): Coordinates | null {
  if (live) return live;
  if (
    saved?.lat == null ||
    saved.lng == null ||
    !Number.isFinite(saved.lat) ||
    !Number.isFinite(saved.lng)
  )
    return null;
  return { lat: saved.lat, lng: saved.lng };
}

export function nearbySellerWaves<T extends { lat: number | null; lng: number | null }>(
  waves: T[],
  position: Coordinates | null,
): T[] {
  if (!position) return [];
  return waves
    .filter(
      (wave) =>
        wave.lat != null &&
        wave.lng != null &&
        distanceKm(position, { lat: wave.lat, lng: wave.lng }) <= 5,
    )
    .sort(
      (a, b) =>
        distanceKm(position, { lat: a.lat ?? 0, lng: a.lng ?? 0 }) -
        distanceKm(position, { lat: b.lat ?? 0, lng: b.lng ?? 0 }),
    );
}
