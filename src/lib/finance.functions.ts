/**
 * Mdeko Finance â€” server functions
 *
 * getSavingsJar   â€” fetch or auto-create the user's savings pot
 * depositToJar    â€” add money to the savings pot
 * getMoneyProfile â€” one call that returns everything the Finance page needs
 * getSmartTip     â€” AI-generated personal money tip (Intelligence judging criterion)
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SAVINGS JAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type SavingsJar = {
  userId: string;
  balance: number;
  targetAmount: number;
  name: string;
  updatedAt: string;
};

export const getSavingsJar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavingsJar> => {
    const db = await admin();

    // Try to fetch existing row
    const { data: existing } = await context.supabase
      .from("savings_pots")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      return {
        userId: existing.user_id,
        balance: Number(existing.balance),
        targetAmount: Number(existing.target_amount),
        name: existing.name,
        updatedAt: existing.updated_at,
      };
    }

    // Auto-create a default jar for new users (use admin to bypass RLS on insert)
    const { data: created, error } = await db
      .from("savings_pots")
      .insert({
        user_id: context.userId,
        balance: 0,
        target_amount: 500,
        name: "My Savings Jar",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return {
      userId: created.user_id,
      balance: Number(created.balance),
      targetAmount: Number(created.target_amount),
      name: created.name,
      updatedAt: created.updated_at,
    };
  });
export const depositToJar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ amount: z.number().positive("Amount must be positive") }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SavingsJar> => {
    const db = await admin();
    const userId = context.userId;

    // Fetch current balance first so we can increment correctly
    const { data: existing } = await db
      .from("savings_pots")
      .select("balance, target_amount, name")
      .eq("user_id", userId)
      .maybeSingle();

    const currentBalance = existing ? Number(existing.balance) : 0;
    const newBalance = currentBalance + data.amount;

    // Upsert with the correctly incremented balance
    const { data: row, error } = await db
      .from("savings_pots")
      .upsert(
        {
          user_id: userId,
          balance: newBalance,
          target_amount: existing?.target_amount ?? 500,
          name: existing?.name ?? "My Savings Jar",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return {
      userId: row.user_id,
      balance: Number(row.balance),
      targetAmount: Number(row.target_amount),
      name: row.name,
      updatedAt: row.updated_at,
    };
  });

export const updateSavingsTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ targetAmount: z.number().min(10, "Goal must be at least R10") })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SavingsJar> => {
    const db = await admin();
    const { data: row, error } = await db
      .from("savings_pots")
      .upsert(
        {
          user_id: context.userId,
          target_amount: data.targetAmount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return {
      userId: row.user_id,
      balance: Number(row.balance),
      targetAmount: Number(row.target_amount),
      name: row.name,
      updatedAt: row.updated_at,
    };
  });

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MONEY PROFILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type RecentOrder = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  role: "buyer" | "trader";
};

export type MoneyProfile = {
  totalOrders: number;
  totalTraded: number;
  totalCommission: number;
  memberSince: string;
  momoSuccessRate: number;
  hasOrderInLast30Days: boolean;
  savingsJar: SavingsJar;
  recentOrders: RecentOrder[];
  role: "buyer" | "trader" | null;
};

export const getMoneyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MoneyProfile> => {
    const db = await admin();
    const userId = context.userId;

    // Run queries in parallel for speed
    const [
      buyerOrdersResult,
      traderOrdersResult,
      paymentsResult,
      profileResult,
      savingsResult,
    ] = await Promise.all([
      // Buyer: orders where I was the buyer
      context.supabase
        .from("wave_orders")
        .select("id, amount, status, created_at")
        .eq("buyer_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(50),

      // Trader: orders where I was the trader
      context.supabase
        .from("wave_orders")
        .select("id, amount, status, created_at")
        .eq("trader_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(50),

      // Payments: MoMo success rate
      context.supabase
        .from("payments")
        .select("status")
        .eq("buyer_id", userId)
        .limit(50),

      // Profile: member since date
      context.supabase
        .from("profiles")
        .select("created_at, role")
        .eq("id", userId)
        .maybeSingle(),

      // Savings jar
      context.supabase
        .from("savings_pots")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const buyerOrders = buyerOrdersResult.data ?? [];
    const traderOrders = traderOrdersResult.data ?? [];

    // Merge unique orders (user can be both buyer and trader over time)
    const allOrders = [
      ...buyerOrders.map((o) => ({ ...o, role: "buyer" as const })),
      ...traderOrders.map((o) => ({ ...o, role: "trader" as const })),
    ];

    const totalOrders = allOrders.length;
    const totalTraded = allOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    // 5% commission â€” makes the business model visible on screen
    const totalCommission = totalTraded * 0.05;

    // MoMo success rate
    const payments = paymentsResult.data ?? [];
    const totalPayments = payments.length;
    const successfulPayments = payments.filter((p) => p.status === "successful").length;
    const momoSuccessRate = totalPayments > 0 ? successfulPayments / totalPayments : 1;

    // Active in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const hasOrderInLast30Days = allOrders.some((o) => o.created_at > thirtyDaysAgo);

    // Member since
    const memberSince = profileResult.data?.created_at ?? new Date().toISOString();
    const role = (profileResult.data?.role as "buyer" | "trader" | null) ?? null;

    // Recent 5 orders for the money story
    const recentOrders: RecentOrder[] = allOrders.slice(0, 5).map((o) => ({
      id: o.id,
      amount: Number(o.amount),
      status: o.status,
      createdAt: o.created_at,
      role: o.role,
    }));

    // Savings jar â€” auto-create if missing
    let savingsJar: SavingsJar;
    if (savingsResult.data) {
      savingsJar = {
        userId,
        balance: Number(savingsResult.data.balance),
        targetAmount: Number(savingsResult.data.target_amount),
        name: savingsResult.data.name,
        updatedAt: savingsResult.data.updated_at,
      };
    } else {
      // Auto-create jar
      const { data: newJar } = await db
        .from("savings_pots")
        .insert({ user_id: userId, balance: 0, target_amount: 500, name: "My Savings Jar" })
        .select("*")
        .single();

      savingsJar = {
        userId,
        balance: 0,
        targetAmount: 500,
        name: "My Savings Jar",
        updatedAt: newJar?.updated_at ?? new Date().toISOString(),
      };
    }

    return {
      totalOrders,
      totalTraded,
      totalCommission,
      memberSince,
      momoSuccessRate,
      hasOrderInLast30Days,
      savingsJar,
      recentOrders,
      role,
    };
  });

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AI SMART TIP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type SmartTipInput = {
  totalOrders: number;
  totalTraded: number;
  recentOrders: RecentOrder[];
  role: "buyer" | "trader" | null;
  savingsBalance: number;
  savingsTarget: number;
  momoSuccessRate: number;
};

export const getSmartTip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        totalOrders: z.number(),
        totalTraded: z.number(),
        recentOrders: z.array(
          z.object({
            id: z.string(),
            amount: z.number(),
            status: z.string(),
            createdAt: z.string(),
            role: z.enum(["buyer", "trader"]),
          }),
        ),
        role: z.enum(["buyer", "trader"]).nullable(),
        savingsBalance: z.number(),
        savingsTarget: z.number(),
        momoSuccessRate: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<string> => {
    const FALLBACK =
      "Keep trading regularly â€” every order builds your financial history on Mdeko. ðŸ’š";

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return FALLBACK;

    // Build a compact summary (keep tokens low)
    const roleLabel = data.role === "trader" ? "a veggie trader" : "a produce buyer";
    const recentDays = data.recentOrders
      .slice(0, 5)
      .map((o) => {
        const d = new Date(o.createdAt);
        return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} R${o.amount.toFixed(0)}`;
      })
      .join(", ");

    const summary = [
      `Role: ${roleLabel}`,
      `Total completed orders: ${data.totalOrders}`,
      `Total traded: R${data.totalTraded.toFixed(0)}`,
      `Recent orders (day, amount): ${recentDays || "none yet"}`,
      `MoMo payment success rate: ${Math.round(data.momoSuccessRate * 100)}%`,
      `Savings jar: R${data.savingsBalance.toFixed(0)} saved, goal R${data.savingsTarget.toFixed(0)}`,
    ].join("\n");

    const prompt = `You are a friendly financial coach for a South African township market app called Mdeko.
Here is a user's trading history:
${summary}

Give ONE short, practical tip in plain English. Maximum 2 sentences.
Focus on what they can do THIS WEEK to earn more, save more, or trade smarter.
Write like you're talking to a friend â€” not a banker. No jargon. No emojis except one at the end.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        console.error("[finance] smart tip AI error", res.status);
        return FALLBACK;
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const tip = json.choices?.[0]?.message?.content?.trim();
      if (!tip) return FALLBACK;

      // Cap at 200 chars to keep it readable on a phone
      return tip.slice(0, 200);
    } catch (err) {
      console.error("[finance] smart tip failed", err);
      return FALLBACK;
    }
  });

