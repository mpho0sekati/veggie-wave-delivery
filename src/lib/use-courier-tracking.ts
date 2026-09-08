import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { CourierPosition } from "./mdeko.functions";
import { distanceKm, walkMinutes } from "./veggie-data";

/** Position update with computed metadata for display */
export type TrackedPosition = {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  recordedAt: string;
  distanceKm: number;
  etaMinutes: number;
};

/** Hook for sellers to report their live position during delivery */
export function useReportCourierPosition(
  orderId: string | null,
  enabled: boolean,
  throttleMs: number = 5000,
  minDistanceMeters: number = 10,
) {
  const lastPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);

  const reportPosition = useCallback(
    async (position: { lat: number; lng: number; heading?: number; speed?: number; accuracy?: number }) => {
      if (!orderId) return;

      const last = lastPositionRef.current;
      
      // Skip if we reported too recently
      if (last && Date.now() - last.timestamp < throttleMs) {
        return;
      }

      // Skip if we haven't moved enough
      if (last) {
        const dist = distanceKm(last, position);
        if (dist * 1000 < minDistanceMeters) {
          return;
        }
      }

      setIsReporting(true);
      try {
        const { data, error } = await supabase
          .from("courier_positions")
          .insert({
            order_id: orderId,
            trader_id: (await supabase.auth.getUser()).data.user?.id,
            lat: position.lat,
            lng: position.lng,
            heading: position.heading ?? null,
            speed: position.speed ?? null,
            accuracy: position.accuracy ?? null,
          })
          .select("*")
          .single();

        if (error) {
          console.error("Failed to report position:", error);
        } else {
          lastPositionRef.current = {
            lat: position.lat,
            lng: position.lng,
            timestamp: Date.now(),
          };
          // Update current position for UI display
          setCurrentPosition({ lat: position.lat, lng: position.lng });
        }
      } finally {
        setIsReporting(false);
      }
    },
    [orderId, throttleMs, minDistanceMeters],
  );

  // Start/stop watching based on enabled state
  useEffect(() => {
    if (!enabled || !orderId || typeof window === "undefined" || !navigator.geolocation) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    let watchId: number | null = null;

    const handlePosition = (pos: GeolocationPosition) => {
      if (pos.coords.accuracy > 100) {
        return; // Skip inaccurate positions
      }

      // Update current position immediately for UI
      setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      // Throttle client-side as well
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        void reportPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          accuracy: pos.coords.accuracy,
        });
      }, 1000); // Debounce rapid updates
    };

    const handleError = (err: GeolocationPositionError) => {
      console.error("Geolocation error:", err);
    };

    watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, orderId, reportPosition]);

  const stopReporting = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastPositionRef.current = null;
    setCurrentPosition(null);
  }, []);

  return { isReporting, stopReporting, currentPosition };
}

/** Hook for buyers to subscribe to live courier position updates */
export function useCourierPositions(orderId: string | null) {
  const [positions, setPositions] = useState<CourierPosition[]>([]);
  const [latestPosition, setLatestPosition] = useState<TrackedPosition | null>(null);
  const [buyerPosition, setBuyerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Clear state when order changes
  useEffect(() => {
    setPositions([]);
    setLatestPosition(null);
  }, [orderId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`courier_positions_${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "courier_positions",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newPosition = payload.new as CourierPosition;
          setPositions((prev) => [...prev, newPosition]);
          
          // Update latest position with ETA calculation if we have buyer position
          if (buyerPosition) {
            const dist = distanceKm(newPosition, buyerPosition);
            const eta = walkMinutes(dist);
            setLatestPosition({
              lat: newPosition.lat,
              lng: newPosition.lng,
              heading: newPosition.heading,
              speed: newPosition.speed,
              accuracy: newPosition.accuracy,
              recordedAt: newPosition.recorded_at,
              distanceKm: dist,
              etaMinutes: eta,
            });
          } else {
            setLatestPosition({
              lat: newPosition.lat,
              lng: newPosition.lng,
              heading: newPosition.heading,
              speed: newPosition.speed,
              accuracy: newPosition.accuracy,
              recordedAt: newPosition.recorded_at,
              distanceKm: 0,
              etaMinutes: 0,
            });
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    // Load initial positions
    const loadInitialPositions = async () => {
      const { data, error } = await supabase
        .from("courier_positions")
        .select("*")
        .eq("order_id", orderId)
        .order("recorded_at", { ascending: true });

      if (!error && data) {
        setPositions(data);
        if (data.length > 0) {
          const last = data[data.length - 1];
          if (buyerPosition) {
            const dist = distanceKm(last, buyerPosition);
            const eta = walkMinutes(dist);
            setLatestPosition({
              lat: last.lat,
              lng: last.lng,
              heading: last.heading,
              speed: last.speed,
              accuracy: last.accuracy,
              recordedAt: last.recorded_at,
              distanceKm: dist,
              etaMinutes: eta,
            });
          } else {
            setLatestPosition({
              lat: last.lat,
              lng: last.lng,
              heading: last.heading,
              speed: last.speed,
              accuracy: last.accuracy,
              recordedAt: last.recorded_at,
              distanceKm: 0,
              etaMinutes: 0,
            });
          }
        }
      }
    };

    void loadInitialPositions();

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [orderId, buyerPosition]);

  // Update latest position when buyer position changes
  useEffect(() => {
    if (latestPosition && buyerPosition) {
      const dist = distanceKm(latestPosition, buyerPosition);
      const eta = walkMinutes(dist);
      setLatestPosition((prev) =>
        prev
          ? {
              ...prev,
              distanceKm: dist,
              etaMinutes: eta,
            }
          : null,
      );
    }
  }, [buyerPosition, latestPosition]);

  return { positions, latestPosition, setBuyerPosition };
}
