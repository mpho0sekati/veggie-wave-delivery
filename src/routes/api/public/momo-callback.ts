import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook callback from MTN MoMo when a payment status changes.
 * We re-verify with MoMo directly (never trust the callback body) and only then
 * finalize the payment in our database.
 */
export const Route = createFileRoute("/api/public/momo-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            referenceId?: string;
            externalId?: string;
            status?: string;
          };

          const reference = body.referenceId ?? body.externalId;
          if (!reference) {
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

          // Mdeko Finance: auto-save 5% of the settlement into the trader's savings jar
          if (finalizeStatus === "successful" && payment.order_id) {
            try {
              // Look up the settlement to get the net amount and trader_id
              const { data: settlement } = await supabaseAdmin
                .from("settlements")
                .select("net, trader_id")
                .eq("order_id", payment.order_id)
                .maybeSingle();

              if (settlement && settlement.trader_id && Number(settlement.net) > 0) {
                const saveAmount = Number(settlement.net) * 0.05;

                // Upsert the trader's savings jar — increment balance by 5% of net
                const { data: existingJar } = await supabaseAdmin
                  .from("savings_pots")
                  .select("balance")
                  .eq("user_id", settlement.trader_id)
                  .maybeSingle();

                if (existingJar) {
                  await supabaseAdmin
                    .from("savings_pots")
                    .update({
                      balance: Number(existingJar.balance) + saveAmount,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("user_id", settlement.trader_id);
                } else {
                  await supabaseAdmin
                    .from("savings_pots")
                    .insert({
                      user_id: settlement.trader_id,
                      balance: saveAmount,
                      target_amount: 500,
                      name: "My Savings Jar",
                    });
                }

                console.log(
                  `[finance] auto-saved R${saveAmount.toFixed(2)} for trader ${settlement.trader_id}`,
                );
              }
            } catch (saveErr) {
              // Non-fatal — never block the payment webhook for savings errors
              console.error("[finance] auto-save failed (non-fatal):", saveErr);
            }
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("momo-callback: unhandled error", err);
          return Response.json({ error: "internal-error" }, { status: 500 });
        }
      },
    },
  },
});
