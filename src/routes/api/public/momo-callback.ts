import { createFileRoute } from "@tanstack/react-router";
import type { z } from "zod";

/**
 * Webhook callback from MTN MoMo when a payment status changes.
 * We re-verify with MoMo directly (never trust the callback body) and only then
 * finalize the payment in our database.
 *
 * Flow:
 * 1. MoMo calls this endpoint with { referenceId, status }
 * 2. We look up the payment by reference
 * 3. We call MoMo's status API to confirm
 * 4. Only if confirmed, we call finalize_payment()
 * 5. Return 200 OK so MoMo marks callback as delivered
 */

export const Route = createFileRoute("/api/public/momo-callback")({ handler });

async function handler(req: Request): Promise<Response> {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method-not-allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as {
      referenceId?: string;
      externalId?: string;
      status?: string;
    };

    const reference = body.referenceId ?? body.externalId;
    if (!reference) {
      console.warn("momo-callback: missing reference");
      return new Response(JSON.stringify({ error: "missing-reference" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Lookup payment in our database
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = await supabaseAdmin();

    const { data: payment, error: lookupErr } = await db
      .from("payments")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (lookupErr) {
      console.error("momo-callback: lookup error", lookupErr);
      return new Response(JSON.stringify({ error: "lookup-failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    if (!payment) {
      console.warn(`momo-callback: payment not found for reference ${reference}`);
      return new Response(JSON.stringify({ error: "payment-not-found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // Re-verify status with MoMo (don't trust the callback body)
    const { fetchPaymentStatus } = await import("@/lib/momo.server");
    let momoStatus;
    try {
      momoStatus = await fetchPaymentStatus(reference);
    } catch (err) {
      console.error("momo-callback: failed to verify with MoMo", err);
      // If we can't reach MoMo, don't finalize yet; let the client poll instead
      return new Response(JSON.stringify({ error: "verification-failed" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    // Only finalize if MoMo confirms success
    const finalizeStatus =
      momoStatus.status === "SUCCESSFUL"
        ? "successful"
        : momoStatus.status === "FAILED"
          ? "failed"
          : "pending";

    const { error: finalizeErr } = await db.rpc("finalize_payment", {
      _reference: reference,
      _status: finalizeStatus,
      _provider_status: momoStatus.providerStatus,
      _failure: momoStatus.reason,
    });

    if (finalizeErr) {
      console.error("momo-callback: finalize error", finalizeErr);
      return new Response(JSON.stringify({ error: "finalize-failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    // Always return 200 OK so MoMo considers callback delivered
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("momo-callback: unhandled error", err);
    return new Response(JSON.stringify({ error: "internal-error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
