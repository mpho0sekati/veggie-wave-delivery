import { useCallback, useEffect, useRef, useState } from "react";

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "unsupported";

const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

const MESSAGES: Record<GeoStatus, string> = {
  idle: "",
  locating: "Finding your location…",
  ready: "",
  denied: "Location permission was blocked. Allow it in your browser settings, then tap again.",
  unavailable: "We couldn't get a precise location. Turn on GPS or tap the map to set it manually.",
  unsupported: "This browser can't share location.",
};

/** Watches the device position and keeps reporting updates while the page is open. */
export function useGeolocation(onPosition: (pos: { lat: number; lng: number }) => void) {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const watchRef = useRef<number | null>(null);
  const cb = useRef(onPosition);
  cb.current = onPosition;

  const locate = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");

    const handle = (pos: GeolocationPosition) => {
      if (pos.coords.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
        setStatus("unavailable");
        return;
      }
      setStatus("ready");
      cb.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };
    const fail = (err: GeolocationPositionError) =>
      setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");

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
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  useEffect(() => {
    locate();
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, locate, stop, message: MESSAGES[status] };
}
