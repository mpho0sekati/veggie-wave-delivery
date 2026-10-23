import { useEffect, useRef, useState } from "react";
import {
  BUYER_POSITION,
  SEED_RUNNERS,
  catalogWith,
  iconKeyFromName,
  type CustomItem,
  type Runner,
  type StockLine,
} from "./veggie-data";

export type WaveStatus =
  "waving" | "accepted" | "delivering" | "delivered" | "paid" | "cancelled" | "failed" | "refunded";
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
  /** Persisted backend ids, so the wave survives a refresh and reaches other phones. */
  waveId?: string;
  orderId?: string;
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
  wallet: { balance: number; pin_hash: string; stokvel_credit: number };
  buyer: { lat: number; lng: number; located: boolean };
  me: { id: string; name: string; avatar: string | null; online: boolean };
  userId: string | null;
};

const KEY = "veggieguy-state-v2";
const EVENT = "veggieguy-state";
const MAX_DEMAND = 50;

function initialState(): AppState {
  return {
    runners: [],
    request: null,
    orders: [],
    demand: [],
    customItems: [],
    wallet: { balance: 5, pin_hash: "1234", stokvel_credit: 0 },
    buyer: { ...BUYER_POSITION, located: false },
    me: { id: "me", name: "", avatar: null, online: false },
    userId: null,
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

/** Update the buyer's location without changing any trader's independent position. */
export function setBuyerLocation(pos: { lat: number; lng: number }) {
  updateState((prev) => ({
    ...prev,
    buyer: { lat: pos.lat, lng: pos.lng, located: true },
  }));
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
    const trimmed = demand.sort((a, b) => b.lastAt - a.lastAt).slice(0, MAX_DEMAND);
    return { ...prev, demand: trimmed };
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

// Business model constants
export const COMMUNITY_CREDIT_PER_ORDER = 0.5; // Buyer earns R0.50 Mdeko Community Credit per MoMo pay
export const PLATFORM_FEE = 0.3; // Veggie Wave keeps R0.30
export const MTN_FEE = 0.2; // MTN takes R0.20
export const TOTAL_FEE = PLATFORM_FEE + MTN_FEE; // R0.50 total fee

function settle(prev: AppState, paidWith: PaidWith): AppState {
  if (!prev.request || prev.request.status !== "delivered") return prev;
  const paid: WaveRequest = { ...prev.request, status: "paid", paidWith };
  return {
    ...prev,
    request: paid,
    runners: prev.runners.map((r) =>
      r.id === paid.runnerId ? { ...r, earnings: r.earnings + paid.total } : r,
    ),
    wallet:
      paidWith === "wave-pay"
        ? {
            ...prev.wallet,
            balance: prev.wallet.balance - paid.total,
            // R0.50 Mdeko Community Credit for every MoMo payment — loyalty reward
            stokvel_credit:
              Math.round((prev.wallet.stokvel_credit + COMMUNITY_CREDIT_PER_ORDER) * 100) / 100,
          }
        : prev.wallet,
  };
}

export type PayResult = "ok" | "wrong-pin" | "insufficient" | "no-request";

/** Demo money only — moves Rands from the buyer's Wave Pay balance to the trader. */
export function payWithWavePay(pin_hash: string): PayResult {
  if (typeof window === "undefined") return "no-request";
  const state = read();
  if (!state.request) return "no-request";
  if (pin_hash !== state.wallet.pin_hash) return "wrong-pin";
  if (state.wallet.balance < state.request.total) return "insufficient";
  write(settle(state, "wave-pay"));
  return "ok";
}

export function payCash() {
  updateState((prev) => settle(prev, "cash"));
}

/** Cancel an active or waving request. */
export function cancelRequest(reason = "Cancelled by user") {
  updateState((prev) => {
    if (!prev.request) return prev;
    const cancelledReq: WaveRequest = {
      ...prev.request,
      status: "cancelled",
      note: reason,
    };
    return {
      ...prev,
      request: null,
      orders: [cancelledReq, ...prev.orders].slice(0, 15),
    };
  });
}

/** Mark request as failed (e.g., trader unavailable / unreachable). */
export function failRequest(reason = "Delivery failed") {
  updateState((prev) => {
    if (!prev.request) return prev;
    const failedReq: WaveRequest = {
      ...prev.request,
      status: "failed",
      note: reason,
    };
    return {
      ...prev,
      request: null,
      orders: [failedReq, ...prev.orders].slice(0, 15),
    };
  });
}

/** Refund a completed/paid order back to buyer's Wave Pay balance if paid with Wave Pay. */
export function refundOrder(orderId: string) {
  updateState((prev) => {
    const targetOrder =
      prev.request?.id === orderId ? prev.request : prev.orders.find((o) => o.id === orderId);
    if (!targetOrder || targetOrder.status !== "paid" || targetOrder.paidWith === undefined) {
      return prev;
    }

    const wasWavePay = targetOrder.paidWith === "wave-pay";
    const refundAmount = wasWavePay ? targetOrder.total : 0;

    const refundedReq: WaveRequest = {
      ...targetOrder,
      status: "refunded",
    };

    const nextOrders = prev.orders.map((o) => (o.id === orderId ? refundedReq : o));

    return {
      ...prev,
      request: prev.request?.id === orderId ? null : prev.request,
      orders:
        prev.request?.id === orderId ? [refundedReq, ...prev.orders].slice(0, 15) : nextOrders,
      wallet: {
        ...prev.wallet,
        balance: prev.wallet.balance + refundAmount,
        stokvel_credit: wasWavePay
          ? Math.max(
              0,
              Math.round((prev.wallet.stokvel_credit - COMMUNITY_CREDIT_PER_ORDER) * 100) / 100,
            )
          : prev.wallet.stokvel_credit,
      },
      runners: prev.runners.map((r) =>
        r.id === targetOrder.runnerId
          ? { ...r, earnings: Math.max(0, r.earnings - targetOrder.total) }
          : r,
      ),
    };
  });
}

/** Close the current order and keep it in history. */
export function archiveRequest() {
  updateState((prev) => ({
    ...prev,
    request: null,
    orders: prev.request ? [prev.request, ...prev.orders].slice(0, 15) : prev.orders,
  }));
}

export function useAppState(): AppState;
export function useAppState<T>(selector: (s: AppState) => T): T;
export function useAppState<T = AppState>(selector?: (s: AppState) => T): T | AppState {
  const [state, setState] = useState<T | AppState>(() =>
    selector ? selector(initialState()) : initialState(),
  );

  // Track the last selected value to avoid unnecessary re-renders when a
  // selector is provided.
  const lastRef = useRef<T | AppState>(state);

  useEffect(() => {
    const sync = () => {
      if (selector) {
        const next = selector(read());
        if (!Object.is(next, lastRef.current)) {
          lastRef.current = next;
          setState(next);
        }
      } else {
        const next = read();
        lastRef.current = next;
        setState(next);
      }
    };
    // Ensure we pick up any state written between the initial render and now.
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
    // selector is intentionally omitted from deps — it is treated as stable
    // (callers should memoize or pass an inline arrow that is referentially
    // stable, e.g. module-level or useCallback).  This matches the common
    // zustand / useSyncExternalStore pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
