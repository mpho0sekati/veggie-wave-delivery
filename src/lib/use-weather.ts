import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { WeatherWarning } from "./mdeko.functions";
import { getWeatherForOrder } from "./mdeko.functions";

/**
 * Hook to fetch and monitor weather warnings for an order.
 * Automatically refreshes every 10 minutes.
 * Only works for authenticated users who are part of the order (buyer or trader).
 */
export function useWeatherWarning(orderId: string | null) {
  const [warning, setWarning] = useState<WeatherWarning | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverFn = useServerFn(getWeatherForOrder);

  // Fetch weather warning
  const fetchWeather = useCallback(async () => {
    if (!orderId) {
      setWarning(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await serverFn({ data: { orderId } });
      setWarning(result);
    } catch (err) {
      console.error("Failed to fetch weather:", err);
      setError("Failed to load weather information");
      setWarning(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, serverFn]);

  // Fetch on mount and when orderId changes
  useEffect(() => {
    void fetchWeather();
  }, [fetchWeather]);

  // Set up periodic refresh (every 10 minutes)
  useEffect(() => {
    if (!orderId) return;

    const interval = setInterval(
      () => {
        void fetchWeather();
      },
      10 * 60 * 1000,
    ); // 10 minutes

    return () => clearInterval(interval);
  }, [orderId, fetchWeather]);

  return { warning, loading, error, refresh: fetchWeather };
}
