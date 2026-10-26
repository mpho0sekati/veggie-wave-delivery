import { afterEach, describe, expect, it, vi } from "vitest";
import { watchPreviewConnection, watchStaleServerFunctions } from "./preview-recovery";

function connectionFixture() {
  const listeners = new Map<string, Set<() => void>>();
  const connection = {
    on(event: string, listener: () => void) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    },
    off(event: string, listener: () => void) {
      listeners.get(event)?.delete(listener);
    },
  };
  return {
    connection,
    emit: (event: string) => listeners.get(event)?.forEach((listener) => listener()),
  };
}

describe("preview reconnect recovery", () => {
  it("does not reload on the initial connection", () => {
    const { connection, emit } = connectionFixture();
    const reload = vi.fn();
    watchPreviewConnection(connection, reload);
    emit("vite:ws:connect");
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once after a disconnect to discard stale RPC references", () => {
    const { connection, emit } = connectionFixture();
    const reload = vi.fn();
    watchPreviewConnection(connection, reload);
    emit("vite:ws:disconnect");
    expect(reload).not.toHaveBeenCalled();
    emit("vite:ws:connect");
    emit("vite:ws:connect");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("removes listeners on cleanup", () => {
    const { connection, emit } = connectionFixture();
    const reload = vi.fn();
    const dispose = watchPreviewConnection(connection, reload);
    dispose();
    emit("vite:ws:disconnect");
    emit("vite:ws:connect");
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("stale server function reloads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function storageStub() {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
    };
  }

  function stubFetch(status: number) {
    vi.stubGlobal("window", {
      fetch: vi.fn(async () => new Response("Invalid server function ID", { status })),
    });
  }

  it("reloads a second time when the first reload did not clear the failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const reload = vi.fn();
    stubFetch(500);
    watchStaleServerFunctions(reload, storageStub());

    await window.fetch("/_serverFn/abc", { method: "POST" });
    expect(reload).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    await window.fetch("/_serverFn/abc", { method: "POST" });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("stops reloading once a failure proves it is not a stale call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const reload = vi.fn();
    stubFetch(500);
    watchStaleServerFunctions(reload, storageStub());

    for (let i = 0; i < 6; i++) {
      await window.fetch("/_serverFn/abc", { method: "POST" });
      vi.advanceTimersByTime(60_000);
    }
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("leaves a healthy server function call alone", async () => {
    const reload = vi.fn();
    stubFetch(200);
    watchStaleServerFunctions(reload, storageStub());

    await window.fetch("/_serverFn/abc", { method: "POST" });
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps the screen for business and temporary server failures", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", {
      fetch: vi.fn(async () => new Response("insufficient-stock", { status: 500 })),
    });
    watchStaleServerFunctions(reload, storageStub());
    await window.fetch("/_serverFn/abc", { method: "POST" });
    expect(reload).not.toHaveBeenCalled();
  });

  it("hooks the fetch the server-function client resolves on every call", async () => {
    const reload = vi.fn();
    const serverFns: { fetch?: typeof fetch } = {};
    vi.stubGlobal("window", {
      fetch: vi.fn(async () => new Response("Invalid server function ID", { status: 500 })),
      __TSS_START_OPTIONS__: { serverFns },
    });
    const stop = watchStaleServerFunctions(reload, storageStub());

    await serverFns.fetch?.("/_serverFn/abc", { method: "POST" });
    expect(reload).toHaveBeenCalledTimes(1);

    stop();
    expect(serverFns.fetch).toBeUndefined();
  });
});
