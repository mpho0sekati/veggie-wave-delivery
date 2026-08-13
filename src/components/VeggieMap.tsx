import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BUYER_POSITION, type Runner } from "@/lib/veggie-data";

type Props = {
  runners: Runner[];
  activeRunnerId?: string | null;
  waving?: boolean;
  buyerPosition?: { lat: number; lng: number };
  /** Long-press / right-click the map to drop your own pin when GPS is unavailable. */
  onPickPosition?: (pos: { lat: number; lng: number }) => void;
};


function runnerIcon(active: boolean, initial: string, avatar?: string | null) {
  const inner = avatar
    ? `<img src="${avatar}" alt="" class="h-full w-full rounded-full object-cover" />`
    : `<span class="text-sm font-semibold">${initial}</span>`;
  return L.divIcon({
    className: "",
    html: `<div class="marker-runner ${active ? "marker-runner-active" : ""}">${inner}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function buyerIcon(waving: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="marker-buyer ${waving ? "marker-buyer-waving" : ""}"><span>You</span></div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

export default function VeggieMap({ runners, activeRunnerId, waving, buyerPosition }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const buyer = buyerPosition ?? BUYER_POSITION;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [buyer.lat, buyer.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setView([buyer.lat, buyer.lng], map.getZoom(), { animate: true });
  }, [buyer.lat, buyer.lng]);

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
        const active = r.id === activeRunnerId;
        L.marker([r.lat, r.lng], {
          icon: runnerIcon(active, r.name.charAt(0), r.avatar),
        })
          .addTo(layer)
          .bindPopup(
            `<strong>${r.name}</strong><br/>Veggie runner · ★ ${r.rating.toFixed(1)}`,
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
  }, [runners, activeRunnerId, waving, buyer.lat, buyer.lng]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Map of nearby veggie runners" />;
}

