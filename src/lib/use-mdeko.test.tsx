import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useMdekoActions } from "./use-mdeko";

const mocks = vi.hoisted(() => ({ invalidate: vi.fn(), verify: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useMutation: (options: unknown) => options,
}));
vi.mock("./mdeko.functions", () => ({
  acceptWave: vi.fn(),
  chooseCash: vi.fn(),
  confirmCash: vi.fn(),
  cancelWave: vi.fn(),
  advanceOrder: vi.fn(),
  createWave: vi.fn(),
  getMyWave: vi.fn(),
  listMyOrders: vi.fn(),
  listMySettlements: vi.fn(),
  listOpenWaves: vi.fn(),
  startMomoPayment: vi.fn(),
  verifyMomoPayment: mocks.verify,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("verified payment refresh", () => {
  it("refreshes My Money after a verified successful payment", async () => {
    mocks.verify.mockResolvedValue({ status: "successful" });
    const { result } = renderHook(() => useMdekoActions());
    await result.current.verifyPayment("order");
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["finance"] });
  });
  it("does not refresh money as paid for a pending request", async () => {
    mocks.verify.mockResolvedValue({ status: "pending" });
    const { result } = renderHook(() => useMdekoActions());
    await result.current.verifyPayment("order");
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
