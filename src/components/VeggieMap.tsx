import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BUYER_POSITION, type Runner, formatDistance } from "@/lib/veggie-data";
import type { TrackedPosition } from "@/lib/use-courier-tracking";
import type { RouteResult } from "@/lib/routing.server";
import { animateMarker } from "@/lib/marker-animator";
import RouteLoadingBanner from "@/components/RouteLoadingBanner";
import { createLogger } from "@/lib/logger";
import { Navigation2, WifiOff } from "lucide-react";

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
  /** Route polyline and steps for seller navigation */
  route?: RouteResult | null;
  /** Bearings for compass fallback when no route */
  bearing?: number | null;
  /** Long-press / right-click the map to drop your own pin when GPS is unavailable. */
  onPickPosition?: (pos: { lat: number; lng: number }) => void;
};

function runnerIcon(active: boolean, name: string, rating: number, avatar?: string | null) {
  const safeAvatar = avatar?.startsWith("data:image/") ? escapeHtml(avatar) : null;
  const avatarHtml = safeAvatar
    ? `<img src="${safeAvatar}" alt="" class="size-7 rounded-full object-cover shrink-0" />`
    : `<div class="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">${escapeHtml(name.charAt(0))}</div>`;

  return L.divIcon({
    className: "",
    html: `<div class="uber-marker-runner ${active ? "active" : ""}">
      ${avatarHtml}
      <div class="flex flex-col text-left leading-none pr-1">
        <span class="text-[0.7rem] font-bold truncate max-w-[80px]">${escapeHtml(name)}</span>
        <span class="text-[0.7rem] opacity-80 mt-0.5">★ ${rating.toFixed(1)}</span>
      </div>
    </div>`,
    iconSize: [110, 36],
    iconAnchor: [55, 18],
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
    html: `<div class="uber-marker-buyer ${waving ? "waving" : ""}">
      <div class="dot"></div>
      <div class="pulse"></div>
      <span class="label">Pickup</span>
    </div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 30],
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
  const pickRef = useRef(onPickPosition);
  pickRef.current = onPickPosition;
  const buyer = buyerPosition ?? BUYER_POSITION;
  const [followMode, setFollowMode] = useState(false);

  // --- Uber-style camera management -----------------------------------------
  // The camera fits each phase exactly once; after that the user owns the view.
  const programmaticMoveRef = useRef(false);
  const userMovedRef = useRef(false);
  const runnersFittedRef = useRef(false);
  const courierFittedRef = useRef(false);
  const fittedRouteSigRef = useRef<string | null>(null);

  /** Fit bounds while flagging the move as programmatic so we don't count it as user intent. */
  const fitSmooth = (map: L.Map, bounds: L.LatLngBounds) => {
    if (!bounds.isValid()) return;
    programmaticMoveRef.current = true;
    map.fitBounds(bounds, {
      animate: true,
      duration: 0.6,
      paddingTopLeft: [40, 110], // clear the floating header
      paddingBottomRight: [40, 240], // clear the bottom drawer
    });
    map.once("moveend", () => {
      programmaticMoveRef.current = false;
    });
  };

  /** Pan smoothly so both the courier and the buyer stay in view — no jarring refits. */
  const keepBothInView = (map: L.Map, courier: { lat: number; lng: number }) => {
    const bounds = L.latLngBounds([
      [courier.lat, courier.lng],
      [buyer.lat, buyer.lng],
    ]);
    const view = map.getBounds().pad(-0.08);
    if (!view.contains(bounds)) fitSmooth(map, bounds);
  };

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
    // Once the user pans/zooms themselves, the camera stops auto-refitting.
    map.on("dragstart", () => {
      userMovedRef.current = true;
      setFollowMode(false);
      mapLogger.debug("User took camera control");
    });
    map.on("zoomstart", () => {
      if (!programmaticMoveRef.current) userMovedRef.current = true;
    });
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

  // Explicit recenter (header crosshair) hands camera control back to the app.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterTrigger === 0) return;
    userMovedRef.current = false;
    runnersFittedRef.current = false;
    courierFittedRef.current = false;
    fittedRouteSigRef.current = null;
    map.setView([buyer.lat, buyer.lng], 15, { animate: true });
  }, [buyer.lat, buyer.lng, recenterTrigger]);

  // Courier tracking: one-time fit on arrival, then only nudge when someone leaves the view.
  useEffect(() => {
    if (!courierPosition) {
      // Delivery ended — rearm so the next delivery gets its one-time fit.
      courierFittedRef.current = false;
      return;
    }
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    mapLogger.info("Courier position updated", {
      lat: courierPosition.lat,
      lng: courierPosition.lng,
      distanceKm: courierPosition.distanceKm,
      etaMinutes: courierPosition.etaMinutes,
      isGpsDisconnected,
    });

    if (courierLineRef.current) {
      layer.removeLayer(courierLineRef.current);
      courierLineRef.current = null;
    }

    if (!courierMarkerRef.current) {
      mapLogger.debug("Creating courier marker");
      courierMarkerRef.current = L.marker([courierPosition.lat, courierPosition.lng], {
        icon: courierIcon(isGpsDisconnected),
      }).addTo(layer);
    } else {
      courierMarkerRef.current.setIcon(courierIcon(isGpsDisconnected));
      // Smooth 2-second LERP animation for marker position
      animateMarker(courierMarkerRef.current, courierPosition.lat, courierPosition.lng, 2000);
    }

    courierLineRef.current = L.polyline(
      [
        [courierPosition.lat, courierPosition.lng],
        [buyer.lat, buyer.lng],
      ],
      { color: "oklch(0.55 0.25 145)", weight: 3, dashArray: "6 8" },
    ).addTo(layer);

    if (followMode) {
      keepBothInView(map, courierPosition);
    } else if (!courierFittedRef.current && !userMovedRef.current) {
      courierFittedRef.current = true;
      fitSmooth(
        map,
        L.latLngBounds([
          [courierPosition.lat, courierPosition.lng],
          [buyer.lat, buyer.lng],
        ]),
      );
    }
  }, [courierPosition, buyer.lat, buyer.lng, followMode, isGpsDisconnected]);

  // Route line: drawn on every new route, camera fitted once per distinct route path.
  useEffect(() => {
    if (!route || !mapRef.current || !layerRef.current) return;
    mapLogger.info("Route received", {
      distanceM: route.distanceM,
      durationS: route.durationS,
      stepsCount: route.steps.length,
    });

    const layer = layerRef.current;
    const map = mapRef.current;

    if (routeLineRef.current) {
      layer.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    routeLineRef.current = L.polyline(route.polyline, {
      color: "oklch(0.55 0.15 62)",
      weight: 5,
      opacity: 0.8,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(layer);

    const bounds = L.latLngBounds(route.polyline);
    if (!bounds.isValid()) return;
    const first = route.polyline[0];
    const last = route.polyline[route.polyline.length - 1];
    const signature = `${first?.lat},${first?.lng}|${last?.lat},${last?.lng}`;
    if (signature === fittedRouteSigRef.current) return;
    fittedRouteSigRef.current = signature;

    if (courierPosition) {
      bounds.extend([
        [courierPosition.lat, courierPosition.lng],
        [buyer.lat, buyer.lng],
      ]);
    }
    fitSmooth(map, bounds);
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
      const marker = L.marker([r.lat, r.lng], {
        icon: runnerIcon(active, r.name, r.rating, r.avatar),
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
        L.polyline(
          [
            [r.lat, r.lng],
            [buyer.lat, buyer.lng],
          ],
          { color: "oklch(0.72 0.17 62)", weight: 3, dashArray: "6 8" },
        ).addTo(layer);
      }
    });

    // Frame the market exactly once on first paint; after that the user owns the camera.
    const map = mapRef.current;
    if (
      map &&
      !runnersFittedRef.current &&
      !courierPosition &&
      !route &&
      !userMovedRef.current &&
      onlineRunners.length > 0
    ) {
      runnersFittedRef.current = true;
      const points: [number, number][] = [[buyer.lat, buyer.lng]];
      onlineRunners.forEach((r) => points.push([r.lat, r.lng]));
      fitSmooth(map, L.latLngBounds(points));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runners is intentionally omitted; runnersKey is its stable proxy
  }, [runnersKey, activeRunnerId, waving, buyer.lat, buyer.lng]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      aria-label="Map of nearby veggie runners"
    >
      {/* Route calculation banner, tucked below the floating header */}
      <div className="absolute top-20 left-1/2 z-500 w-[92%] max-w-sm -translate-x-1/2">
        <RouteLoadingBanner isLoading={routeLoading} />
      </div>

      {/* Follow-the-courier toggle — Uber keeps this single control on the map */}
      {courierPosition && (
        <button
          onClick={() => setFollowMode(!followMode)}
          className={`absolute top-20 left-4 z-500 flex size-10 items-center justify-center rounded-full border bg-background/95 shadow-lg backdrop-blur-sm transition-colors hover:bg-background ${
            followMode ? "ring-2 ring-primary" : ""
          }`}
          aria-label={followMode ? "Stop following courier" : "Follow courier"}
        >
          <Navigation2 className={`size-5 ${followMode ? "text-primary" : ""}`} />
        </button>
      )}

      {/* Compass fallback while the seller has no routed path yet */}
      {bearing != null && !route && courierPosition && (
        <div
          className="absolute top-20 right-4 z-500 flex size-16 items-center justify-center rounded-xl border bg-background/95 shadow-lg backdrop-blur-sm"
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

      {/* GPS hiccup banner, top center so the drawer never hides it */}
      {isGpsDisconnected && (
        <div className="absolute top-20 left-1/2 z-600 w-[90%] max-w-sm -translate-x-1/2 animate-slide-up rounded-xl border border-destructive/40 bg-destructive/15 px-4 py-2.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-center gap-2.5 text-destructive">
            <WifiOff className="size-4 shrink-0 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide">Reconnecting to live GPS…</span>
          </div>
        </div>
      )}
    </div>
  );
}
