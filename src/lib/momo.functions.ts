// Deprecated demo endpoints: payments must use an authenticated stored order.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const momoRequestToPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        msisdn: z.string().min(9),
        amount: z.number().positive(),
        reference: z.string().uuid(),
        externalId: z.string(),
      })
      .parse(input),
  )
  .handler(async (): Promise<{ accepted: boolean; reference: string }> => {
    throw new Error("Use the payment attached to your Mdeko order.");
  });

export const momoCheckStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ reference: z.string().uuid() }).parse(input))
  .handler(
    async (): Promise<{ status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason: string | null }> => {
      throw new Error("Use the payment attached to your Mdeko order.");
    },
  );
