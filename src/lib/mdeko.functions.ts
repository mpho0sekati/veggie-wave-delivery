// Backend API for the Mdeko flow:
// wave -> accept -> order -> MTN MoMo payment -> delivery -> complete -> settlement.
//
// Every state change goes through a privileged database routine (service_role only),
// so amounts and transitions are decided on the server, never by the frontend.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tables } from "@/integrations/supabase/types";

export type Wave = Tables<"waves">;
export type Order = Tables<"wave_orders">;
export type Payment = Tables<"payments">;
export type Settlement = Tables<"settlements">;

export const ORDER_STATUSES = [
  "created",
  "accepted",
  "preparing",
  "ready",
  "delivering",
  "delivered",
  "completed",
] as const;

const itemsSchema = z
  .array(z.object({ id: z.string().min(1).max(80), qty: z.number().int().min(1).max(99) }))
  .max(30);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------------- WAVES ------------------------------- */

export const createWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        items: itemsSchema,
        wish: z.string().max(200).default(""),
        note: z.string().max(200).default(""),
        lat: z.number().min(-90).max(90).nullable().default(null),
        lng: z.number().min(-180).max(180).nullable().default(null),
      })
      .refine((v) => v.items.length > 0 || v.wish.trim().length > 0, "empty-wave")
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<Wave> => {
    const db = await admin();
    const { data: wave, error } = await db.rpc("create_wave", {
      _buyer: context.userId,
      _items: data.items,
      _wish: data.wish,
      _note: data.note,
      _lat: data.lat as number,
      _lng: data.lng as number,
    });
    if (error) throw new Error(error.message);
    return wave as unknown as Wave;
  });

/** The buyer's own wave that is still open or already accepted. */
export const getMyWave = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Wave | null> => {
    const { data, error } = await context.supabase
      .from("waves")
      .select("*")
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/** Open waves a trader can still accept. */
export const listOpenWaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Wave[]> => {
    const db = await admin();
    await db.rpc("expire_waves");
    const { data, error } = await context.supabase
      .from("waves")
      .select("*")
      .eq("status", "created")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const acceptWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ waveId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Order> => {
    const db = await admin();
    const { data: order, error } = await db.rpc("accept_wave", {
      _wave_id: data.waveId,
      _trader: context.userId,
    });
    if (error) throw new Error(error.message);
    return order as unknown as Order;
  });

export const declineWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ waveId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { error } = await db.rpc("decline_wave", {
      _wave_id: data.waveId,
      _trader: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- ORDERS ------------------------------- */

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Order[]> => {
    const { data, error } = await context.supabase
      .from("wave_orders")
      .select("*")
      .or(`buyer_id.eq.${context.userId},trader_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ order: Order | null; payment: Payment | null }> => {
    const { data: order, error } = await context.supabase
      .from("wave_orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: payment } = await context.supabase
      .from("payments")
      .select("*")
      .eq("order_id", data.orderId)
      .neq("status", "failed")
      .maybeSingle();
    return { order, payment: payment ?? null };
  });

/** Trader: preparing / ready / delivering / delivered. Buyer: completed. */
export const advanceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(["preparing", "ready", "delivering", "delivered", "completed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<Order> => {
    const db = await admin();
    const { data: order, error } = await db.rpc("advance_order", {
      _order_id: data.orderId,
      _actor: context.userId,
      _next: data.status,
    });
    if (error) throw new Error(error.message);
    return order as unknown as Order;
  });

export const rateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(300).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { error } = await db.rpc("rate_order", {
      _order_id: data.orderId,
      _buyer: context.userId,
      _rating: data.rating,
      _comment: data.comment,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ PAYMENTS ------------------------------ */

export type PaymentResult = {
  paymentId: string;
  reference: string;
  amount: number;
  status: Payment["status"];
  providerStatus: string | null;
};

/**
 * Start an MTN MoMo collection for an order. The amount comes from the order row,
 * never from the caller. Re-calling this for the same order returns the existing
 * payment instead of creating a second charge.
 */
export const startMomoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        // South African MSISDN, no leading plus: 27788033288 (or 0788033288)
        msisdn: z
          .string()
          .regex(/^(?:27\d{9}|0\d{9}|\d{9})$/, "Use a South African number, e.g. 0788033288"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PaymentResult> => {
    const db = await admin();
    const reference = crypto.randomUUID();
    const externalId = `mdeko-${data.orderId.slice(0, 8)}-${Date.now()}`;

    const { data: payment, error } = await db.rpc("start_payment", {
      _order_id: data.orderId,
      _buyer: context.userId,
      _reference: reference,
      _external_id: externalId,
      _msisdn: data.msisdn,
    });
    if (error) throw new Error(error.message);
    const row = payment as unknown as Payment;

    // Existing payment for this order: nothing new to charge.
    if (row.reference !== reference) {
      return {
        paymentId: row.id,
        reference: row.reference,
        amount: Number(row.amount),
        status: row.status,
        providerStatus: row.provider_status,
      };
    }

    const { requestToPay } = await import("./momo.server");
    const outcome = await requestToPay({
      reference: row.reference,
      externalId,
      amount: Number(row.amount),
      msisdn: data.msisdn,
      message: "Mdeko veggies order",
    });

    if (!outcome.accepted) {
      const { data: failed } = await db.rpc("finalize_payment", {
        _reference: row.reference,
        _status: "failed",
        _provider_status: outcome.providerStatus,
        _failure: "provider-rejected-request",
      });
      const failedRow = failed as unknown as Payment;
      return {
        paymentId: failedRow.id,
        reference: failedRow.reference,
        amount: Number(failedRow.amount),
        status: failedRow.status,
        providerStatus: failedRow.provider_status,
      };
    }

    return {
      paymentId: row.id,
      reference: row.reference,
      amount: Number(row.amount),
      status: row.status,
      providerStatus: outcome.providerStatus,
    };
  });

/**
 * Ask MoMo what actually happened and record it. This is the only way a payment
 * becomes successful; it is safe to poll and safe to call twice.
 */
export const verifyMomoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PaymentResult | null> => {
    const { data: existing, error } = await context.supabase
      .from("payments")
      .select("*")
      .eq("order_id", data.orderId)
      .neq("status", "failed")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) return null;

    if (existing.status === "successful") {
      return {
        paymentId: existing.id,
        reference: existing.reference,
        amount: Number(existing.amount),
        status: existing.status,
        providerStatus: existing.provider_status,
      };
    }

    const { fetchPaymentStatus } = await import("./momo.server");
    const result = await fetchPaymentStatus(existing.reference);

    const db = await admin();
    const { data: updated, error: finalizeError } = await db.rpc("finalize_payment", {
      _reference: existing.reference,
      _status:
        result.status === "SUCCESSFUL"
          ? "successful"
          : result.status === "FAILED"
            ? "failed"
            : "pending",
      _provider_status: result.providerStatus,
      _failure: result.reason as string,
    });
    if (finalizeError) throw new Error(finalizeError.message);
    const row = updated as unknown as Payment;
    return {
      paymentId: row.id,
      reference: row.reference,
      amount: Number(row.amount),
      status: row.status,
      providerStatus: row.provider_status,
    };
  });

/* ---------------------------- SETTLEMENTS ---------------------------- */

export const listMySettlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Settlement[]> => {
    const { data, error } = await context.supabase
      .from("settlements")
      .select("*")
      .eq("trader_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
