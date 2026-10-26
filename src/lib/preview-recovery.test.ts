import { describe, expect, it, vi } from "vitest";
import { watchPreviewConnection } from "./preview-recovery";

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

function fetchStub(status: number) {
  const fetch = vi.fn(async () => new Response("{}", { status }));
  vi.stubGlobal("window", { fetch });
  return fetch;
}

describe("rejected session recovery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hands a rejected server call to the caller exactly once", async () => {
    fetchStub(401);
    const onReject = vi.fn();
    watchRejectedSession(onReject);
    await window.fetch("/_serverFn/abc", { method: "POST" });
    await window.fetch("/_serverFn/abc", { method: "POST" });
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("leaves a working session alone", async () => {
    fetchStub(200);
    const onReject = vi.fn();
    watchRejectedSession(onReject);
    await window.fetch("/_serverFn/abc", { method: "POST" });
    expect(onReject).not.toHaveBeenCalled();
  });

  it("ignores a 401 that is not a server call", async () => {
    fetchStub(401);
    const onReject = vi.fn();
    watchRejectedSession(onReject);
    await window.fetch("/api/other", { method: "POST" });
    expect(onReject).not.toHaveBeenCalled();
  });

  it("puts the original fetch back on cleanup", async () => {
    const fetch = fetchStub(200);
    const dispose = watchRejectedSession(vi.fn());
    dispose();
    expect(window.fetch).toBe(fetch);
  });
});
