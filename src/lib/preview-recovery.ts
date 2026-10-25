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