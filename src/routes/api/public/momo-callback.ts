import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook callback from MTN MoMo when a payment status changes.
 * We re-verify with MoMo directly (never trust the callback body) and only then
 * finalize the payment in our database.
 */
// MTN sends status callbacks as PUT or POST; both go through the same verified path.
async function handleCallback({ request }: { request: Request }): Promise<Response> {
        try {
          const raw = await request.text();
          if (raw.length > 4096)
            return Response.json({ error: "payload-too-large" }, { status: 413 });
          const body = JSON.parse(raw) as {
            referenceId?: string;
            externalId?: string;
            status?: string;
          };

          const reference = body.referenceId ?? body.externalId;
          if (
            typeof reference !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)
          ) {
            return Response.json({ error: "missing-reference" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: payment, error: lookupErr } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("reference", reference)
            .maybeSingle();

          if (lookupErr) {
            console.error("momo-callback: lookup error", lookupErr);
            return Response.json({ error: "lookup-failed" }, { status: 500 });
          }
          if (!payment) {
            return Response.json({ error: "payment-not-found" }, { status: 404 });
          }
          if (payment.status !== "pending") return Response.json({ ok: true });

          const { fetchPaymentStatus } = await import("@/lib/momo.server");
          let momoStatus;
          try {
            momoStatus = await fetchPaymentStatus(reference);
          } catch (err) {
            console.error("momo-callback: failed to verify with MoMo", err);
            return Response.json({ error: "verification-failed" }, { status: 502 });
          }

          const finalizeStatus =
            momoStatus.status === "SUCCESSFUL"
              ? "successful"
              : momoStatus.status === "FAILED"
                ? "failed"
                : "pending";

          const { error: finalizeErr } = await supabaseAdmin.rpc("finalize_payment", {
            _reference: reference,
            _status: finalizeStatus,
            _provider_status: momoStatus.providerStatus,
            _failure: momoStatus.reason as string,
          });

          if (finalizeErr) {
            console.error("momo-callback: finalize error", finalizeErr);
            return Response.json({ error: "finalize-failed" }, { status: 500 });
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("momo-callback: unhandled error", err);
          return Response.json({ error: "internal-error" }, { status: 500 });
        }
}

export const Route = createFileRoute("/api/public/momo-callback")({
  server: {
    handlers: {
      POST: handleCallback,
      PUT: handleCallback,
    },
  },
});
