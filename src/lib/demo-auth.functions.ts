import { createServerFn } from "@tanstack/react-start";

const DEMO_EMAILS = {
  buyer: "demo.buyer@mdeko.app",
  trader: "demo.trader@mdeko.app",
} as const;
const DEMO_PASSWORD = "mdeko-demo-1234";

// Public by design: only ever touches the two fixed demo accounts.
export const ensureDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { role: "buyer" | "trader" }) => {
    if (input?.role !== "buyer" && input?.role !== "trader") throw new Error("Invalid role");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = DEMO_EMAILS[data.role];
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error("Demo setup unavailable");
    const existing = list.users.find((u) => u.email === email);
    if (existing) {
      if (!existing.email_confirmed_at) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          email_confirm: true,
          password: DEMO_PASSWORD,
        });
      }
    } else {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (createError) throw new Error("Demo setup unavailable");
    }
    return { ok: true };
  });
