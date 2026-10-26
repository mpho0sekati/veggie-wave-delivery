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

/** Short human label for a wave pin on the trader's map: "2× Tomatoes, 1× Spinach". */
export function wavePinLabel(
  wave: { items: unknown; wish: string | null },
  catalog: { id: string; name: string }[],
): string {
  const items = Array.isArray(wave.items) ? wave.items : [];
  const parts = items.flatMap((line) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) return [];
    const entry = line as { id?: unknown; qty?: unknown };
    if (typeof entry.id !== "string" || typeof entry.qty !== "number") return [];
    return [`${entry.qty}× ${catalog.find((c) => c.id === entry.id)?.name ?? entry.id}`];
  });
  if (parts.length) return parts.join(", ");
  return wave.wish?.trim() || "Veggie request";
}
