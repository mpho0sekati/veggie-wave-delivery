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
import { Button } from "@/components/ui/button";

const mapLogger = createLogger("VeggieMap");

export type WavePin = { id: string; lat: number; lng: number; label: string };

type Props = {
  runners: Runner[];
  activeRunnerId?: string | null;
  waving?: boolean;
  buyerPosition?: { lat: number; lng: number };
  buyerLocated?: boolean;
  delivered?: boolean;
  recenterTrigger?: number;
  recenterPosition?: { lat: number; lng: number };
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
  /** Customer waves shown to the trader as pulsing pins. */
  waves?: WavePin[];
  /** Trader tapped a customer wave pin. */
  onWaveClick?: (waveId: string) => void;
};

function runnerIcon(active: boolean, name: string, rating: number, avatar?: string | null) {
  const safeAvatar = avatar?.startsWith("data:image/") ? escapeHtml(avatar) : null;
  const avatarHtml = safeAvatar
    ? `<img src="${safeAvatar}" alt="" class="size-7 rounded-full object-cover shrink-0" />`
    : `<div class="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">${escapeHtml(name.charAt(0))}</div>`;

  return L.divIcon({
    className: "",
    html: `<div class="cart-marker ${active ? "active" : ""}">
      <div class="cart-ring"></div>
      <div class="cart-bubble"><span class="cart-emoji"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></span></div>
      <div class="uber-marker-runner ${active ? "active" : ""}">
        ${avatarHtml}
        <div class="flex flex-col text-left leading-none pr-1">
          <span class="text-[0.7rem] font-bold truncate max-w-[80px]">${escapeHtml(name)}</span>
          <span class="text-[0.7rem] opacity-80 mt-0.5"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline;vertical-align:-1px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${rating.toFixed(1)}</span>
        </div>
      </div>
    </div>`,
    iconSize: [110, 84],
    iconAnchor: [55, 26],
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

function buyerIcon(waving: boolean, delivered: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="uber-marker-buyer ${waving ? "waving" : ""} ${delivered ? "delivered" : ""}">
      <div class="dot"></div>
      <div class="pulse"></div>
      <span class="label">${delivered ? "Delivered" : "Pickup"}</span>
    </div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 30],
  });
}

function courierIcon(isDisconnected = false) {
  return L.divIcon({
    className: "",
    html: `<div class="marker-courier ${isDisconnected ? "marker-courier-disconnected" : ""}"><span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function waveIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="wave-pin"><span class="wave-pin-pulse"></span><span class="wave-pin-dot"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export default function VeggieMap({
  runners,
  activeRunnerId,
  waving,
  buyerPosition,
  buyerLocated = true,
  delivered = false,
  recenterTrigger,
  recenterPosition,
  courierPosition,
  isGpsDisconnected = false,
  routeLoading = false,
  route,
  bearing,
  onPickPosition,
  waves,
  onWaveClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const courierLineRef = useRef<L.Polyline | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const pickRef = useRef(onPickPosition);
  pickRef.current = onPickPosition;
  const waveLayerRef = useRef<L.LayerGroup | null>(null);
  const waveClickRef = useRef(onWaveClick);
  waveClickRef.current = onWaveClick;
  const buyer = buyerPosition ?? BUYER_POSITION;
  const [followMode, setFollowMode] = useState(false);

  // --- Uber-style camera management -----------------------------------------
  // The camera fits each phase exactly once; after that the user owns the view.
  const programmaticMoveRef = useRef(false);
  const userMovedRef = useRef(false);
  const runnersFittedRef = useRef(false);
  const courierFittedRef = useRef(false);
  const fittedRouteSigRef = useRef<string | null>(null);
  const lastBuyerRef = useRef(buyer);
  lastBuyerRef.current = buyer;
  const recenterPositionRef = useRef(recenterPosition);
  recenterPositionRef.current = recenterPosition;
  const buyerCenteredRef = useRef(false);

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
    waveLayerRef.current = L.layerGroup().addTo(map);
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
      waveLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Explicit recenter (header crosshair) hands camera control back to the app.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !recenterTrigger) return;
    userMovedRef.current = false;
    runnersFittedRef.current = Boolean(recenterPositionRef.current);
    courierFittedRef.current = false;
    fittedRouteSigRef.current = null;
    const position = recenterPositionRef.current ?? lastBuyerRef.current;
    programmaticMoveRef.current = true;
    map.setView([position.lat, position.lng], 15, { animate: false });
    // The seller's tall stock drawer covers the centre; keep the location in the exposed map.
    if (recenterPositionRef.current) map.panBy([0, map.getSize().y * 0.3], { animate: false });
    programmaticMoveRef.current = false;
  }, [recenterTrigger]);

  // A first GPS fix moves off the default pin; later fixes never take the camera back.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !buyerLocated || buyerCenteredRef.current || userMovedRef.current) return;
    buyerCenteredRef.current = true;
    if (recenterPositionRef.current) runnersFittedRef.current = true;
    programmaticMoveRef.current = true;
    map.setView([buyer.lat, buyer.lng], 15, { animate: false });
    if (recenterPositionRef.current) map.panBy([0, map.getSize().y * 0.3], { animate: false });
    programmaticMoveRef.current = false;
  }, [buyer.lat, buyer.lng, buyerLocated]);

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
      icon: buyerIcon(Boolean(waving), delivered),
    }).addTo(layer);

    // Cap animated carts so budget phones stay smooth in busy areas; always keep the assigned trader.
    const MAX_MAP_CARTS = 25;
    const cosLat = Math.cos((buyer.lat * Math.PI) / 180);
    const sq = (r: Runner) => (r.lat - buyer.lat) ** 2 + ((r.lng - buyer.lng) * cosLat) ** 2;
    const sorted = runners.filter((r) => r.online).sort((a, b) => sq(a) - sq(b));
    const onlineRunners = sorted.slice(0, MAX_MAP_CARTS);
    const assigned = sorted.find((r) => r.id === activeRunnerId);
    if (assigned && !onlineRunners.includes(assigned)) onlineRunners.push(assigned);

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
            `<div class="text-xs text-muted-foreground mt-0.5">Trader · <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline;vertical-align:-1px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${r.rating.toFixed(1)}</div>` +
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
  }, [runnersKey, activeRunnerId, waving, delivered, buyer.lat, buyer.lng]);

  const wavesKey = useMemo(
    () => (waves ?? []).map((w) => `${w.id}:${w.lat.toFixed(5)}:${w.lng.toFixed(5)}`).join("|"),
    [waves],
  );

  // Customer wave pins on the trader's map: one pulsing hand per nearby wave,
  // on their own layer so the trader/buyer repaint never wipes them.
  useEffect(() => {
    const layer = waveLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const w of waves ?? []) {
      const marker = L.marker([w.lat, w.lng], { icon: waveIcon() }).addTo(layer);
      marker.bindPopup(
        `<div class="p-1 text-center font-sans"><strong class="text-sm font-semibold">Someone is waving</strong><div class="text-xs text-muted-foreground mt-0.5">${escapeHtml(w.label)}</div></div>`,
      );
      marker.on("click", () => waveClickRef.current?.(w.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- waves is intentionally omitted; wavesKey is its stable proxy
  }, [wavesKey]);

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
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setFollowMode(!followMode)}
          className={`absolute top-20 left-4 z-500 flex size-10 items-center justify-center rounded-full border bg-background/95 shadow-lg backdrop-blur-sm transition-colors hover:bg-background ${
            followMode ? "ring-2 ring-primary" : ""
          }`}
          aria-label={followMode ? "Stop following courier" : "Follow courier"}
        >
          <Navigation2 className={`size-5 ${followMode ? "text-primary" : ""}`} />
        </Button>
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
