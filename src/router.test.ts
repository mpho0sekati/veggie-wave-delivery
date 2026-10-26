import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
const toastInfo = vi.fn();

vi.mock("./integrations/supabase/client", () => ({
  supabase: { auth: { signOut: () => signOut() } },
}));
vi.mock("sonner", () => ({ toast: { info: (...args: unknown[]) => toastInfo(...args) } }));
vi.mock("./routeTree.gen", () => ({ routeTree: {} }));

/** The sign-out latch is module state, so each case needs a fresh module. */
async function loadHandler() {
  vi.resetModules();
  const mod = await import("./router");
  return mod.handleQueryError;
}

describe("rejected session handling", () => {
  beforeEach(() => {
    signOut.mockClear();
    toastInfo.mockClear();
  });

  it("signs the browser out and says so when the server rejects the session", async () => {
    const handleQueryError = await loadHandler();
    handleQueryError(new Error("Unauthorized"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith("Your session expired. Please sign in again.");
  });

  it("never signs out twice for the same dead session", async () => {
    const handleQueryError = await loadHandler();
    handleQueryError(new Error("Unauthorized"));
    handleQueryError(new Error("Unauthorized"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("leaves an unrelated failure alone", async () => {
    const handleQueryError = await loadHandler();
    handleQueryError(new Error("Could not load your saved location."));
    expect(signOut).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });
});
