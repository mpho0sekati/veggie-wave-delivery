import { useEffect, useState } from "react";
import { calculateBearing } from "./routing.server";

/**
 * Hook to calculate compass bearing from courier position to buyer position
 * Used as fallback when routing is unavailable
 */
export function useCompass(
  courierPosition: { lat: number; lng: number } | null,
  buyerPosition: { lat: number; lng: number } | null,
) {
  const [bearing, setBearing] = useState<number | null>(null);

  useEffect(() => {
    if (!courierPosition || !buyerPosition) {
      setBearing(null);
      return;
    }

    const angle = calculateBearing(courierPosition, buyerPosition);
    setBearing(angle);
  }, [courierPosition, buyerPosition]);

  return bearing;
}
