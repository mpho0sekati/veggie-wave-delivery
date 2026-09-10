import type L from "leaflet";

interface MarkerAnimationState {
  startLat: number;
  startLng: number;
  targetLat: number;
  targetLng: number;
  startTime: number;
  duration: number;
  frameId: number | null;
}

const markerAnimations = new WeakMap<L.Marker, MarkerAnimationState>();

/**
 * Linearly interpolates (LERP) a Leaflet marker position from its current location
 * (or current interpolated location if already animating) to a target location over `durationMs`.
 */
export function animateMarker(
  marker: L.Marker,
  targetLat: number,
  targetLng: number,
  durationMs = 2000,
) {
  const currentLatLng = marker.getLatLng();
  const existingAnim = markerAnimations.get(marker);

  if (existingAnim && existingAnim.frameId !== null) {
    cancelAnimationFrame(existingAnim.frameId);
  }

  // Current start position is either the current marker position or where it currently is in animation
  const startLat = currentLatLng.lat;
  const startLng = currentLatLng.lng;

  // If target is virtually identical, set directly and clear animation
  if (Math.abs(startLat - targetLat) < 0.000001 && Math.abs(startLng - targetLng) < 0.000001) {
    marker.setLatLng([targetLat, targetLng]);
    markerAnimations.delete(marker);
    return;
  }

  const startTime = performance.now();

  const animState: MarkerAnimationState = {
    startLat,
    startLng,
    targetLat,
    targetLng,
    startTime,
    duration: durationMs,
    frameId: null,
  };

  function step(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);

    // Smooth LERP calculation
    const currentLat = startLat + (targetLat - startLat) * progress;
    const currentLng = startLng + (targetLng - startLng) * progress;

    marker.setLatLng([currentLat, currentLng]);

    if (progress < 1) {
      animState.frameId = requestAnimationFrame(step);
    } else {
      animState.frameId = null;
      marker.setLatLng([targetLat, targetLng]);
      markerAnimations.delete(marker);
    }
  }

  animState.frameId = requestAnimationFrame(step);
  markerAnimations.set(marker, animState);
}

/**
 * Stops any ongoing animation for a Leaflet marker.
 */
export function stopMarkerAnimation(marker: L.Marker) {
  const animState = markerAnimations.get(marker);
  if (animState && animState.frameId !== null) {
    cancelAnimationFrame(animState.frameId);
    animState.frameId = null;
  }
  markerAnimations.delete(marker);
}
