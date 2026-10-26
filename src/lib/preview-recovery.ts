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
 * because its ID is stale, reload once (guarded so it can never loop).
 */
export function watchStaleServerFunctions(
  reload: () => void,
  storage: Pick<Storage, "getItem" | "setItem"> = window.sessionStorage,
) {
  const original = window.fetch;
  const key = "mdeko-stale-fn-reload";
  window.fetch = async (...args) => {
    const response = await original(...args);
    const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
    if (response.status >= 500 && url.includes("/_serverFn/")) {
      // During a preview restart the server may answer stale calls with a bare 500
      // (no "Invalid server function ID" text), so any 5xx triggers one guarded reload.
      const last = Number(storage.getItem(key) ?? 0);
      if (Date.now() - last > 30_000) {
        storage.setItem(key, String(Date.now()));
        reload();
      }
    }
    return response;
  };
  return () => {
    if (window.fetch !== original) window.fetch = original;
  };
}

/**
 * A session the server no longer accepts must not keep polling. Auth rejects a
 * dead token with 401, so one 401 from any server call means the browser is
 * holding a session that can never succeed: hand it to the caller exactly once
 * so it can sign out instead of hammering the failing endpoint forever.
 */
export function watchRejectedSession(onReject: () => void) {
  const original = window.fetch;
  let handled = false;
  window.fetch = async (...args) => {
    const response = await original(...args);
    if (!handled && response.status === 401) {
      const url =
        typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (url?.includes("/_serverFn/")) {
        handled = true;
        onReject();
      }
    }
    return response;
  };
  return () => {
    if (window.fetch !== original) window.fetch = original;
  };
}
