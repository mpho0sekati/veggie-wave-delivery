import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createWave } from "./mdeko.functions";
import {
  getOfflineQueue,
  markAsFailed,
  markAsSynced,
  markAsSyncing,
  type QueuedOrder,
} from "./offline-queue";
import { useOnline } from "./use-online";

const ATTEMPTS_PER_FLUSH = 3;

function subscribeQueue(callback: () => void) {
  window.addEventListener("offline-queue-updated", callback);
  return () => window.removeEventListener("offline-queue-updated", callback);
}

/** How many veggie requests are saved on this phone waiting for a connection. */
export function useOfflineQueueCount() {
  return useSyncExternalStore(
    subscribeQueue,
    () => getOfflineQueue().length,
    () => 0,
  );
}

/**
 * Sends saved offline waves to the server as soon as the connection returns.
 * Retries each wave with backoff; on success the wave is removed from the
 * queue and handed to onSynced so the page can show it as a live wave.
 */
export function useOfflineSync(
  onSynced: (order: QueuedOrder, waveId: string, createdAt: string) => void,
) {
  const online = useOnline();
  const run = useServerFn(createWave);
  const busy = useRef(false);
  const cb = useRef(onSynced);
  cb.current = onSynced;

  const flush = useCallback(async () => {
    if (busy.current) return;
    const pending = getOfflineQueue().filter((o) => o.status === "pending");
    if (!pending.length) return;

    busy.current = true;
    try {
      for (const order of pending) {
        markAsSyncing(order.id);
        let sent = false;
        for (let attempt = 0; attempt < ATTEMPTS_PER_FLUSH && !sent; attempt++) {
          try {
            const saved = await run({
              data: {
                items: order.items,
                wish: order.wish,
                note: order.note,
                lat: order.lat,
                lng: order.lng,
              },
            });
            markAsSynced(order.id);
            cb.current(order, saved.id, saved.created_at);
            sent = true;
          } catch {
            if (attempt < ATTEMPTS_PER_FLUSH - 1) {
              // Back off: 1s, then 2s, before giving up this round.
              await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt + 1)));
            }
          }
        }
        if (!sent) {
          // Stays "pending" until it has failed a few flushes, then "failed".
          markAsFailed(order.id);
          const stillThere = getOfflineQueue().find((o) => o.id === order.id);
          if (stillThere?.status === "failed") {
            toast.error("A saved request could not be sent — please raise your hand again");
          }
        }
      }
    } finally {
      busy.current = false;
    }
  }, [run]);

  // Flush when the connection returns, and once on load in case the app was
  // reopened with saved requests while already online.
  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);
}
