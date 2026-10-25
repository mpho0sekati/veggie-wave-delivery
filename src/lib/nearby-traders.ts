import { distanceKm, MAX_SUITABLE_DISTANCE_KM, type Runner } from "./veggie-data";

/** Discovery uses saved trader coordinates, never offsets from the buyer. */
export function nearbyTraders(
  runners: Runner[],
  buyer: { lat: number; lng: number; located: boolean },
): Runner[] {
  if (!buyer.located) return [];
  return runners
    .filter(
      (runner) =>
        runner.online &&
        Number.isFinite(runner.lat) &&
        Number.isFinite(runner.lng) &&
        Math.abs(runner.lat) <= 90 &&
        Math.abs(runner.lng) <= 180 &&
        distanceKm(buyer, runner) <= MAX_SUITABLE_DISTANCE_KM,
    )
    .sort((a, b) => distanceKm(buyer, a) - distanceKm(buyer, b));
}