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
