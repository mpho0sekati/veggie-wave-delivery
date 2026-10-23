import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Crosshair, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMarketplace, saveTraderProfile } from "@/lib/use-marketplace";
import { useGeolocation } from "@/lib/use-geolocation";
import { useMdekoActions, useMyOrders, useOpenWaves } from "@/lib/use-mdeko";
import { useAppState } from "@/lib/veggie-store";
import { waveView } from "@/lib/wave-view";
import { catalogWith, distanceKm, formatRand } from "@/lib/veggie-data";
import { useReportCourierPosition } from "@/lib/use-courier-tracking";
import { useRoute } from "@/lib/use-route";
import StockEditor from "@/components/StockEditor";
import DemandInsights from "@/components/DemandInsights";
import OrderStepper from "@/components/OrderStepper";
const VeggieMap = lazy(() => import("@/components/VeggieMap"));
export const Route = createFileRoute("/runner")({
  head: () => ({
    meta: [
      { title: "Trader stall — Mdeko · Veggie Wave" },
      { name: "description", content: "Set stock, accept nearby waves and deliver with Mdeko." },
      { property: "og:title", content: "Trader stall — Mdeko · Veggie Wave" },
      {
        property: "og:description",
        content: "Manage your produce stall, deliveries and payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunnerPage,
});
function RunnerPage() {
  const { session, refresh } = useMarketplace();
  const state = useAppState();
  const actions = useMdekoActions();
  const { data: waves = [] } = useOpenWaves(Boolean(session.userId && session.role === "trader"));
  const { data: orders = [] } = useMyOrders(Boolean(session.userId));
  const me = state.runners.find((r) => r.id === session.userId);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const file = useRef<HTMLInputElement | null>(null);
  const active = orders.find(
    (o) => o.trader_id === session.userId && !o.cancelled_at && o.status !== "completed",
  );
  const activeWaveId = active?.wave_id;
  const activeId = active?.id;
  const activeStatus = active?.status;
  const meLat = me?.lat;
  const meLng = me?.lng;
  const [activeWave, setActiveWave] = useState<(typeof waves)[number] | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!activeWaveId) {
      setActiveWave(null);
      return;
    }
    void import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data } = await supabase
        .from("waves")
        .select("*")
        .eq("id", activeWaveId)
        .maybeSingle();
      if (!cancelled) setActiveWave(data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeWaveId]);
  const onPosition = useCallback(
    (pos: { lat: number; lng: number }) => {
      setPosition(pos);
      if (session.userId && session.role === "trader")
        void saveTraderProfile(session.userId, pos)
          .then(() => refresh())
          .catch(() => toast.error("Could not share your location"));
    },
    [session.userId, session.role, refresh],
  );
  const { locate, message } = useGeolocation(onPosition);
  const { currentPosition } = useReportCourierPosition(
    active?.id ?? null,
    active?.status === "delivering",
  );
  const { route, isLoading: routeLoading } = useRoute(
    active?.id ?? null,
    currentPosition,
    active?.status === "delivering",
  );
  useEffect(() => {
    const fix = position ?? (meLat != null && meLng != null ? { lat: meLat, lng: meLng } : null);
    if (activeStatus !== "delivering" || !activeId || !fix || !session.userId) return;
    let cancelled = false;
    const report = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      if (cancelled) return;
      const { error } = await supabase.from("courier_positions").insert({
        order_id: activeId,
        trader_id: session.userId ?? "",
        lat: fix.lat,
        lng: fix.lng,
      });
      if (error) toast.error("Could not share delivery location");
    };
    void report();
    const timer = setInterval(() => void report(), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeId, activeStatus, position, meLat, meLng, session.userId]);
  const catalog = catalogWith(state.customItems);
  const nearby = useMemo(
    () =>
      waves
        .filter(
          (w) =>
            w.lat != null &&
            w.lng != null &&
            position &&
            distanceKm(position, { lat: w.lat, lng: w.lng }) <= 5,
        )
        .sort((a, b) => {
          if (!position || a.lat == null || a.lng == null || b.lat == null || b.lng == null)
            return 0;
          return (
            distanceKm(position, { lat: a.lat, lng: a.lng }) -
            distanceKm(position, { lat: b.lat, lng: b.lng })
          );
        }),
    [waves, position],
  );
  const advance = async (status: "delivering" | "delivered") => {
    if (!active) return;
    try {
      await actions.advanceOrder.mutateAsync({ orderId: active.id, status });
      toast.success(status === "delivering" ? "Delivery started" : "Delivery recorded");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.includes("payment-required")
          ? "Wait for payment or the buyer to choose cash on delivery"
          : "Could not update delivery",
      );
    }
  };
  if (!session.loading && (!session.userId || session.role !== "trader"))
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-bold">Your Mdeko stall</h1>
        <Button asChild>
          <Link to={session.userId ? "/auth/onboarding" : "/auth"}>
            {session.userId ? "Set up your trader profile" : "Sign in to sell"}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Buy veggies</Link>
        </Button>
      </main>
    );
  return (
    <main className="relative h-dvh overflow-hidden bg-background">
      <div className="absolute inset-0">
        <ClientOnly>
          <Suspense fallback={<div className="h-full bg-muted" />}>
            <VeggieMap
              runners={state.runners}
              activeRunnerId={session.userId}
              buyerPosition={
                activeWave?.lat != null && activeWave.lng != null
                  ? { lat: activeWave.lat, lng: activeWave.lng }
                  : (position ?? undefined)
              }
              route={route}
              routeLoading={routeLoading}
            />
          </Suspense>
        </ClientOnly>
      </div>
      <header className="absolute inset-x-4 top-4 z-10 flex items-center justify-between gap-2 rounded-xl border bg-background p-3 shadow-lg">
        <Button asChild size="icon" variant="ghost">
          <Link to="/" aria-label="Back to buyers">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{me?.name || session.name || "My stall"}</p>
          <p className="text-xs text-muted-foreground">{me?.online ? "Available" : "Offline"}</p>
        </div>
        <Switch
          aria-label="Available for deliveries"
          checked={me?.online ?? false}
          onCheckedChange={async (online) => {
            if (!session.userId || !position) {
              toast.error("Set your location first");
              return;
            }
            try {
              await saveTraderProfile(session.userId, { online, ...position });
              await refresh();
            } catch {
              toast.error("Could not update availability");
            }
          }}
        />
        <Button asChild variant="outline" size="sm">
          <Link to="/finance">
            <Wallet /> My Money
          </Link>
        </Button>
      </header>
      <Button
        aria-label="Recenter location"
        size="icon"
        className="absolute right-4 top-24 z-10 rounded-full"
        onClick={locate}
      >
        <Crosshair />
      </Button>
      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-h-[72dvh] max-w-lg overflow-y-auto rounded-t-3xl border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="p-4 space-y-4">
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <div className="flex gap-2">
            <Input
              aria-label="Stall name"
              placeholder={me?.name || "Stall name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!session.userId || !name.trim()) return;
                try {
                  await saveTraderProfile(session.userId, { name: name.trim() });
                  await refresh();
                  toast.success("Name saved");
                } catch {
                  toast.error("Could not save name");
                }
              }}
            >
              Save
            </Button>
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (!picked || !session.userId) return;
              if (picked.size > 500000) {
                toast.error("Choose a photo smaller than 500 KB");
                return;
              }
              const uid = session.userId;
              const reader = new FileReader();
              reader.onload = () => {
                void saveTraderProfile(uid, { avatar: String(reader.result) })
                  .then(() => refresh())
                  .then(() => toast.success("Photo saved"))
                  .catch(() => toast.error("Could not save photo"));
              };
              reader.readAsDataURL(picked);
            }}
          />
          <Button variant="outline" onClick={() => file.current?.click()}>
            <Camera />
            {me?.avatar ? "Change photo" : "Add profile photo"}
          </Button>
          <h2 className="font-semibold text-lg">Waves near you</h2>
          {!active && !nearby.length && (
            <p className="text-muted-foreground text-sm">
              {position ? "No nearby waves yet" : "Set your location to see nearby waves"}
            </p>
          )}
          {active && activeWave && (
            <Card className="p-4 gap-3">
              <OrderStepper status={waveView(activeWave, active).status} />
              <p className="font-semibold">
                {active.status === "delivered"
                  ? "Delivered — waiting for buyer confirmation"
                  : active.status === "delivering"
                    ? "Delivering"
                    : "Order accepted"}
              </p>
              <p>
                {formatRand(Number(active.amount))} ·{" "}
                {active.payment_method === "cash" ? "Cash on delivery" : "MTN MoMo"}
              </p>
              {["accepted", "preparing", "ready"].includes(active.status) && (
                <Button
                  disabled={actions.advanceOrder.isPending}
                  onClick={() => advance("delivering")}
                >
                  Start delivering — share live location
                </Button>
              )}
              {active.status === "delivering" && (
                <Button onClick={() => advance("delivered")}>
                  I've arrived — confirm delivery
                </Button>
              )}
              {["accepted", "preparing", "ready"].includes(active.status) && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await actions.cancelWave.mutateAsync(active.wave_id);
                    } catch {
                      toast.error("Cannot cancel an order with payment in progress");
                    }
                  }}
                >
                  Cancel order
                </Button>
              )}
            </Card>
          )}
          {!active &&
            nearby.map((w) => {
              const view = waveView(w);
              const canFill =
                view.items.length > 0 &&
                view.items.every((i) => me?.stock.some((s) => s.itemId === i.id));
              return (
                <Card key={w.id} className="p-4 gap-3">
                  <p className="font-semibold">Someone is waving</p>
                  <ul>
                    {view.items.map((i) => (
                      <li key={i.id}>
                        {i.qty} × {catalog.find((c) => c.id === i.id)?.name ?? i.id}
                      </li>
                    ))}
                  </ul>
                  {view.wish && <p>{view.wish}</p>}
                  <Button
                    disabled={!canFill || actions.acceptWave.isPending || !me?.online}
                    onClick={async () => {
                      try {
                        await actions.acceptWave.mutateAsync(w.id);
                        toast.success("Wave accepted");
                      } catch {
                        toast.error("This wave expired, was accepted, or exceeds your stock");
                      }
                    }}
                  >
                    Accept this wave
                  </Button>
                </Card>
              );
            })}
        </div>
        {session.userId && (
          <StockEditor
            runnerId={session.userId}
            stock={me?.stock ?? []}
            customItems={state.customItems}
            onSaved={() => void refresh()}
          />
        )}
        {session.userId && <DemandInsights state={state} runnerId={session.userId} />}
        <div className="h-6" />
      </div>
    </main>
  );
}
