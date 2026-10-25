import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateState } from "./veggie-store";
import { useSession } from "./use-session";
import type { Runner } from "./veggie-data";

/** Discovery radius box: a little wider than the 5 km suitability limit. */
export const DISCOVERY_RADIUS_KM = 6;
export const MAX_DISCOVERY_TRADERS = 100;

/** Round the origin to ~1 km cells so small GPS jitter reuses the cached query. */
export function discoveryBox(origin: { lat: number; lng: number }, radiusKm = DISCOVERY_RADIUS_KM) {
  const lat = Math.round(origin.lat * 100) / 100;
  const lng = Math.round(origin.lng * 100) / 100;
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { lat, lng, minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function useMarketplace(origin?: { lat: number; lng: number; located: boolean }) {
  const session = useSession();
  const box = origin?.located ? discoveryBox(origin) : null;
  // Catalog of custom items changes rarely: cache for 30 minutes instead of polling.
  const catalogQuery = useQuery({
    queryKey: ["catalog-custom"],
    enabled: Boolean(session.userId),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .like("id", "custom-%")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const query = useQuery({
    queryKey: ["marketplace", session.userId, box?.lat, box?.lng],
    enabled: Boolean(session.userId),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      let profilesQuery = supabase
        .from("profiles")
        .select("id,name,avatar,online,lat,lng,rating")
        .eq("online", true);
      if (box) {
        profilesQuery = profilesQuery
          .gte("lat", box.minLat)
          .lte("lat", box.maxLat)
          .gte("lng", box.minLng)
          .lte("lng", box.maxLng);
      }
      const [nearby, own, demand] = await Promise.all([
        profilesQuery.limit(MAX_DISCOVERY_TRADERS),
        supabase
          .from("profiles")
          .select("id,name,avatar,online,lat,lng,rating")
          .eq("id", session.userId!)
          .limit(1),
        supabase.from("demand").select("*").order("last_at", { ascending: false }).limit(50),
      ]);
      for (const result of [nearby, own, demand]) if (result.error) throw result.error;
      const byId = new Map<string, NonNullable<typeof nearby.data>[number]>();
      for (const p of [...(nearby.data ?? []), ...(own.data ?? [])]) byId.set(p.id, p);
      const profiles = [...byId.values()];
      // Only stock for traders actually in view, not the whole country.
      const stock = await supabase
        .from("stock")
        .select("*")
        .in(
          "trader_id",
          profiles.map((p) => p.id),
        )
        .limit(2000);
      if (stock.error) throw stock.error;
      return { profiles, stock: stock.data ?? [], demand: demand.data ?? [] };
    },
  });
  useEffect(() => {
    if (!query.data) return;
    const data = { ...query.data, catalog: catalogQuery.data ?? [] };
    const runners: Runner[] = data.profiles
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        online: p.online,
        lat: p.lat ?? 0,
        lng: p.lng ?? 0,
        rating: Number(p.rating),
        earnings: 0,
        stock: data.stock
          .filter((s) => s.trader_id === p.id && s.available && s.quantity > 0)
          .map((s) => ({ itemId: s.item_id, price: Number(s.price), quantity: s.quantity })),
      }));
    updateState((prev) => ({
      ...prev,
      runners,
      userId: session.userId,
      customItems: data.catalog.map((c) => ({
        id: c.id,
        name: c.name,
        unit: c.unit,
        price: Number(c.price),
        iconKey: c.icon_key,
      })),
      demand: data.demand.map((d) => ({
        key: d.key,
        itemId: d.item_id,
        label: d.label,
        requests: d.requests,
        unfilled: d.unfilled,
        lastAt: new Date(d.last_at).getTime(),
      })),
    }));
  }, [query.data, catalogQuery.data, session.userId]);
  return { session, refresh: query.refetch, error: query.error };
}

export async function saveTraderProfile(
  userId: string,
  patch: { name?: string; online?: boolean; lat?: number; lng?: number; avatar?: string },
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}
export async function saveTraderStock(
  userId: string,
  itemId: string,
  price: number,
  available: boolean,
  quantity = 1,
) {
  const { data: existing, error: readError } = await supabase
    .from("stock")
    .select("id")
    .eq("trader_id", userId)
    .eq("item_id", itemId)
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  const values = { trader_id: userId, item_id: itemId, price, available, quantity };
  const { error } = existing
    ? await supabase.from("stock").update(values).eq("id", existing.id)
    : await supabase.from("stock").insert(values);
  if (error) throw error;
}
