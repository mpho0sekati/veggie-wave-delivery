import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Camera, Crosshair, Store, PackageCheck, Radio, Hand, Truck } from "lucide-react";
import AppTabBar from "@/components/AppTabBar";
import JourneyProgress from "@/components/JourneyProgress";
import { traderJourneyStep } from "@/lib/journey-progress";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { signOutEverywhere } from "@/lib/use-session";
import { useMarketplace, saveTraderProfile } from "@/lib/use-marketplace";
import { useGeolocation } from "@/lib/use-geolocation";
import { useMdekoActions, useMyOrders, useOpenWaves } from "@/lib/use-mdeko";
import { useAppState } from "@/lib/veggie-store";
import { waveView } from "@/lib/wave-view";
import { catalogWith, formatRand } from "@/lib/veggie-data";
import { useReportCourierPosition } from "@/lib/use-courier-tracking";
import { useRoute } from "@/lib/use-route";
import { useWaveAlert } from "@/lib/use-wave-alert";
import StockEditor from "@/components/StockEditor";
import DemandInsights from "@/components/DemandInsights";
import OrderStepper from "@/components/OrderStepper";
import { nearbySellerWaves, sellerPosition } from "@/lib/seller-view";
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
  const { session, refresh, ownProfile, error: marketplaceError } = useMarketplace();
  const state = useAppState();
  const actions = useMdekoActions();
  const wavesQuery = useOpenWaves(Boolean(session.userId && session.role === "trader"));
  const waves = wavesQuery.data ?? [];
  const ordersQuery = useMyOrders(Boolean(session.userId));
  const orders = ordersQuery.data ?? [];
  const me = state.runners.find((r) => r.id === session.userId);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const recenterRequested = useRef(false);
  const location = sellerPosition(position, ownProfile);
  const displayName = name ?? ownProfile?.name ?? session.name;
  const file = useRef<HTMLInputElement | null>(null);
  const active = orders.find(
    (o) => o.trader_id === session.userId && !o.cancelled_at && o.status !== "completed",
  );
  const activeWaveId = active?.wave_id;
  const activeId = active?.id;
  const activeStatus = active?.status;
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
      if (recenterRequested.current) {
        recenterRequested.current = false;
        setRecenterTrigger((value) => value + 1);
      }
      if (session.userId && session.role === "trader")
        void saveTraderProfile(session.userId, pos)
          .then(() => refresh())
          .catch(() => toast.error("Could not share your location"));
    },
    [session.userId, session.role, refresh],
  );
  const { locate, message } = useGeolocation(onPosition);
  // While online, refresh the trader's shared location every minute so buyers keep seeing them.
  const isOnline = Boolean(ownProfile?.online);
  useEffect(() => {
    if (!isOnline) return;
    const timer = setInterval(() => locate(), 60_000);
    return () => clearInterval(timer);
  }, [isOnline, locate]);
  const { currentPosition } = useReportCourierPosition(
    active?.id ?? null,
    active?.status === "delivering",
  );
  const { route, isLoading: routeLoading } = useRoute(
    active?.id ?? null,
    currentPosition,
    active?.status === "delivering",
  );
  // Delivery location is reported once, by useReportCourierPosition above.
  const catalog = catalogWith(state.customItems);
  const nearby = nearbySellerWaves(waves, location);
  // Whistle + vibrate when a new wave lands nearby and the trader is free to take it.
  useWaveAlert(nearby.length, isOnline && !active);

  const advance = async (status: "delivering" | "delivered") => {
    if (!active) return;
    try {
      await actions.advanceOrder.mutateAsync({ orderId: active.id, status });
      track(status === "delivering" ? "went_online" : "order_delivered", status);
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
                  : (location ?? undefined)
              }
              buyerLocated={Boolean(activeWave?.lat != null || location)}
              recenterPosition={location ?? undefined}
              recenterTrigger={recenterTrigger}
              onPickPosition={(pos) => {
                recenterRequested.current = true;
                onPosition(pos);
              }}
              route={route}
              routeLoading={routeLoading}
            />
          </Suspense>
        </ClientOnly>
      </div>
      <header className="absolute inset-x-3 top-3 z-10 mx-auto max-w-lg space-y-2">
        <AppTabBar signedIn={Boolean(session.userId)} onSignOut={signOutEverywhere} />
        <div className="flex items-center gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg">
          <Store className="size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {ownProfile?.name || session.name || "My stall"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? "Online — buyers can see you" : "Offline — turn on to get orders"}
            </p>
          </div>
          <Switch
            aria-label="Available for deliveries"
            checked={isOnline}
            onCheckedChange={async (online) => {
              if (!session.userId || (online && !location)) {
                toast.error("Set your location first");
                return;
              }
              try {
                await saveTraderProfile(session.userId, { online, ...(location ?? {}) });
                await refresh();
              } catch {
                toast.error("Could not update availability");
              }
            }}
          />
          <Button
            aria-label="Find my location"
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={() => {
              recenterRequested.current = true;
              if (location) setRecenterTrigger((value) => value + 1);
              locate();
            }}
          >
            <Crosshair />
          </Button>
        </div>
      </header>
      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-h-[72dvh] max-w-lg overflow-y-auto rounded-t-3xl border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="p-4 space-y-4">
          <JourneyProgress
            label="Your trader journey"
            steps={[
              { label: "My stock", icon: PackageCheck },
              { label: "Go online", icon: Radio },
              { label: "Take a wave", icon: Hand },
              { label: "Deliver", icon: Truck },
            ]}
            current={traderJourneyStep(Boolean(me?.stock.length), isOnline, active?.status)}
          />
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <div className="flex gap-2">
            <Input
              aria-label="Stall name"
              placeholder="Stall name"
              value={displayName}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!session.userId || !displayName.trim()) {
                  toast.error("Type your stall name first");
                  return;
                }
                setSavingName(true);
                try {
                  await saveTraderProfile(session.userId, { name: displayName.trim() });
                  await refresh();
                  setName(null);
                  toast.success("Name saved");
                } catch {
                  toast.error("Could not save name");
                } finally {
                  setSavingName(false);
                }
              }}
              disabled={savingName}
            >
              {savingName ? "Saving…" : "Save"}
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
          {(wavesQuery.isError || ordersQuery.isError || marketplaceError) && (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-destructive">
                Couldn't load your stall or requests. Your saved details haven't changed.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  void refresh();
                  void wavesQuery.refetch();
                  void ordersQuery.refetch();
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {!active && !nearby.length && !wavesQuery.isError && (
            <p className="text-muted-foreground text-sm">
              {location ? "No nearby waves yet" : "Set your location to see nearby waves"}
            </p>
          )}
          {!active && !marketplaceError && (
            <p className="text-xs text-muted-foreground" role="status">
              {!me?.stock.length
                ? "Your stall has no stock yet"
                : !isOnline
                  ? "Stock saved ✓ · Your stall is offline"
                  : nearby.length
                    ? `${nearby.length} ${nearby.length === 1 ? "buyer is" : "buyers are"} waving nearby`
                    : "Stock saved ✓ · Online and ready for buyers"}
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
                    disabled={!canFill || actions.acceptWave.isPending || !isOnline}
                    onClick={async () => {
                      try {
                        await actions.acceptWave.mutateAsync(w.id);
                        track("wave_accepted");
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
