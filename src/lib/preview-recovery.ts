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

type StartOptionsWindow = Window & {
  __TSS_START_OPTIONS__?: { serverFns?: { fetch?: typeof fetch } };
};

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function watchStaleServerFunctions(
  reload: () => void,
  storage: Pick<Storage, "getItem" | "setItem"> = window.sessionStorage,
) {
  const key = "mdeko-stale-fn-reload";
  const stops: Array<() => void> = [];
  const guard = async (url: string, response: Response) => {
    if (response.status < 500 || !url.includes("/_serverFn/")) return;
    // A rejected sign-in (e.g. the account was removed) comes back as a 500 that
    // says "Unauthorized". Reloading can never fix it; the app signs out instead.
    const text = await response.clone().text().catch(() => "");
    if (/Unauthorized/i.test(text)) return;
    // During a preview restart the server may answer stale calls with a bare 500
    // (no "Invalid server function ID" text), so any 5xx triggers a guarded reload.
    const attempt = readAttempt(storage.getItem(key));
    if (attempt.count < MAX_RELOADS && Date.now() - attempt.at > 30_000) {
      storage.setItem(key, JSON.stringify({ n: attempt.count + 1, t: Date.now() }));
      reload();
    }
  };

  // Server-function calls resolve their fetch from the start options on every
  // call, so hooking it there sees them even when a plain window.fetch wrapper
  // misses the traffic.
  const startWindow = window as StartOptionsWindow;
  const options = startWindow.__TSS_START_OPTIONS__;
  if (options?.serverFns) {
    const original = options.serverFns.fetch;
    const wrapped: typeof fetch = async (input, init) => {
      const response = await (original ?? window.fetch)(input, init);
      await guard(requestUrl(input), response);
      return response;
    };
    options.serverFns.fetch = wrapped;
    stops.push(() => {
      if (!options.serverFns) return;
      if (original) options.serverFns.fetch = original;
      else delete options.serverFns.fetch;
    });
  }

  // Fallback for paths that resolve fetch globally at call time.
  const globalOriginal = window.fetch;
  const globalWrapped: typeof fetch = async (input, init) => {
    const response = await globalOriginal(input, init);
    await guard(requestUrl(input), response);
    return response;
  };
  window.fetch = globalWrapped;
  stops.push(() => {
    if (window.fetch === globalWrapped) window.fetch = globalOriginal;
  });

  return () => stops.forEach((stop) => stop());
}
