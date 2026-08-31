import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BUYER_POSITION,
  catalogWith,
  iconKeyFromName,
  type CustomItem,
  type Runner,
  type StockLine,
} from "@/lib/veggie-data";

export type WaveStatus =
  | "waving"
  | "accepted"
  | "on-the-way"
  | "delivered"
  | "paid"
  | "cancelled"
  | "failed"
  | "refunded";
export type PaidWith = "wave-pay" | "cash";

export type WaveRequest = {
  id: string;
  items: { id: string; qty: number }[];
  wish: string;
  total: number;
  note: string;
  status: WaveStatus;
  runnerId: string | null;
  createdAt: number;
  paidWith?: PaidWith;
};

export type DemandEntry = {
  key: string;
  itemId: string | null;
  label: string;
  requests: number;
  unfilled: number;
  lastAt: number;
};

export type AppState = {
  runners: Runner[];
  request: WaveRequest | null;
  orders: WaveRequest[];
  demand: DemandEntry[];
  customItems: CustomItem[];
  wallet: { balance: number; pin: string };
  buyer: { lat: number; lng: number; located: boolean };
  me: { id: string; name: string; avatar: string | null; online: boolean };
  userId: string | null;
};

const MAX_DEMAND = 50;
const LOCATION_UPDATED_EVENT = "veggie-wave:location-updated";

// Fetch all runners from profiles table where role = 'trader'
async function fetchRunners(): Promise<Runner[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, name, lat, lng, online, rating, avatar, earnings,
      stock(id, item_id, price)`
    )
    .eq("role", "trader");

  if (error) {
    console.error("Error fetching runners:", error);
    return [];
  }

  return (data || []).map((profile: any) => ({
    id: profile.id,
    name: profile.name,
    lat: profile.lat ?? BUYER_POSITION.lat,
    lng: profile.lng ?? BUYER_POSITION.lng,
    online: profile.online ?? false,
    rating: profile.rating ?? 5.0,
    avatar: profile.avatar ?? null,
    earnings: profile.earnings ?? 0,
    stock: (profile.stock || []).map((s: any) => ({
      itemId: s.item_id,
      price: s.price,
    })),
  }));
}

// Fetch current user's wave request (active order)
async function fetchCurrentRequest(userId: string): Promise<WaveRequest | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", userId)
    .in("status", ["waving", "accepted", "on-the-way", "delivered"])
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching request:", error);
    return null;
  }

  if (!data) return null;

  return dbOrderToWaveRequest(data);
}

// Fetch past orders
async function fetchOrders(userId: string): Promise<WaveRequest[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", userId)
    .in("status", ["paid", "cancelled", "failed", "refunded"])
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return (data || []).map(dbOrderToWaveRequest);
}

// Fetch user's wallet
async function fetchWallet(userId: string): Promise<{ balance: number; pin: string }> {
  const { data, error } = await supabase
    .from("wallets")
    .select("balance, pin")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching wallet:", error);
    return { balance: 0, pin: "" };
  }

  return { balance: data?.balance ?? 0, pin: data?.pin ?? "1234" };
}

// Fetch user's profile
async function fetchProfile(userId: string): Promise<{
  id: string;
  name: string;
  avatar: string | null;
  online: boolean;
  lat: number;
  lng: number;
  located: boolean;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, avatar, online, lat, lng")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return {
      id: userId,
      name: "",
      avatar: null,
      online: false,
      lat: BUYER_POSITION.lat,
      lng: BUYER_POSITION.lng,
      located: false,
    };
  }

  return {
    id: data.id,
    name: data.name ?? "",
    avatar: data.avatar ?? null,
    online: data.online ?? false,
    lat: data.lat ?? BUYER_POSITION.lat,
    lng: data.lng ?? BUYER_POSITION.lng,
    located: data.lat != null,
  };
}

// Fetch demand entries
async function fetchDemand(): Promise<DemandEntry[]> {
  const { data, error } = await supabase
    .from("demand")
    .select("*")
    .order("last_at", { ascending: false })
    .limit(MAX_DEMAND);

  if (error) {
    console.error("Error fetching demand:", error);
    return [];
  }

  return (data || []).map((d: any) => ({
    key: d.key,
    itemId: d.item_id,
    label: d.label,
    requests: d.requests,
    unfilled: d.unfilled,
    lastAt: new Date(d.last_at).getTime(),
  }));
}

// Fetch custom catalog items
async function fetchCustomItems(): Promise<CustomItem[]> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("*")
    .like("id", "custom-%");

  if (error) {
    console.error("Error fetching custom items:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    price: item.price,
    iconKey: item.icon_key,
  }));
}

// Convert DB order row to WaveRequest
function dbOrderToWaveRequest(dbOrder: any): WaveRequest {
  return {
    id: dbOrder.id,
    items: (dbOrder.items || []).map((item: any) => ({
      id: item.id,
      qty: item.qty,
    })),
    wish: dbOrder.wish ?? "",
    total: dbOrder.total ?? 0,
    note: dbOrder.note ?? "",
    status: dbOrder.status ?? "waving",
    runnerId: dbOrder.trader_id ?? null,
    createdAt: new Date(dbOrder.created_at).getTime(),
    paidWith: dbOrder.paid_with,
  };
}

// Update buyer location
export async function setBuyerLocation(pos: { lat: number; lng: number }): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("profiles")
    .update({ lat: pos.lat, lng: pos.lng })
    .eq("id", user.id);

  if (error) {
    console.error("Error setting location:", error);
    return false;
  }

  window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT));
  return true;
}

// Update trader stock
export async function setStock(runnerId: string, stock: StockLine[]): Promise<void> {
  const { error: deleteErr } = await supabase.from("stock").delete().eq("trader_id", runnerId);

  if (deleteErr) {
    console.error("Error deleting stock:", deleteErr);
    return;
  }

  if (stock.length === 0) return;

  const { error: insertErr } = await supabase.from("stock").insert(
    stock.map((s) => ({
      trader_id: runnerId,
      item_id: s.itemId,
      price: s.price,
    }))
  );

  if (insertErr) console.error("Error inserting stock:", insertErr);
}

// Log demand
export async function logDemand(entries: { itemId: string | null; label: string }[]): Promise<void> {
  if (!entries.length) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  for (const entry of entries) {
    const key = entry.itemId ?? `wish:${entry.label.toLowerCase().trim()}`;
    const { error } = await supabase.from("demand").upsert(
      {
        key,
        item_id: entry.itemId,
        label: entry.label,
        requests: 1,
        last_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) console.error("Error logging demand:", error);
  }
};

// Create a wave request
export async function waveRequest(
  items: { id: string; qty: number }[],
  wish: string,
  total: number
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await fetchProfile(user.id);

  const { error } = await supabase.from("orders").insert({
    buyer_id: user.id,
    items,
    wish,
    total,
    status: "waving",
    buyer_lat: profile.lat,
    buyer_lng: profile.lng,
  });

  if (error) console.error("Error creating wave:", error);
}

// Cancel request
export async function cancelRequest(reason = "Cancelled by user"): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const order = await fetchCurrentRequest(user.id);
  if (!order) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", note: reason })
    .eq("id", order.id);

  if (error) console.error("Error cancelling:", error);
}

// Re-raise wave
export async function reraiseWave(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const order = await fetchCurrentRequest(user.id);
  if (!order) return;

  const { error } = await supabase
    .from("orders")
    .update({ created_at: new Date().toISOString() })
    .eq("id", order.id);

  if (error) console.error("Error re-raising wave:", error);
}

// Accept wave (trader side)
export async function acceptWave(orderId: string, total: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: "accepted", trader_id: user.id })
    .eq("id", orderId);

  if (error) console.error("Error accepting wave:", error);
}

// Mark as delivered
export async function markDelivered(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId);

  if (error) console.error("Error marking delivered:", error);
}

// Fail request
export async function failRequest(reason = "Unavailable"): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const order = await fetchCurrentRequest(user.id);
  if (!order) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: "failed", note: reason })
    .eq("id", order.id);

  if (error) console.error("Error failing request:", error);
}

// Pay with Wave Pay (calls server function)
export async function payWithWavePay(orderId: string, pin: string): Promise<string> {
  const { data, error } = await supabase.rpc("pay_order", {
    _order_id: orderId,
    _pin: pin,
    _method: "wave-pay",
  });

  if (error) {
    console.error("Error paying:", error);
    return "error";
  }

  return data || "error";
}

// Pay with cash (calls server function)
export async function payCash(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc("pay_order", {
    _order_id: orderId,
    _pin: null,
    _method: "cash",
  });

  if (error) {
    console.error("Error paying with cash:", error);
    return "error";
  }

  return data || "error";
}

// Refund order (calls server function)
export async function refundOrder(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc("refund_order", {
    _order_id: orderId,
  });

  if (error) {
    console.error("Error refunding:", error);
    return "error";
  }

  return data || "error";
}

// Update trader online status
export async function setOnline(online: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ online })
    .eq("id", user.id);

  if (error) console.error("Error setting online:", error);
}

// Update profile name
export async function updateName(name: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", user.id);

  if (error) console.error("Error updating name:", error);
}

// Update avatar
export async function updateAvatar(avatar: string | null): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ avatar })
    .eq("id", user.id);

  if (error) console.error("Error updating avatar:", error);
}

// New hook: useAppState with Realtime subscriptions
export function useAppState(): AppState;
export function useAppState<T>(selector: (s: AppState) => T): T;
export function useAppState<T = AppState>(selector?: (s: AppState) => T): T | AppState {
  const [state, setState] = useState<T | AppState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const subscriptionsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    // Get current auth user
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };

    getUser();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      data?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const initState = async () => {
      const [runners, request, orders, demand, customItems, wallet, profile] = await Promise.all(
        [
          fetchRunners(),
          fetchCurrentRequest(userId),
          fetchOrders(userId),
          fetchDemand(),
          fetchCustomItems(),
          fetchWallet(userId),
          fetchProfile(userId),
        ]
      );

      const initialState: AppState = {
        runners,
        request,
        orders,
        demand,
        customItems,
        wallet,
        buyer: { lat: profile.lat, lng: profile.lng, located: profile.located },
        me: { id: profile.id, name: profile.name, avatar: profile.avatar, online: profile.online },
        userId,
      };

      if (selector) {
        setState(selector(initialState));
      } else {
        setState(initialState);
      }
    };

    initState();

    // A location update originates outside this hook. Refresh immediately rather
    // than waiting for a Supabase Realtime event, which may not be enabled for
    // the profiles table in every deployment.
    window.addEventListener(LOCATION_UPDATED_EVENT, initState);

    // Subscribe to runners (stock changes)
    const runnerSub = supabase
      .channel("public:profiles")
      .on("postgres_changes", { event: "*" as any, schema: "public", table: "profiles" }, () => {
        initState();
      })
      .subscribe();

    // Subscribe to orders
    const orderSub = supabase
      .channel("public:orders")
      .on("postgres_changes", { event: "*" as any, schema: "public", table: "orders" }, () => {
        initState();
      })
      .subscribe();

    // Subscribe to current user's wallet
    const walletSub = supabase
      .channel("public:wallets")
      .on("postgres_changes", { event: "UPDATE" as any, schema: "public", table: "wallets" }, () => {
        initState();
      })
      .subscribe();

    subscriptionsRef.current = [
      () => supabase.removeChannel(runnerSub),
      () => supabase.removeChannel(orderSub),
      () => supabase.removeChannel(walletSub),
    ];

    return () => {
      window.removeEventListener(LOCATION_UPDATED_EVENT, initState);
      subscriptionsRef.current.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (state === null) {
    return selector
      ? selector({
          runners: [],
          request: null,
          orders: [],
          demand: [],
          customItems: [],
          wallet: { balance: 0, pin: "" },
          buyer: { lat: BUYER_POSITION.lat, lng: BUYER_POSITION.lng, located: false },
          me: { id: "", name: "", avatar: null, online: false },
          userId: null,
        })
      : {
          runners: [],
          request: null,
          orders: [],
          demand: [],
          customItems: [],
          wallet: { balance: 0, pin: "" },
          buyer: { lat: BUYER_POSITION.lat, lng: BUYER_POSITION.lng, located: false },
          me: { id: "", name: "", avatar: null, online: false },
          userId: null,
        };
  }

  return state;
}
