import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StockEditor from "./StockEditor";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/use-marketplace", () => ({ saveTraderStock: mocks.save }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("stock saving", () => {
  it("retains a new seller price when quantity is changed before refresh", async () => {
    mocks.save.mockResolvedValue(undefined);
    render(
      <StockEditor
        runnerId="seller"
        stock={[{ itemId: "carrots", price: 22, quantity: 2, available: true }]}
        customItems={[]}
      />,
    );
    const price = screen.getByLabelText("Your price for Carrots");
    fireEvent.change(price, { target: { value: "31.75" } });
    fireEvent.blur(price);
    const quantity = screen.getByLabelText("Quantity for Carrots");
    fireEvent.change(quantity, { target: { value: "6" } });
    fireEvent.blur(quantity);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save).toHaveBeenLastCalledWith("seller", "carrots", 31.75, true, 6);
  });
  it("keeps sold-out stock editable instead of losing the saved price", () => {
    render(
      <StockEditor
        runnerId="seller"
        stock={[{ itemId: "carrots", price: 31.75, quantity: 0, available: true }]}
        customItems={[]}
      />,
    );
    expect(screen.getByLabelText("Your price for Carrots")).toHaveValue("31.75");
    expect(screen.getByLabelText("Quantity for Carrots")).toHaveValue(0);
  });
});
