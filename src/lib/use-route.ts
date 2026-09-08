import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { RouteResult, RoutePoint } from "./routing.server";
import { getRoute } from "./mdeko.functions";
import { distanceKm } from "./veggie-data";

/**
 * Result from route calculation with deviation tracking
 */
export type RouteWithDeviation = {
  route: RouteResult | null;
  deviation: number | null; // in meters from route
  shouldReroute: boolean; // true if deviation > 40m
  isLoading: boolean;
  error: string | null;
};

/**
 * Hook to calculate and track walking route from courier to buyer
 * Automatically recalculates when courier position changes significantly
 */
export function useRoute(
  orderId: string | null,
  courierPosition: { lat: number; lng: number } | null,
  enabled: boolean,
) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [deviation, setDeviation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverFn = useServerFn(getRoute);

  /**
   * Fetch route from current courier position to buyer
   */
  const fetchRoute = useCallback(async () => {
    if (!orderId || !courierPosition || !enabled) {
      setRoute(null);
      setDeviation(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await serverFn({
        orderId,
        fromLat: courierPosition.lat,
        fromLng: courierPosition.lng,
      });
      setRoute(result);
    } catch (err) {
      console.error("Route fetch failed:", err);
      setError("Failed to calculate route");
      setRoute(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, courierPosition?.lat, courierPosition?.lng, enabled, serverFn]);

  /**
   * Calculate deviation from current position to route
   */
  const calculateDeviation = useCallback((
    position: { lat: number; lng: number },
    routePolyline: RoutePoint[],
  ) => {
    if (routePolyline.length === 0) return null;

    // Find minimum distance from position to any point on the route
    let minDistance = Infinity;
    for (const point of routePolyline) {
      const dist = distanceKm(position, point) * 1000; // in meters
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    return minDistance;
  }, []);

  /**
   * Manually trigger route recalculation
   */
  const recalculateRoute = useCallback(() => {
    void fetchRoute();
  }, [fetchRoute]);

  /**
   * Fetch route on mount and when dependencies change
   */
  useEffect(() => {
    void fetchRoute();
  }, [fetchRoute]);

  /**
   * Calculate deviation whenever route or position changes
   */
  useEffect(() => {
    if (!route || !courierPosition) {
      setDeviation(null);
      return;
    }

    const dev = calculateDeviation(courierPosition, route.polyline);
    setDeviation(dev);
  }, [route, courierPosition, calculateDeviation]);

  // Should re-route if deviation > 40 meters
  const shouldReroute = deviation !== null && deviation > 40;

  return {
    route,
    deviation,
    shouldReroute,
    isLoading,
    error,
    recalculateRoute,
  };
}
