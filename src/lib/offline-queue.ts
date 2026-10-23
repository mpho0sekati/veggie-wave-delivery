/**
 * Offline Order Queue
 * Stores orders placed offline and syncs when connection returns.
 * Critical for delivery zones with spotty connectivity.
 */

export type QueuedOrder = {
  id: string;
  items: { id: string; qty: number }[];
  wish: string;
  lat: number | null;
  lng: number | null;
  note: string;
  /** Estimated total at queue time, so the wave card can show a price before the server answers. */
  total?: number;
  createdAt: number;
  retries: number;
  status: "pending" | "syncing" | "synced" | "failed";
};

const QUEUE_KEY = "veggie-offline-queue";
const MAX_RETRIES = 3;

function getQueue(): QueuedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(orders: QueuedOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent("offline-queue-updated", { detail: { orders } }));
  } catch {
    console.error("Failed to save offline queue");
  }
}

export function addToOfflineQueue(order: Omit<QueuedOrder, "retries" | "status">) {
  const queue = getQueue();
  const newOrder: QueuedOrder = {
    ...order,
    retries: 0,
    status: "pending",
  };
  queue.push(newOrder);
  saveQueue(queue);
  return newOrder;
}

export function getOfflineQueue() {
  return getQueue();
}

export function markAsSyncing(orderId: string) {
  const queue = getQueue();
  const order = queue.find((o) => o.id === orderId);
  if (order) {
    order.status = "syncing";
    saveQueue(queue);
  }
}

export function markAsSynced(orderId: string) {
  const queue = getQueue();
  const idx = queue.findIndex((o) => o.id === orderId);
  if (idx !== -1) {
    queue.splice(idx, 1);
    saveQueue(queue);
  }
}

export function markAsFailed(orderId: string) {
  const queue = getQueue();
  const order = queue.find((o) => o.id === orderId);
  if (order) {
    order.retries += 1;
    order.status = order.retries >= MAX_RETRIES ? "failed" : "pending";
    saveQueue(queue);
  }
}

export function removeFromQueue(orderId: string) {
  const queue = getQueue();
  const filtered = queue.filter((o) => o.id !== orderId);
  saveQueue(filtered);
}

export function clearFailedOrders() {
  const queue = getQueue();
  const cleaned = queue.filter((o) => o.status !== "failed");
  saveQueue(cleaned);
}
