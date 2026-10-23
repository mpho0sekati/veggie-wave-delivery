import { useCallback, useEffect, useRef, useState } from "react";

export type GeoStatus = "idle" | "locating" | "ready" | "approximate" | "denied" | "unavailable" | "unsupported";

const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

const MESSAGES: Record<GeoStatus, string> = {
  idle: "",
  locating: "Finding your location…",
  ready: "",
  approximate: "Your device shared an approximate location. Turn on precise location or tap the map to correct your pin.",
  denied: "Location permission was blocked. Allow it in your browser settings, then tap again.",
  unavailable: "We couldn't get a precise location. Turn on GPS or tap the map to set it manually.",
  unsupported: "This browser can't share location.",
};

/** Watches the device position and keeps reporting updates while the page is open. */
export function useGeolocation(onPosition: (pos: { lat: number; lng: number }) => void) {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const watchRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const cb = useRef(onPosition);
  cb.current = onPosition;

  const locate = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    const generation = ++generationRef.current;
    let hasPosition = false;
    setStatus("locating");

    const handle = (pos: GeolocationPosition) => {
      if (generation !== generationRef.current) return;
      const { latitude, longitude, accuracy } = pos.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
          !Number.isFinite(accuracy) || accuracy < 0) return;
      hasPosition = true;
      setStatus(accuracy > MAX_ACCEPTABLE_ACCURACY_METERS ? "approximate" : "ready");
      cb.current({ lat: latitude, lng: longitude });
    };
    const fail = (err: GeolocationPositionError) => {
      if (generation !== generationRef.current) return;
      if (err.code === err.PERMISSION_DENIED) setStatus("denied");
      else if (!hasPosition) setStatus("unavailable");
    };

    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    watchRef.current = navigator.geolocation.watchPosition(handle, fail, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  useEffect(() => {
    locate();
    return stop;
  }, [locate, stop]);

  return { status, locate, stop, message: MESSAGES[status] };
}
