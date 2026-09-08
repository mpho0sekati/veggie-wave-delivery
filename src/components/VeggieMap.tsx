import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BUYER_POSITION, type Runner, formatDistance } from "@/lib/veggie-data";
import type { TrackedPosition } from "@/lib/use-courier-tracking";
import type { RouteResult } from "@/lib/routing.server";

type Props = {
  runners: Runner[];
  activeRunnerId?: string | null;
  waving?: boolean;
  buyerPosition?: { lat: number; lng: number };
  recenterTrigger?: number;
  /** Live courier position for delivery tracking */
  courierPosition?: TrackedPosition | null;
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

function courierIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="marker-courier"><span>🚴</span></div>`,
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [buyer.lat, buyer.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
      // don't hijack page scroll — pinch/ctrl+wheel and the zoom buttons still work
      scrollWheelZoom: false,
    });
    const handleMapPick = (e: L.LeafletMouseEvent) => {
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

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
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

  // Animate courier marker when position updates
  useEffect(() => {
    if (!courierPosition || !mapRef.current) return;

    const map = mapRef.current;
    const layer = layerRef.current;
    if (!layer) return;

    // Remove existing courier marker and line
    if (courierMarkerRef.current) {
      layer.removeLayer(courierMarkerRef.current);
      courierMarkerRef.current = null;
    }
    if (courierLineRef.current) {
      layer.removeLayer(courierLineRef.current);
      courierLineRef.current = null;
    }

    // Create animated courier marker
    const courierMarker = L.marker([courierPosition.lat, courierPosition.lng], {
      icon: courierIcon(),
    }).addTo(layer);
    
    courierMarkerRef.current = courierMarker;

    // Create line from courier to buyer
    const line = L.polyline(
      [
        [courierPosition.lat, courierPosition.lng],
        [buyer.lat, buyer.lng],
      ],
      { color: "oklch(0.55 0.25 145)", weight: 3, dashArray: "6 8" },
    ).addTo(layer);
    
    courierLineRef.current = line;

    // Smooth transition to show both markers
    const bounds = L.latLngBounds([
      [courierPosition.lat, courierPosition.lng],
      [buyer.lat, buyer.lng],
    ]);
    map.fitBounds(bounds, { animate: true, duration: 0.5, padding: [40, 40] });
  }, [courierPosition, buyer.lat, buyer.lng]);

  // Render route polyline when available
  useEffect(() => {
    if (!route || !mapRef.current || !layerRef.current) return;

    const layer = layerRef.current;
    const map = mapRef.current;

    // Remove existing route line
    if (routeLineRef.current) {
      layer.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    // Draw new route line
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
        map.fitBounds(combinedBounds, { animate: true, duration: 0.5, padding: [40, 40] });
      } else {
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

    runners
      .filter((r) => r.online)
      .forEach((r) => {
        const map = mapRef.current;
        const active = r.id === activeRunnerId;
        const marker = L.marker([r.lat, r.lng], {
          icon: runnerIcon(active, r.name.charAt(0), r.avatar),
        })
          .addTo(layer)
          .bindPopup(
            `<strong>${escapeHtml(r.name)}</strong><br/>Veggie runner · ★ ${r.rating.toFixed(1)}`,
          );

        if (active && map) {
          map.setView([r.lat, r.lng], map.getZoom(), { animate: true });
          marker.openPopup();
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runners is intentionally omitted; runnersKey is its stable proxy
  }, [runnersKey, activeRunnerId, waving, buyer.lat, buyer.lng]);

  return (
    <div ref={containerRef} className="h-full w-full relative" aria-label="Map of nearby veggie runners">
      {courierPosition && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
          <p className="text-sm font-medium">
            Courier: {formatDistance(courierPosition.distanceKm)} away
          </p>
          <p className="text-sm text-muted-foreground">
            Arriving in ~{courierPosition.etaMinutes} min
          </p>
        </div>
      )}

      {/* Compass fallback when we have a bearing but no route */}
      {bearing !== null && !route && courierPosition && (
        <div
          ref={compassRef}
          className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-full w-20 h-20 flex items-center justify-center shadow-lg border"
          style={{ transform: `rotate(${bearing}deg)` }}
        >
          <div className="text-2xl" style={{ transform: `rotate(${-bearing}deg)` }}>
            ↗
          </div>
        </div>
      )}

      {/* Route step instructions */}
      {route && route.steps.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg max-w-[280px]">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Next step:</p>
          <p className="text-sm font-medium">
            {route.steps[0].instruction}
          </p>
          <p className="text-xs text-muted-foreground">
            {Math.round(route.steps[0].distance)}m · {Math.round(route.steps[0].duration / 60)}min
          </p>
          {route.steps.length > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              +{route.steps.length - 1} more steps · Total: {Math.round(route.distanceM)}m
            </p>
          )}
        </div>
      )}
    </div>
  );
}
