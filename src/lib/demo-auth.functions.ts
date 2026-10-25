import { createServerFn } from "@tanstack/react-start";

// Existing demo accounts only; public requests must never enumerate or mutate users.
export const ensureDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { role: "buyer" | "trader" }) => {
    if (input?.role !== "buyer" && input?.role !== "trader") throw new Error("Invalid role");
    return input;
  })
  .handler(async () => {
    return { ok: true };
  });
