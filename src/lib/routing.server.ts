// Route service using OSRM (Open Source Routing Machine)
// Free public demo server - no API key required
// All routing requests happen server-side to hide the URL and prevent abuse

import type { Database } from "@/integrations/supabase/types";

/**
 * Represents a single point in a route
 */
export type RoutePoint = {
  lat: number;
  lng: number;
};

/**
 * Represents a single navigation step
 */
export type RouteStep = {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
};

/**
 * Complete route result with polyline and steps
 */
export type RouteResult = {
  polyline: RoutePoint[];
  steps: RouteStep[];
  distanceM: number; // total distance in meters
  durationS: number; // total duration in seconds
};

/**
 * Validates coordinates are within valid ranges
 */
function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Decodes a GeoJSON polyline into an array of coordinates
 */
function decodeGeoJsonPolyline(geometry: GeoJSON.Geometry): RoutePoint[] {
  if (geometry.type === "LineString") {
    return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  }
  return [];
}

/**
 * Formats OSRM step into our RouteStep type
 */
function formatStep(step: OSRMStep): RouteStep {
  return {
    instruction: step.maneuver.instruction || step.maneuver.type || "Continue",
    distance: step.distance,
    duration: step.duration,
  };
}

/**
 * OSRM API response types
 */
interface OSRMResponse {
  routes: OSRMRoute[];
  waypoints: OSRMWaypoint[];
  code: string;
}

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  legs: OSRMLeg[];
}

interface OSRMLeg {
  steps: OSRMStep[];
  distance: number;
  duration: number;
}

interface OSRMStep {
  distance: number;
  duration: number;
  type: string;
  instruction?: string;
  name?: string;
  way_points?: number[];
  maneuver: {
    type: string;
    instruction?: string;
    bearing_before?: number;
    bearing_after?: number;
    location?: [number, number];
  };
}

interface OSRMWaypoint {
  distance: number;
  name: string;
  location: [number, number];
}

/**
 * Cache for route requests to prevent duplicate calls
 * Key: startLat,startLng:endLat:endLng (rounded to 4 decimals)
 */
const routeCache = new Map<string, { result: RouteResult | null; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Simple cache key generation (rounded coordinates to 4 decimals ~11m precision)
 */
function getCacheKey(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): string {
  const startKey = `${Math.round(start.lat * 10000) / 10000},${Math.round(start.lng * 10000) / 10000}`;
  const endKey = `${Math.round(end.lat * 10000) / 10000},${Math.round(end.lng * 10000) / 10000}`;
  return `${startKey}:${endKey}`;
}

/**
 * Fetches a walking route from OSRM public demo server
 * Returns null on failure
 */
async function fetchOSRMRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): Promise<OSRMResponse | null> {
  // Build OSRM URL: longitude,latitude format
  const startCoord = `${start.lng},${start.lat}`;
  const endCoord = `${end.lng},${end.lat}`;
  const url = `https://router.project-osrm.org/route/v1/walking/${startCoord};${endCoord}?steps=true&geometries=geojson`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mdeko-Veggie-Wave/1.0",
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`OSRM API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return (await response.json()) as OSRMResponse;
  } catch (error) {
    console.error("OSRM fetch failed:", error);
    return null;
  }
}

/**
 * Main function to get walking route between two points
 * Returns RouteResult or null if routing fails
 */
export async function getWalkingRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): Promise<RouteResult | null> {
  // Validate coordinates
  if (!isValidCoordinates(start.lat, start.lng) || !isValidCoordinates(end.lat, end.lng)) {
    console.warn("Invalid coordinates for routing");
    return null;
  }

  // Check cache
  const cacheKey = getCacheKey(start, end);
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const data = await fetchOSRMRoute(start, end);
  
  if (!data || !data.routes || data.routes.length === 0) {
    console.error("No routes found from OSRM");
    // Cache the failure briefly
    routeCache.set(cacheKey, { result: null, timestamp: Date.now() });
    return null;
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  // Transform to our RouteResult type
  const result: RouteResult = {
    polyline: decodeGeoJsonPolyline(route.geometry),
    steps: leg.steps.map(formatStep),
    distanceM: route.distance,
    durationS: route.duration,
  };

  // Cache the result
  routeCache.set(cacheKey, { result, timestamp: Date.now() });

  // Clean up old cache entries (every 10th request)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [key, value] of routeCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        routeCache.delete(key);
      }
    }
  }

  return result;
}

/**
 * Calculate bearing (compass direction) from one point to another
 * Returns angle in degrees (0-360) where 0 is north
 */
export function calculateBearing(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): number {
  const startLng = (start.lng * Math.PI) / 180;
  const startLat = (start.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

  let bearing = Math.atan2(y, x);
  bearing = bearing * (180 / Math.PI);
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculatePathDistance(points: RoutePoint[]): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    const R = 6371000; // Earth's radius in meters
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

    totalDistance += R * c;
  }

  return totalDistance;
}
