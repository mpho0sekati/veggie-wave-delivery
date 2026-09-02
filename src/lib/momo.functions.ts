// Standalone MoMo server functions — no Supabase auth required.
// Used by the localStorage-based MVP demo flow.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const momoRequestToPay = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      msisdn: z.string().min(9),
      amount: z.number().positive(),
      reference: z.string().uuid(),
      externalId: z.string(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ accepted: boolean; reference: string }> => {
    const { requestToPay } = await import("./momo.server");
    const result = await requestToPay({
      reference: data.reference,
      externalId: data.externalId,
      amount: data.amount,
      msisdn: data.msisdn,
      message: "Mdeko veggies order",
    });
    return { accepted: result.accepted, reference: data.reference };
  });

export const momoCheckStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ reference: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason: string | null }> => {
    const { fetchPaymentStatus } = await import("./momo.server");
    const result = await fetchPaymentStatus(data.reference);
    return { status: result.status, reason: result.reason };
  });
