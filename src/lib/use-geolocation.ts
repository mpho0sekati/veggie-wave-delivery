import { useCallback, useEffect, useState } from "react";

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "unsupported";

export function useGeolocation(onPosition: (pos: { lat: number; lng: number }) => void) {
  const [status, setStatus] = useState<GeoStatus>("idle");

  const locate = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("ready");
        onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [onPosition]);

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, locate };
}
