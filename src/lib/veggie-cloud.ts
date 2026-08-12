import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BUYER_POSITION,
  catalogWith,
  iconKeyFromName,
  type CustomItem,
} from "./veggie-data";

export type Role = "buyer" | "trader";
export type OrderStatus =
  | "waving"
  | "accepted"
  | "on-the-way"
  | "delivered"
  | "paid"
  | "cancelled";

export type StockLine = {
  itemId: string;
  price: number;
  quantity: number;
  available: boolean;
};

export type Trader = {
  id: string;
  name: string;
  avatar: string | null;
  online: boolean;
  lat: number;
  lng: number;
  rating: number;
  earnings: number;
  stock: StockLine[];
};

export type OrderLine = { id: string; qty: number };

export type Order = {
  id: string;
  buyerId: string;
  traderId: string | null;
  status: OrderStatus;
  items: OrderLine[];
  wish: string;
  note: string;
  total: number;
  paidWith: string | null;
  buyerLat: number | null;
  buyerLng: number | null;
  createdAt: number;
};

export type DemandEntry = {
  key: string;
  itemId: string | null;
  label: string;
  requests: number;
  unfilled: number;
  lastAt: number;
};

export type Profile = {
  id: string;
  name: string;
  role: Role;
  avatar: string | null;
  online: boolean;
  lat: number | null;
  lng: number | null;
  rating: number;
  earnings: number;
};

export type CloudState = {
  ready: boolean;
  me: Profile | null;
  traders: Trader[];
  orders: Order[];
  demand: DemandEntry[];
  customItems: CustomItem[];
  wallet: { balance: number } | null;
};

const empty: CloudState = {
  ready: false,
  me: null,
  traders: [],
  orders: [],
  demand: [],
  customItems: [],
  wallet: null,
};

/** Price the given trader charges, or null when they don't have it available. */
export function priceFor(trader: Trader, itemId: string): number | null {
  const line = trader.stock.find((s) => s.itemId === itemId);
  if (!line || !line.available || line.quantity <= 0) return null;
  return line.price;
}

export function stockLine(trader: Trader, itemId: string): StockLine | null {
  return trader.stock.find((s) => s.itemId === itemId) ?? null;
}

async function load(userId: string): Promise<CloudState> {
  const [profiles, stock, orders, demand, custom, wallet] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("stock").select("*"),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("demand").select("*").order("requests", { ascending: false }),
    supabase.from("catalog_items").select("*"),
    supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
  ]);

  const stockRows = stock.data ?? [];
  const traders: Trader[] = (profiles.data ?? [])
    .filter((p) => p.role === "trader")
    .map((p) => ({
      id: p.id,
      name: p.name || "Trader",
      avatar: p.avatar,
      online: p.online,
      lat: p.lat ?? BUYER_POSITION.lat,
      lng: p.lng ?? BUYER_POSITION.lng,
      rating: Number(p.rating),
      earnings: Number(p.earnings),
      stock: stockRows
        .filter((s) => s.trader_id === p.id)
        .map((s) => ({
          itemId: s.item_id,
          price: Number(s.price),
          quantity: s.quantity,
          available: s.available,
        })),
    }));

  const mine = (profiles.data ?? []).find((p) => p.id === userId) ?? null;

  return {
    ready: true,
    me: mine
      ? {
          id: mine.id,
          name: mine.name,
          role: mine.role as Role,
          avatar: mine.avatar,
          online: mine.online,
          lat: mine.lat,
          lng: mine.lng,
          rating: Number(mine.rating),
          earnings: Number(mine.earnings),
        }
      : null,
    traders,
    orders: (orders.data ?? []).map((o) => ({
      id: o.id,
      buyerId: o.buyer_id,
      traderId: o.trader_id,
      status: o.status as OrderStatus,
      items: (o.items as OrderLine[] | null) ?? [],
      wish: o.wish,
      note: o.note,
      total: Number(o.total),
      paidWith: o.paid_with,
      buyerLat: o.buyer_lat,
      buyerLng: o.buyer_lng,
      createdAt: new Date(o.created_at).getTime(),
    })),
    demand: (demand.data ?? []).map((d) => ({
      key: d.key,
      itemId: d.item_id,
      label: d.label,
      requests: d.requests,
      unfilled: d.unfilled,
      lastAt: new Date(d.last_at).getTime(),
    })),
    customItems: (custom.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      unit: c.unit,
      price: Number(c.price),
      iconKey: c.icon_key,
    })),
    wallet: wallet.data ? { balance: Number(wallet.data.balance) } : null,
  };
}

/** Live shared state: loads everything, then refreshes on any database change. */
export function useCloud(userId: string | null): CloudState & { refresh: () => void } {
  const [state, setState] = useState<CloudState>(empty);

  const refresh = useCallback(() => {
    if (!userId) return;
    void load(userId).then(setState);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setState(empty);
      return;
    }
    let alive = true;
    void load(userId).then((next) => {
      if (alive) setState(next);
    });

    const bump = () => {
      void load(userId).then((next) => {
        if (alive) setState(next);
      });
    };

    const channel = supabase
      .channel("veggie-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, bump)
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { ...state, refresh };
}

/** Make sure a signed-in user has a profile row and a Wave Pay wallet. */
export async function ensureProfile(
  userId: string,
  fallback: { name: string; role: Role },
) {
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!data) {
    await supabase
      .from("profiles")
      .insert({ id: userId, name: fallback.name, role: fallback.role });
  }
  const { data: wallet } = await supabase
    .from("wallets")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!wallet) await supabase.from("wallets").insert({ user_id: userId });
}

export async function saveProfile(
  userId: string,
  patch: Partial<{
    name: string;
    avatar: string;
    online: boolean;
    lat: number;
    lng: number;
    role: Role;
  }>,
) {
  await supabase.from("profiles").update(patch).eq("id", userId);
}

export async function upsertStock(
  traderId: string,
  line: { itemId: string; price: number; quantity: number; available: boolean },
) {
  await supabase.from("stock").upsert(
    {
      trader_id: traderId,
      item_id: line.itemId,
      price: line.price,
      quantity: line.quantity,
      available: line.available,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trader_id,item_id" },
  );
}

export async function removeStock(traderId: string, itemId: string) {
  await supabase.from("stock").delete().eq("trader_id", traderId).eq("item_id", itemId);
}

export async function createWave(input: {
  buyerId: string;
  items: OrderLine[];
  wish: string;
  note: string;
  total: number;
  lat: number;
  lng: number;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      buyer_id: input.buyerId,
      items: input.items,
      wish: input.wish,
      note: input.note,
      total: input.total,
      buyer_lat: input.lat,
      buyer_lng: input.lng,
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  await supabase.from("orders").update({ status }).eq("id", orderId);
}

/** Claim an open wave — fails silently if another trader got there first. */
export async function acceptWave(orderId: string, traderId: string, total: number) {
  const { data } = await supabase
    .from("orders")
    .update({ trader_id: traderId, status: "accepted", total })
    .eq("id", orderId)
    .is("trader_id", null)
    .eq("status", "waving")
    .select("id");
  return Boolean(data?.length);
}

export async function payOrder(orderId: string, pin: string, method: "wave-pay" | "cash") {
  const { data, error } = await supabase.rpc("pay_order", {
    _order_id: orderId,
    _pin: pin,
    _method: method,
  });
  if (error) return "error";
  return (data as string) ?? "error";
}

/** Record what people asked for, and whether any online trader could supply it. */
export async function logDemand(
  entries: { itemId: string | null; label: string }[],
  traders: Trader[],
) {
  const online = traders.filter((t) => t.online);
  for (const entry of entries) {
    const stocked = entry.itemId
      ? online.some((t) => priceFor(t, entry.itemId as string) !== null)
      : false;
    await supabase.rpc("log_demand", {
      _item_id: entry.itemId,
      _label: entry.label,
      _stocked: stocked,
    });
  }
}

/** Turn a repeated free-text request into a tappable catalog item. */
export async function promoteToCatalog(entry: DemandEntry, price: number) {
  const id = `custom-${entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const name = entry.label.charAt(0).toUpperCase() + entry.label.slice(1);
  await supabase.from("catalog_items").insert({
    id,
    name,
    unit: "each",
    price,
    icon_key: iconKeyFromName(entry.label),
  });
  return id;
}

/** Average price other traders charge, or the catalog default. */
export function suggestedPrice(state: CloudState, itemId: string): number {
  const prices = state.traders
    .flatMap((t) => t.stock)
    .filter((s) => s.itemId === itemId)
    .map((s) => s.price);
  if (prices.length) return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  return catalogWith(state.customItems).find((c) => c.id === itemId)?.price ?? 20;
}
