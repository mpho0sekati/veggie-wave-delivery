type PreviewConnection = {
  on(event: "vite:ws:connect" | "vite:ws:disconnect", listener: () => void): void;
  off(event: "vite:ws:connect" | "vite:ws:disconnect", listener: () => void): void;
};

/** A restarted preview can invalidate RPC IDs still held by an open page. */
export function watchPreviewConnection(connection: PreviewConnection, reload: () => void) {
  let disconnected = false;
  const onDisconnect = () => {
    disconnected = true;
  };
  const onConnect = () => {
    if (!disconnected) return;
    disconnected = false;
    reload();
  };
  connection.on("vite:ws:disconnect", onDisconnect);
  connection.on("vite:ws:connect", onConnect);
  return () => {
    connection.off("vite:ws:disconnect", onDisconnect);
    connection.off("vite:ws:connect", onConnect);
  };
}
/**
 * Backup for missed reconnect events: when a preview server-function call fails
 * because its ID is stale, reload — but at most twice, because if one reload did
 * not fix it the failure has another cause and reloading again only blanks the
 * screen over and over.
 */
const MAX_RELOADS = 2;

function readAttempt(raw: string | null) {
  try {
    const parsed = JSON.parse(raw ?? "") as { n?: number; t?: number };
    return { count: Number(parsed.n) || 0, at: Number(parsed.t) || 0 };
  } catch {
    return { count: 0, at: 0 };
  }
}

export function watchStaleServerFunctions(
  reload: () => void,
  storage: Pick<Storage, "getItem" | "setItem"> = window.sessionStorage,
) {
  const original = window.fetch;
  const key = "mdeko-stale-fn-reload";
  window.fetch = async (...args) => {
    const response = await original(...args);
    const url =
      typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
    if (response.status >= 500 && url.includes("/_serverFn/")) {
      // During a preview restart the server may answer stale calls with a bare 500
      // (no "Invalid server function ID" text), so any 5xx triggers a guarded reload.
      const attempt = readAttempt(storage.getItem(key));
      if (attempt.count < MAX_RELOADS && Date.now() - attempt.at > 30_000) {
        storage.setItem(key, JSON.stringify({ n: attempt.count + 1, t: Date.now() }));
        reload();
      }
    }
    return response;
  };
  return () => {
    if (window.fetch !== original) window.fetch = original;
  };
}
