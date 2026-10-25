// Weather service using Open-Meteo (free, no API key required)
// All weather fetches happen server-side to hide the URL and prevent abuse

import type { Database } from "@/integrations/supabase/types";

export type WeatherWarning = {
  type: "rain" | "thunderstorm" | "cold" | "heat";
  severity: "warning" | "info";
  message: string;
  icon: string;
};

/**
 * Validates coordinates are within valid ranges
 */
function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Fetches weather data from Open-Meteo API
 * Uses free public endpoint with no authentication required
 */
async function fetchOpenMeteo(lat: number, lng: number): Promise<OpenMeteoResponse | null> {
  // Build URL with coordinates (Open-Meteo accepts lat/lng directly)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&minutely_15=precipitation`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mdeko-Veggie-Wave/1.0",
      },
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`Open-Meteo API error: ${response.status}`);
      return null;
    }

    return (await response.json()) as OpenMeteoResponse;
  } catch (error) {
    console.error("Open-Meteo fetch failed:", error);
    return null;
  }
}

/**
 * Open-Meteo API response type
 */
interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
  minutely_15?: {
    time: string[];
    precipitation: number[];
  };
}

/**
 * Maps weather codes to our warning types
 * Open-Meteo weather codes: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODES/DB-APP-B/Lookup-Table.htm
 */
function getWeatherType(weathercode: number, precipitation: number[]): WeatherWarning | null {
  // Check precipitation first (rain/storms)
  const maxPrecip = Math.max(...precipitation);

  // Heavy rain: >= 5mm/h
  if (maxPrecip >= 5) {
    return {
      type: "rain",
      severity: "warning",
      message: "Heavy rain in your area — stay safe, delay if you need to.",
      icon: "rain",
    };
  }

  // Light rain: >= 1mm/h
  if (maxPrecip >= 1) {
    return {
      type: "rain",
      severity: "info",
      message: "Light rain in your area — consider bringing an umbrella.",
      icon: "drizzle",
    };
  }

  // Thunderstorm weather codes: 95-99
  if (weathercode >= 95 && weathercode <= 99) {
    return {
      type: "thunderstorm",
      severity: "warning",
      message: "Thunderstorms in your area — take shelter if possible.",
      icon: "storm",
    };
  }

  return null;
}

/**
 * Checks temperature-based warnings
 */
function getTemperatureWarning(temperature: number): WeatherWarning | null {
  // Extreme cold: below 5°C
  if (temperature < 5) {
    return {
      type: "cold",
      severity: "warning",
      message: "Extreme cold — dress warmly and take care.",
      icon: "cold",
    };
  }

  // Cold: below 10°C
  if (temperature < 10) {
    return {
      type: "cold",
      severity: "info",
      message: "Cold weather — consider warm clothing.",
      icon: "cool",
    };
  }

  // Hot: above 30°C
  if (temperature > 30) {
    return {
      type: "heat",
      severity: "info",
      message: "Hot weather — remember to stay hydrated.",
      icon: "sun",
    };
  }

  // Extreme heat: above 35°C
  if (temperature > 35) {
    return {
      type: "heat",
      severity: "warning",
      message: "Extreme heat — stay hydrated and take breaks in shade.",
      icon: "hot",
    };
  }

  return null;
}

/**
 * Checks wind-based warnings
 */
function getWindWarning(windspeed: number): WeatherWarning | null {
  // Strong winds: > 20 km/h (potential for storms)
  if (windspeed > 20) {
    return {
      type: "thunderstorm",
      severity: "warning",
      message: "Strong winds — take extra caution, especially on bikes.",
      icon: "wind",
    };
  }

  return null;
}

/**
 * Main function to get weather warning for a location
 * Returns the most severe warning found
 */
export async function getWeatherWarning(lat: number, lng: number): Promise<WeatherWarning | null> {
  // Validate coordinates
  if (!isValidCoordinates(lat, lng)) {
    console.warn("Invalid coordinates for weather check");
    return null;
  }

  const data = await fetchOpenMeteo(lat, lng);
  if (!data) {
    return null;
  }

  const warnings: WeatherWarning[] = [
    // Check in order of severity
    getWeatherType(data.current_weather.weathercode, data.minutely_15?.precipitation ?? []),
    getTemperatureWarning(data.current_weather.temperature),
    getWindWarning(data.current_weather.windspeed),
  ].filter(Boolean) as WeatherWarning[];

  // Return the most severe warning
  const severeWarnings = warnings.filter((w) => w.severity === "warning");
  if (severeWarnings.length > 0) {
    return severeWarnings[0];
  }

  // Return any info-level warning
  if (warnings.length > 0) {
    return warnings[0];
  }

  return null;
}

/**
 * Cache for weather warnings to prevent excessive API calls
 * Key: geohash cell (coarse), Value: cached warning with timestamp
 */
const weatherCache = new Map<string, { warning: WeatherWarning | null; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Simple geohash encoding for cache keys (coarse cells only)
 */
function getCacheKey(lat: number, lng: number): string {
  // Round to 2 decimal places (~11km precision)
  const latRounded = Math.round(lat * 100) / 100;
  const lngRounded = Math.round(lng * 100) / 100;
  return `${latRounded},${lngRounded}`;
}

/**
 * Get weather warning with caching
 */
export async function getWeatherWarningCached(
  lat: number,
  lng: number,
): Promise<WeatherWarning | null> {
  const cacheKey = getCacheKey(lat, lng);

  // Check cache
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.warning;
  }

  // Fetch fresh
  const warning = await getWeatherWarning(lat, lng);

  // Update cache
  weatherCache.set(cacheKey, { warning, timestamp: Date.now() });

  // Clean up old cache entries (every 10th request)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [key, value] of weatherCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        weatherCache.delete(key);
      }
    }
  }

  return warning;
}
