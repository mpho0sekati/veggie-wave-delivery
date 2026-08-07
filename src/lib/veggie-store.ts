import { useEffect, useState } from "react";
import { SEED_RUNNERS, type Runner } from "./veggie-data";

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
  me: { id: string; name: string; avatar: string | null; online: boolean };
};

const KEY = "veggieguy-state-v1";
const EVENT = "veggieguy-state";

function initialState(): AppState {
  return {
    runners: SEED_RUNNERS,
    request: null,
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
