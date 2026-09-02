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
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║        MTN MoMo — REQUEST TO PAY         ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`  📱 Payer MSISDN : ${data.msisdn}`);
    console.log(`  💰 Amount       : R${data.amount.toFixed(2)} ZAR`);
    console.log(`  🔑 Reference    : ${data.reference}`);
    console.log(`  🏷️  External ID  : ${data.externalId}`);
    console.log("  ⏳ Sending request to MTN MoMo API...");

    const { requestToPay } = await import("./momo.server");
    const result = await requestToPay({
      reference: data.reference,
      externalId: data.externalId,
      amount: data.amount,
      msisdn: data.msisdn,
      message: "Mdeko veggies order",
    });

    if (result.accepted) {
      console.log("  ✅ MTN MoMo accepted the request (HTTP 202)");
      console.log("  📲 Push notification sent to buyer's phone!");
    } else {
      console.log(`  ❌ MTN MoMo rejected: ${result.providerStatus}`);
    }
    console.log("══════════════════════════════════════════\n");

    return { accepted: result.accepted, reference: data.reference };
  });

export const momoCheckStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ reference: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason: string | null }> => {
    const { fetchPaymentStatus } = await import("./momo.server");
    const result = await fetchPaymentStatus(data.reference);

    const icon =
      result.status === "SUCCESSFUL" ? "✅" :
      result.status === "FAILED"     ? "❌" : "⏳";

    console.log(`  ${icon} MoMo status check → ${result.status}${result.reason ? ` (${result.reason})` : ""}`);

    if (result.status === "SUCCESSFUL") {
      console.log("╔══════════════════════════════════════════╗");
      console.log("║   💚 PAYMENT CONFIRMED — MONEY RECEIVED  ║");
      console.log("╚══════════════════════════════════════════╝\n");
    }

    return { status: result.status, reason: result.reason };
  });
