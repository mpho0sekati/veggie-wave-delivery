import { useEffect, useState } from "react";
import { BUYER_POSITION, SEED_RUNNERS, type Runner } from "./veggie-data";

export type WaveStatus = "waving" | "accepted" | "delivered" | "paid";

export type WaveRequest = {
  id: string;
  items: { id: string; qty: number }[];
  total: number;
  note: string;
  status: WaveStatus;
  runnerId: string | null;
  createdAt: number;
};

export type AppState = {
  runners: Runner[];
  request: WaveRequest | null;
  buyer: { lat: number; lng: number; located: boolean };
  me: { id: string; name: string; avatar: string | null; online: boolean };
};

const KEY = "veggieguy-state-v1";
const EVENT = "veggieguy-state";

function initialState(): AppState {
  return {
    runners: SEED_RUNNERS,
    request: null,
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
