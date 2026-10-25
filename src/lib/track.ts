/**
 * Lightweight journey tracking: records where buyers and sellers get to, so drop-offs
 * show up as gaps between steps. Fire-and-forget; never blocks or breaks the app.
 */
export type FunnelEvent =
  | "produce_selected"
  | "wave_placed"
  | "wave_cancelled"
  | "payment_started"
  | "payment_completed"
  | "payment_failed"
  | "payment_timeout"
  | "cash_confirmed"
  | "stock_saved"
  | "went_online"
  | "wave_accepted"
  | "order_delivered"
  | "app_updated";

const seen = new Set<string>();

export function track(event: FunnelEvent, detail?: string, onceKey?: string) {
  if (typeof window === "undefined") return;
  if (onceKey) {
    const k = `${event}:${onceKey}`;
    if (seen.has(k)) return;
    seen.add(k);
  }
  void (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;
      await supabase
        .from("funnel_events")
        .insert({ user_id: uid, event, detail: detail?.slice(0, 120) ?? null });
    } catch {
      /* tracking must never interrupt a sale */
    }
  })();
}
