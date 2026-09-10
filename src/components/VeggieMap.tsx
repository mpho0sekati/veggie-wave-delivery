import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BUYER_POSITION, type Runner, formatDistance } from "@/lib/veggie-data";
import type { TrackedPosition } from "@/lib/use-courier-tracking";
import type { RouteResult } from "@/lib/routing.server";
import { animateMarker } from "@/lib/marker-animator";
import NavigationTracker, { type NavigationStep } from "@/components/NavigationTracker";
import RouteLoadingBanner from "@/components/RouteLoadingBanner";
import { createLogger } from "@/lib/logger";
import { WifiOff } from "lucide-react";

const mapLogger = createLogger("VeggieMap");

type Props = {
  runners: Runner[];
  activeRunnerId?: string | null;
  waving?: boolean;
  buyerPosition?: { lat: number; lng: number };
  recenterTrigger?: number;
  /** Live courier position for delivery tracking */
  courierPosition?: TrackedPosition | null;
  /** GPS stream disconnect state */
  isGpsDisconnected?: boolean;
  /** Route calculation loading state */
  routeLoading?: boolean;
  /** Navigation milestones steps */
  navigationSteps?: NavigationStep[];
  /** Route polyline and steps for seller navigation */
  route?: RouteResult | null;
  /** Bearings for compass fallback when no route */
  bearing?: number | null;
  /** Long-press / right-click the map to drop your own pin when GPS is unavailable. */
  onPickPosition?: (pos: { lat: number; lng: number }) => void;
};

function runnerIcon(active: boolean, initial: string, avatar?: string | null) {
  const safeAvatar = avatar?.startsWith("data:image/") ? escapeHtml(avatar) : null;
  const inner = safeAvatar
    ? `<img src="${safeAvatar}" alt="" class="h-full w-full rounded-full object-cover" />`
    : `<span class="text-sm font-semibold">${escapeHtml(initial)}</span>`;
  return L.divIcon({
    className: "",
    html: `<div class="marker-runner ${active ? "marker-runner-active" : ""}">${inner}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

function buyerIcon(waving: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="marker-buyer ${waving ? "marker-buyer-waving" : ""}"><span>You</span></div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

function courierIcon(isDisconnected = false) {
  return L.divIcon({
    className: "",
    html: `<div class="marker-courier ${isDisconnected ? "marker-courier-disconnected" : ""}"><span>🚴</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export default function VeggieMap({
  runners,
  activeRunnerId,
  waving,
  buyerPosition,
  recenterTrigger,
  courierPosition,
  isGpsDisconnected = false,
  routeLoading = false,
  navigationSteps,
  route,
  bearing,
  onPickPosition,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const courierLineRef = useRef<L.Polyline | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const compassRef = useRef<HTMLDivElement | null>(null);
  const pickRef = useRef(onPickPosition);
  pickRef.current = onPickPosition;
  const buyer = buyerPosition ?? BUYER_POSITION;
  const [followMode, setFollowMode] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapLogger.info("Initializing Leaflet map", { buyerLat: buyer.lat, buyerLng: buyer.lng });
    const map = L.map(containerRef.current, {
      center: [buyer.lat, buyer.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
      // don't hijack page scroll — pinch/ctrl+wheel and the zoom buttons still work
      scrollWheelZoom: false,
    });
    const handleMapPick = (e: L.LeafletMouseEvent) => {
      mapLogger.debug("Map pick", { lat: e.latlng.lat, lng: e.latlng.lng });
      pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    map.on("click", handleMapPick);
    map.on("contextmenu", handleMapPick);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    mapLogger.info("Map initialized successfully");

    const ro = new ResizeObserver(() => {
      mapLogger.debug("Map container resized");
      map.invalidateSize();
    });
    ro.observe(containerRef.current);

    return () => {
      mapLogger.info("Cleaning up map");
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setView([buyer.lat, buyer.lng], map.getZoom(), { animate: true });
  }, [buyer.lat, buyer.lng, recenterTrigger]);

  // Animate courier marker when position or disconnect status updates
  useEffect(() => {
    if (!courierPosition || !mapRef.current) return;
    mapLogger.info("Courier position updated", {
      lat: courierPosition.lat,
      lng: courierPosition.lng,
      distanceKm: courierPosition.distanceKm,
      etaMinutes: courierPosition.etaMinutes,
      isGpsDisconnected,
    });

    const map = mapRef.current;
    const layer = layerRef.current;
    if (!layer) return;

    // Remove existing courier line
    if (courierLineRef.current) {
      layer.removeLayer(courierLineRef.current);
      courierLineRef.current = null;
    }

    // Create or update courier marker with smooth frame-by-frame LERP animation (2s)
    if (!courierMarkerRef.current) {
      mapLogger.debug("Creating courier marker");
      const courierMarker = L.marker([courierPosition.lat, courierPosition.lng], {
        icon: courierIcon(isGpsDisconnected),
      }).addTo(layer);
      courierMarkerRef.current = courierMarker;
    } else {
      courierMarkerRef.current.setIcon(courierIcon(isGpsDisconnected));
      // Smooth 2-second LERP animation for marker position
      mapLogger.debug("Animating courier marker via LERP", {
        from: courierMarkerRef.current.getLatLng(),
        to: [courierPosition.lat, courierPosition.lng],
      });
      animateMarker(courierMarkerRef.current, courierPosition.lat, courierPosition.lng, 2000);
    }

    // Create line from courier to buyer
    const line = L.polyline(
      [
        [courierPosition.lat, courierPosition.lng],
        [buyer.lat, buyer.lng],
      ],
      { color: "oklch(0.55 0.25 145)", weight: 3, dashArray: "6 8" },
    ).addTo(layer);

    courierLineRef.current = line;

    // Auto-center if follow mode is on, otherwise fit bounds once
    const bounds = L.latLngBounds([
      [courierPosition.lat, courierPosition.lng],
      [buyer.lat, buyer.lng],
    ]);

    if (followMode) {
      mapLogger.debug("Follow mode: fitting bounds to view");
      map.fitBounds(bounds, { animate: true, duration: 0.5, padding: [40, 40] });
    }
  }, [courierPosition, buyer.lat, buyer.lng, followMode, isGpsDisconnected]);

  // Render route polyline when available
  useEffect(() => {
    if (!route || !mapRef.current || !layerRef.current) return;
    mapLogger.info("Route received", {
      distanceM: route.distanceM,
      duration: route.duration,
      stepsCount: route.steps.length,
    });

    const layer = layerRef.current;
    const map = mapRef.current;

    // Remove existing route line
    if (routeLineRef.current) {
      mapLogger.debug("Removing old route line");
      layer.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    // Draw new route line
    mapLogger.debug("Drawing route polyline");
    const line = L.polyline(route.polyline, {
      color: "oklch(0.55 0.15 62)",
      weight: 5,
      opacity: 0.8,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(layer);

    routeLineRef.current = line;

    // Fit map to show route if it's valid
    const routeBounds = L.latLngBounds(route.polyline);
    if (routeBounds.isValid()) {
      // Only fit if we have both courier and buyer positions
      if (courierPosition) {
        const combinedBounds = routeBounds.extend([
          [courierPosition.lat, courierPosition.lng],
          [buyer.lat, buyer.lng],
        ]);
        mapLogger.debug("Fitting combined bounds to view");
        map.fitBounds(combinedBounds, { animate: true, duration: 0.5, padding: [40, 40] });
      } else {
        mapLogger.debug("Fitting route bounds to view");
        map.fitBounds(routeBounds, { animate: true, duration: 0.5, padding: [40, 40] });
      }
    }
  }, [route, courierPosition, buyer.lat, buyer.lng]);

  const runnersKey = useMemo(
    () =>
      runners
        .filter((r) => r.online)
        .map(
          (r) =>
            `${r.id}:${r.lat.toFixed(5)}:${r.lng.toFixed(5)}:${r.name.charAt(0)}:${r.avatar ?? ""}`,
        )
        .join("|"),
    [runners],
  );

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    mapLogger.info("Rendering runners and buyer", {
      runnersCount: runners.length,
      onlineRunners: runners.filter((r) => r.online).length,
      activeRunnerId,
      waving,
    });
    layer.clearLayers();

    L.circle([buyer.lat, buyer.lng], {
      radius: waving ? 700 : 380,
      color: "oklch(0.62 0.16 145)",
      weight: 1,
      fillColor: "oklch(0.62 0.16 145)",
      fillOpacity: 0.12,
    }).addTo(layer);

    L.marker([buyer.lat, buyer.lng], {
      icon: buyerIcon(Boolean(waving)),
    }).addTo(layer);

    const onlineRunners = runners.filter((r) => r.online);

    onlineRunners.forEach((r) => {
      const active = r.id === activeRunnerId;
      const dist = formatDistance(
        Math.hypot(
          (r.lat - buyer.lat) * 111,
          (r.lng - buyer.lng) * 111 * Math.cos((buyer.lat * Math.PI) / 180),
        ),
      );
      mapLogger.debug("Rendering runner", {
        id: r.id,
        name: r.name,
        active,
        lat: r.lat,
        lng: r.lng,
        rating: r.rating,
      });
      const marker = L.marker([r.lat, r.lng], {
        icon: runnerIcon(active, r.name.charAt(0), r.avatar),
      })
        .addTo(layer)
        .bindPopup(
          `<div class="p-1 text-center font-sans">` +
            `<strong class="text-sm font-semibold">${escapeHtml(r.name)}</strong>` +
            `<div class="text-xs text-muted-foreground mt-0.5">Trader · ★ ${r.rating.toFixed(1)}</div>` +
            `<div class="text-xs font-medium text-primary mt-1">${dist} away</div>` +
            `</div>`,
        );

      if (active) {
        mapLogger.debug("Drawing line to active runner");
        L.polyline(
          [
            [r.lat, r.lng],
            [buyer.lat, buyer.lng],
          ],
          { color: "oklch(0.72 0.17 62)", weight: 3, dashArray: "6 8" },
        ).addTo(layer);
      }
    });

    // Smart bounds calculation: fit buyer and all online traders in view if available
    const map = mapRef.current;
    if (map && !courierPosition && !route) {
      const points: [number, number][] = [[buyer.lat, buyer.lng]];
      onlineRunners.forEach((r) => points.push([r.lat, r.lng]));
      if (points.length > 1) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runners is intentionally omitted; runnersKey is its stable proxy
  }, [runnersKey, activeRunnerId, waving, buyer.lat, buyer.lng]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      aria-label="Map of nearby veggie runners"
    >
      {/* Glassmorphic Route Loading Banner */}
      <RouteLoadingBanner isLoading={routeLoading} />

      {/* Navigation Progress Tracker Overlay (top left / overlay) */}
      {navigationSteps && navigationSteps.length > 0 && (
        <div className="absolute top-16 left-4 z-400">
          <NavigationTracker steps={navigationSteps} />
        </div>
      )}

      {/* Recenter button - top left */}
      <button
        onClick={() => {
          mapRef.current?.setView([buyer.lat, buyer.lng], 15, { animate: true });
          setFollowMode(false);
        }}
        className="absolute top-4 left-4 z-400 bg-background/95 backdrop-blur-sm rounded-lg p-2 shadow-lg hover:bg-background transition-colors border"
        aria-label="Recenter map"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Follow toggle - top right */}
      {courierPosition && (
        <button
          onClick={() => setFollowMode(!followMode)}
          className={`absolute top-4 right-4 z-400 bg-background/95 backdrop-blur-sm rounded-lg p-2 shadow-lg hover:bg-background transition-colors border ${
            followMode ? "ring-2 ring-primary" : ""
          }`}
          aria-label={followMode ? "Stop following courier" : "Follow courier"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}

      {/* Status indicator - bottom center */}
      {courierPosition === null && activeRunnerId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border z-400">
          <p className="text-sm text-muted-foreground">Waiting for seller location...</p>
        </div>
      )}

      {/* GPS Disconnected Slide-Up Banner */}
      {isGpsDisconnected && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-500 w-[90%] max-w-sm rounded-xl bg-destructive/15 border border-destructive/40 backdrop-blur-md px-4 py-2.5 shadow-xl animate-slide-up flex items-center justify-center gap-2.5 text-destructive">
          <WifiOff className="size-4 animate-pulse shrink-0" />
          <span className="text-xs font-semibold tracking-wide">Reconnecting to live GPS...</span>
        </div>
      )}

      {/* Courier info panel - bottom left */}
      {courierPosition && (
        <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xl">🚴</span>
            </div>
            <div>
              <p className="font-semibold text-sm">Courier en route</p>
              <p className="text-xs text-muted-foreground">
                {formatDistance(courierPosition.distanceKm)} away
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-sm">
              <span className="font-medium">ETA:</span> ~{courierPosition.etaMinutes} min
            </p>
          </div>
        </div>
      )}

      {/* Compass fallback - top right when no route */}
      {bearing !== null && !route && courierPosition && (
        <div
          ref={compassRef}
          className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm rounded-xl w-16 h-16 flex items-center justify-center shadow-lg border z-400"
          style={{ transform: `rotate(${bearing}deg)` }}
        >
          <div className="text-2xl" style={{ transform: `rotate(${-bearing}deg)` }}>
            ↗
          </div>
          <span className="absolute bottom-1 text-[10px] text-muted-foreground">
            {Math.round(bearing)}°
          </span>
        </div>
      )}

      {/* Route step instructions - bottom right */}
      {route && route.steps.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border max-w-[320px]">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-primary text-xs">↗</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Next step</p>
              <p className="font-medium text-sm">{route.steps[0].instruction}</p>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                <span>{Math.round(route.steps[0].distance)}m</span>
                <span>{Math.round(route.steps[0].duration / 60)}min</span>
              </div>
              {route.steps.length > 1 && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  +{route.steps.length - 1} more steps
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
