import { createServerFn } from "@tanstack/react-start";

const DEMO_EMAILS = {
  buyer: "demo.buyer@mdeko.app",
  trader: "demo.trader@mdeko.app",
} as const;
const DEMO_PASSWORD = "mdeko-demo-1234";

// Existing demo accounts only; public requests must never enumerate or mutate users.
export const ensureDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { role: "buyer" | "trader" }) => {
    if (input?.role !== "buyer" && input?.role !== "trader") throw new Error("Invalid role");
    return input;
  })
  .handler(async () => {
    return { ok: true };
  });
