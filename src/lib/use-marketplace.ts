import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateState } from "./veggie-store";
import { useSession } from "./use-session";
import type { Runner } from "./veggie-data";

export function useMarketplace() {
  const session = useSession();
  const query = useQuery({
    queryKey: ["marketplace", session.userId],
    enabled: Boolean(session.userId),
    refetchInterval: 15000,
    queryFn: async () => {
      const [profiles, stock, catalog, demand] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,name,avatar,online,lat,lng,rating")
          .or(`online.eq.true,id.eq.${session.userId}`),
        supabase
          .from("stock")
          .select("*")
          .or(`available.eq.true,trader_id.eq.${session.userId}`)
          .limit(2000),
        supabase.from("catalog_items").select("*").like("id", "custom-%").limit(200),
        supabase.from("demand").select("*").order("last_at", { ascending: false }).limit(50),
      ]);
      for (const result of [profiles, stock, catalog, demand]) if (result.error) throw result.error;
      return {
        profiles: profiles.data ?? [],
        stock: stock.data ?? [],
        catalog: catalog.data ?? [],
        demand: demand.data ?? [],
      };
    },
  });
  useEffect(() => {
    if (!query.data) return;
    const data = query.data;
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
  }, [query.data, session.userId]);
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
