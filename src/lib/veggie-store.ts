import { useEffect, useState } from "react";
import {
  BUYER_POSITION,
  SEED_RUNNERS,
  catalogWith,
  iconKeyFromName,
  type CustomItem,
  type Runner,
  type StockLine,
} from "./veggie-data";

export type WaveStatus = "waving" | "accepted" | "delivered" | "paid";
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
};

const KEY = "veggieguy-state-v2";
const EVENT = "veggieguy-state";

function initialState(): AppState {
  return {
    runners: SEED_RUNNERS,
    request: null,
    orders: [],
    demand: [],
    customItems: [],
    wallet: { balance: 500, pin: "1234" },
    buyer: { ...BUYER_POSITION, located: false },
    me: { id: "me", name: "", avatar: null, online: false },
  };
}

function read(): AppState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
}

function write(next: AppState) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function updateState(fn: (prev: AppState) => AppState) {
  if (typeof window === "undefined") return;
  write(fn(read()));
}

/** Move the buyer to their real position and bring nearby runners along, keeping relative offsets. */
export function setBuyerLocation(pos: { lat: number; lng: number }) {
  updateState((prev) => {
    const dLat = pos.lat - prev.buyer.lat;
    const dLng = pos.lng - prev.buyer.lng;
    return {
      ...prev,
      buyer: { lat: pos.lat, lng: pos.lng, located: true },
      runners: prev.runners.map((r) => ({ ...r, lat: r.lat + dLat, lng: r.lng + dLng })),
    };
  });
}

export function setStock(runnerId: string, stock: StockLine[]) {
  updateState((prev) => ({
    ...prev,
    runners: prev.runners.map((r) => (r.id === runnerId ? { ...r, stock } : r)),
  }));
}

/** Record what people asked for, and whether anybody nearby could supply it. */
export function logDemand(entries: { itemId: string | null; label: string }[]) {
  if (!entries.length) return;
  updateState((prev) => {
    const online = prev.runners.filter((r) => r.online);
    const demand = [...prev.demand];
    for (const entry of entries) {
      const key = entry.itemId ?? `wish:${entry.label.toLowerCase().trim()}`;
      const stocked = entry.itemId
        ? online.some((r) => r.stock.some((s) => s.itemId === entry.itemId))
        : false;
      const idx = demand.findIndex((d) => d.key === key);
      const bump = {
        key,
        itemId: entry.itemId,
        label: entry.label,
        requests: 1,
        unfilled: stocked ? 0 : 1,
        lastAt: Date.now(),
      };
      const existing = idx === -1 ? null : demand[idx];
      if (!existing) demand.push(bump);
      else
        demand[idx] = {
          ...existing,
          requests: existing.requests + 1,
          unfilled: existing.unfilled + bump.unfilled,
          lastAt: bump.lastAt,
        };

    }
    return { ...prev, demand };
  });
}

/** Turn a repeated free-text request into a tappable catalog item. */
export function promoteToCatalog(demandKey: string, price: number) {
  updateState((prev) => {
    const entry = prev.demand.find((d) => d.key === demandKey);
    if (!entry || entry.itemId) return prev;
    const id = `custom-${entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (prev.customItems.some((c) => c.id === id)) return prev;
    const name = entry.label.charAt(0).toUpperCase() + entry.label.slice(1);
    const item: CustomItem = {
      id,
      name,
      unit: "each",
      price,
      iconKey: iconKeyFromName(entry.label),
    };
    return {
      ...prev,
      customItems: [...prev.customItems, item],
      demand: prev.demand.map((d) => (d.key === demandKey ? { ...d, key: id, itemId: id } : d)),
    };
  });
}

/** Average price other traders charge for an item, or the catalog default. */
export function suggestedPrice(state: AppState, itemId: string): number {
  const prices = state.runners
    .flatMap((r) => r.stock)
    .filter((s) => s.itemId === itemId)
    .map((s) => s.price);
  if (prices.length) return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  return catalogWith(state.customItems).find((c) => c.id === itemId)?.price ?? 20;
}

function settle(prev: AppState, paidWith: PaidWith): AppState {
  if (!prev.request) return prev;
  const paid: WaveRequest = { ...prev.request, status: "paid", paidWith };
  return {
    ...prev,
    request: paid,
    runners: prev.runners.map((r) =>
      r.id === paid.runnerId ? { ...r, earnings: r.earnings + paid.total } : r,
    ),
    wallet:
      paidWith === "wave-pay"
        ? { ...prev.wallet, balance: prev.wallet.balance - paid.total }
        : prev.wallet,
  };
}

export type PayResult = "ok" | "wrong-pin" | "insufficient" | "no-request";

/** Demo money only — moves Rands from the buyer's Wave Pay balance to the trader. */
export function payWithWavePay(pin: string): PayResult {
  if (typeof window === "undefined") return "no-request";
  const state = read();
  if (!state.request) return "no-request";
  if (pin !== state.wallet.pin) return "wrong-pin";
  if (state.wallet.balance < state.request.total) return "insufficient";
  write(settle(state, "wave-pay"));
  return "ok";
}

export function payCash() {
  updateState((prev) => settle(prev, "cash"));
}

/** Close the current order and keep it in history. */
export function archiveRequest() {
  updateState((prev) => ({
    ...prev,
    request: null,
    orders: prev.request ? [prev.request, ...prev.orders].slice(0, 10) : prev.orders,
  }));
}

export function useAppState(): AppState {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return state;
}
