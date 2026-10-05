import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Hand,
  Minus,
  Plus,
  Star,
  Store,
  MapPin,
  CheckCircle2,
  Crosshair,
  Wallet,
  History,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  catalogWith,
  distanceKm,
  formatRand,
  priceFor,
  calculateDeliveryFee,
  estimateDeliveryMinutes,
  formatDistance,
  MAX_SUITABLE_DISTANCE_KM,
  type Runner,
} from "@/lib/veggie-data";
import {
  archiveRequest,
  cancelRequest,
  logDemand,
  payCash,
  refundOrder,
  setBuyerLocation,
  updateState,
  useAppState,
  type WaveRequest,
  type AppState,
} from "@/lib/veggie-store";
import { useGeolocation } from "@/lib/use-geolocation";
import { useSession, signOutEverywhere } from "@/lib/use-session";
import { useMdekoActions, useMyOrders, useMyWave } from "@/lib/use-mdeko";
import { useCourierPositions } from "@/lib/use-courier-tracking";
import { useWeatherWarning } from "@/lib/use-weather";
import WavePayDialog from "@/components/WavePayDialog";
import BrandMark from "@/components/BrandMark";
import OrderStepper from "@/components/OrderStepper";
import DescribeOrder from "@/components/DescribeOrder";

const VeggieMap = lazy(() => import("@/components/VeggieMap"));

const WAVE_TIMEOUT_MS = 120_000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mdeko · Veggie Wave — raise your hand for fresh veggies" },
      {
        name: "description",
        content:
          "Mdeko shows the nearest township veggie trader on the map. Raise your hand for what you need and pay instantly with MTN MoMo.",
      },
      { property: "og:title", content: "Mdeko · Veggie Wave — raise your hand for fresh veggies" },
      {
        property: "og:description",
        content:
          "Live map of nearby Mdeko traders. Wave, get your fruit and veg delivered, pay with MTN MoMo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuyerPage,
});

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse bg-muted" />;
}

const WaveClock = memo(function WaveClock({ createdAt }: { createdAt: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const waitedMs = Date.now() - createdAt;
  const total = Math.max(0, Math.floor(waitedMs / 1000));
  const clockDisplay = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="size-4" /> waiting… {clockDisplay}
    </p>
  );
});

function BuyerPage() {
  const walletBalance = useAppState((s) => s.wallet.balance);
  const communityCredit = useAppState((s) => s.wallet.stokvel_credit);
  const runners = useAppState((s) => s.runners);
  const request = useAppState((s) => s.request);
  const orders = useAppState((s) => s.orders);
  const customItems = useAppState((s) => s.customItems);
  const buyer = useAppState((s) => s.buyer);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [wish, setWish] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [payLoading, setPayLoading] = useState(false);

  const onPosition = useCallback((pos: { lat: number; lng: number }) => {
    setBuyerLocation(pos);
    setRecenterTrigger((prev) => prev + 1);
    toast.success("Location updated on map");
  }, []);
  const { status: geoStatus, locate, message: geoMessage } = useGeolocation(onPosition);

  const navigate = useNavigate();
  const session = useSession();
  const signedIn = Boolean(session.userId);
  const actions = useMdekoActions();
  const { data: liveWave } = useMyWave(signedIn);
  const { data: liveOrders } = useMyOrders(signedIn);

  // Mirror the saved wave/order from the backend onto the card, so the buyer sees
  // the trader's progress on this phone without refreshing.
  const liveOrder = useMemo(() => {
    if (!liveWave || !liveOrders) return null;
    return liveOrders.find((o) => o.wave_id === liveWave.id) ?? null;
  }, [liveWave, liveOrders]);

  // Live courier tracking for active delivery orders
  const {
    latestPosition: courierPosition,
    setBuyerPosition,
    isDisconnected,
  } = useCourierPositions(liveOrder?.id ?? null);

  const assigned: Runner | null = runners.find((r) => r.id === request?.runnerId) ?? null;

  // Navigation steps for tracking overlay
  const navigationSteps = useMemo(() => {
    if (!request) return undefined;
    const isAccepted =
      request.status === "accepted" || request.status === "delivered" || request.status === "paid";
    const isDelivered = request.status === "delivered" || request.status === "paid";
    const isPaid = request.status === "paid";

    return [
      {
        id: "s1",
        label: "Wave Raised",
        sublabel: "Looking for nearby traders",
        completed: isAccepted,
        active: request.status === "waving",
      },
      {
        id: "s2",
        label: "Trader Matched",
        sublabel: assigned ? `${assigned.name} accepted` : "Trader assigned",
        completed: isAccepted,
        active: request.status === "accepted" && !courierPosition,
      },
      {
        id: "s3",
        label: "En Route to You",
        sublabel: courierPosition
          ? `${formatDistance(courierPosition.distanceKm)} away`
          : "On the way",
        completed: isDelivered,
        active: request.status === "accepted" && Boolean(courierPosition),
      },
      {
        id: "s4",
        label: "Delivered & Paid",
        sublabel: isPaid ? "Payment complete" : "Awaiting payment",
        completed: isPaid,
        active: request.status === "delivered",
      },
    ];
  }, [request, assigned, courierPosition]);

  // Weather warning for active delivery orders
  const { warning: weatherWarning } = useWeatherWarning(liveOrder?.id ?? null);

  // Update buyer position for ETA calculation
  useEffect(() => {
    if (buyer.located) {
      setBuyerPosition({ lat: buyer.lat, lng: buyer.lng });
    }
  }, [buyer.lat, buyer.lng, buyer.located, setBuyerPosition]);

  useEffect(() => {
    if (!signedIn || !liveWave) return;
    const status: "waving" | "accepted" | "delivered" | "paid" = !liveOrder
      ? "waving"
      : liveOrder.status === "completed"
        ? "paid"
        : liveOrder.status === "delivered"
          ? "delivered"
          : "accepted";
    updateState((prev): AppState => {
      if (!prev.request || prev.request.waveId !== liveWave.id) return prev;
      const total = liveOrder ? Number(liveOrder.amount) : prev.request.total;
      const orderId = liveOrder?.id;
      if (
        prev.request.status === status &&
        prev.request.orderId === orderId &&
        prev.request.total === total
      ) {
        return prev;
      }
      const newRequest: WaveRequest = {
        ...prev.request,
        status,
        total,
        ...(orderId !== undefined ? { orderId } : {}),
      };
      return {
        ...prev,
        request: newRequest,
      };
    });
  }, [signedIn, liveWave, liveOrder]);

  const catalog = useMemo(() => catalogWith(customItems), [customItems]);
  const online = runners.filter((r) => r.online);
  const picked = useMemo(() => catalog.filter((c) => (qty[c.id] ?? 0) > 0), [catalog, qty]);

  const ranked = useMemo(() => {
    return online
      .map((runner) => {
        const km = distanceKm(buyer, runner);
        const have = picked.filter((p) => priceFor(runner, p.id) !== null);
        const subtotal = have.reduce(
          (sum, p) => sum + (priceFor(runner, p.id) ?? 0) * (qty[p.id] ?? 0),
          0,
        );
        const deliveryFee = calculateDeliveryFee(km);
        const total = subtotal > 0 ? subtotal + deliveryFee : 0;
        const etaMin = estimateDeliveryMinutes(km);
        return {
          runner,
          km,
          have: have.length,
          subtotal,
          deliveryFee,
          total,
          etaMin,
          isSuitable: km <= MAX_SUITABLE_DISTANCE_KM,
        };
      })
      .filter((r) => r.isSuitable)
      .sort((a, b) => b.have - a.have || a.km - b.km);
  }, [online, buyer, picked, qty]);

  const hasRequest = Boolean(request);
  const [isCollapsed, setIsCollapsed] = useState(hasRequest);
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);
  useEffect(() => {
    setIsCollapsed(hasRequest);
  }, [hasRequest]);

  const best = ranked[0] ?? null;
  const total = best?.total ?? 0;

  const bump = useCallback(
    (id: string, delta: number) =>
      setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) })),
    [],
  );

  const wave = useCallback(async () => {
    if (!picked.length && !wish.trim()) {
      toast.error("Pick what you need first");
      return;
    }
    if (!signedIn) {
      toast.error("Sign in first so traders can reach you");
      navigate({ to: "/auth" });
      return;
    }

    const items = picked.map((p) => ({ id: p.id, qty: qty[p.id] ?? 0 }));
    try {
      const saved = await actions.createWave.mutateAsync({
        items,
        wish: wish.trim(),
        note: `${picked.length} items`,
        lat: buyer.located ? buyer.lat : null,
        lng: buyer.located ? buyer.lng : null,
      });
      updateState((prev) => ({
        ...prev,
        request: {
          id: saved.id,
          waveId: saved.id,
          items,
          wish: wish.trim(),
          total,
          note: `${picked.length} items`,
          status: "waving",
          runnerId: null,
          createdAt: new Date(saved.created_at).getTime(),
        },
      }));
      logDemand([
        ...picked.map((p) => ({ itemId: p.id, label: p.name })),
        ...(wish.trim() ? [{ itemId: null, label: wish.trim().toLowerCase() }] : []),
      ]);
      toast.success("Hand raised — traders nearby can see you waving");
    } catch (err) {
      console.error("[mdeko] wave failed", err);
      toast.error("Could not send your wave — please try again");
    }
  }, [picked, wish, total, qty, signedIn, navigate, actions.createWave, buyer]);

  const waveAgain = useCallback(
    () =>
      updateState((prev) => ({
        ...prev,
        request: prev.request ? { ...prev.request, createdAt: Date.now() } : null,
      })),
    [],
  );

  const cancel = useCallback(() => {
    console.log(`\n  ORDER CANCELLED by buyer at ${new Date().toLocaleTimeString()}`);
    cancelRequest();
    setQty({});
    setWish("");
    toast.info("Request cancelled");
  }, []);

  const finish = useCallback(() => {
    archiveRequest();
    setQty({});
    setWish("");
  }, []);

  const timedOut =
    request?.status === "waving" && Date.now() - (request?.createdAt ?? 0) > WAVE_TIMEOUT_MS;

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      {/* Full screen edge-to-edge Leaflet map */}
      <div className="absolute inset-0 z-0">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <VeggieMap
              runners={runners}
              activeRunnerId={request?.runnerId ?? selectedRunnerId ?? null}
              waving={request?.status === "waving"}
              buyerPosition={buyer}
              courierPosition={courierPosition}
              isGpsDisconnected={isDisconnected}
              navigationSteps={request ? navigationSteps : undefined}
              recenterTrigger={recenterTrigger}
              onPickPosition={onPosition}
            />
          </Suspense>
        </ClientOnly>
      </div>

      {/* Floating glassmorphic top header overlay */}
      <header className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between rounded-2xl border bg-background/85 px-4 py-3 shadow-lg backdrop-blur-md">
        <BrandMark
          subtitle={
            geoStatus === "locating"
              ? "Finding your location…"
              : buyer.located
                ? `${online.length} traders nearby`
                : `${online.length} traders · location disabled`
          }
        />
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="rounded-xl shadow-sm">
            <Link to="/runner">
              <Store /> Trader
            </Link>
          </Button>
          {signedIn ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Sign out"
              onClick={async () => {
                await signOutEverywhere();
                toast.success("Signed out");
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Floating map controls */}
      <div className="absolute top-20 right-4 z-10 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="size-10 rounded-full border shadow-lg backdrop-blur-md"
          onClick={() => {
            locate();
            setRecenterTrigger((p) => p + 1);
          }}
          aria-label="Recenter location"
        >
          <Crosshair className="size-5" />
        </Button>
      </div>

      {/* Floating bottom drawer card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t bg-background/95 p-5 shadow-2xl backdrop-blur-xl transition-transform duration-300">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />

        <p className="mx-5 mt-3 text-sm text-muted-foreground">
          {geoMessage ? `${geoMessage} ` : ""}Tap the map to drop your pin.
        </p>

        {!request && (
          <>
            <div className="mx-4 mt-4 rounded-2xl bg-secondary px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="size-4 text-primary" /> Mdeko Pay balance
                </span>
                <span className="font-display font-semibold">{formatRand(walletBalance)}</span>
              </div>
              {communityCredit > 0 && (
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="flex items-center gap-2 text-xs text-primary font-medium">
                    Community Credit
                  </span>
                  <span className="font-display text-sm font-semibold text-primary">
                    {formatRand(communityCredit)}
                  </span>
                </div>
              )}
              {communityCredit === 0 && (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  Earn <strong>R0.50 Mdeko Community Credit</strong> every time you pay with MoMo
                </p>
              )}
            </div>

            <h2 className="mt-6 px-5 text-lg font-semibold">Traders near you</h2>
            {ranked.length === 0 ? (
              <Card className="mx-4 mt-2 items-center gap-2 p-8 text-center">
                <Store className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No Mdeko trader is online around you yet. Pick what you need anyway.
                </p>
              </Card>
            ) : (
              <ul className="mx-4 mt-2 space-y-2">
                {ranked.map(({ runner, km, have, total: runnerTotal, etaMin }, index) => {
                  const partial = picked.length > 0 && have < picked.length;
                  const bestMatch = index === 0 && picked.length > 0 && !partial;
                  const isSelected = selectedRunnerId === runner.id;
                  return (
                    <li
                      key={runner.id}
                      onClick={() => {
                        setSelectedRunnerId((p) => (p === runner.id ? null : runner.id));
                        if (isCollapsed) setIsCollapsed(false);
                      }}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-glow ring-2 ring-primary/30"
                          : index === 0
                            ? "border-primary bg-secondary shadow-glow"
                            : "bg-card hover:bg-secondary/50"
                      }`}
                    >
                      <span className="bg-brand flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-primary-foreground">
                        {runner.avatar ? (
                          <img
                            src={runner.avatar}
                            alt={runner.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          runner.name.charAt(0)
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-semibold">
                          {runner.name}
                          {bestMatch && (
                            <Badge className="shrink-0" variant="default">
                              best match
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5 text-primary" /> {formatDistance(km)} away
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" /> {etaMin} min ETA
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="size-3.5 text-amber-500" /> {runner.rating.toFixed(1)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Delivery fee: {formatRand(calculateDeliveryFee(km))}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {picked.length > 0 && (
                          <p className="font-display text-sm font-semibold">
                            {formatRand(runnerTotal)}
                          </p>
                        )}
                        <Badge variant={partial ? "outline" : "secondary"}>
                          {picked.length
                            ? `has ${have}/${picked.length}`
                            : `${runner.stock.length} items`}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <DescribeOrder
              catalog={catalog}
              onApply={(items, extras) => {
                setQty(Object.fromEntries(items.map((l) => [l.id, l.qty])));
                setWish(extras.join(", "));
              }}
            />

            <h2 className="mt-6 px-5 text-lg font-semibold">What do you need?</h2>
            <div className="grid grid-cols-2 gap-3 px-4 pt-3">
              {catalog.map((item) => {
                const Icon = item.icon;
                const count = qty[item.id] ?? 0;
                const sellers = online.filter((r) => priceFor(r, item.id) !== null).length;
                return (
                  <Card
                    key={item.id}
                    className={`gap-2 p-4 transition-colors ${count ? "border-primary bg-secondary" : ""}`}
                  >
                    <Icon className="size-7 text-primary" />
                    <div>
                      <p className="font-semibold leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.unit} ·{" "}
                        {sellers
                          ? `from ${formatRand(Math.min(...online.map((r) => priceFor(r, item.id)).filter((p): p is number => p !== null)))}`
                          : "nobody stocked"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => bump(item.id, -1)}
                      >
                        <Minus />
                      </Button>
                      <span className="font-display text-base font-semibold">{count}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => bump(item.id, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mx-4 mt-4 space-y-2">
              <Label htmlFor="wish">Something else?</Label>
              <Input
                id="wish"
                placeholder="e.g. blueberries"
                value={wish}
                onChange={(e) => setWish(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Even if nobody has it yet, we tell traders people are asking.
              </p>
            </div>
          </>
        )}

        {request && (
          <Card className="animate-rise animate-slide-up mx-4 mt-4 gap-4 p-5">
            <OrderStepper status={request.status} />
            <div className="flex items-center gap-2">
              {request.status === "waving" && (
                <>
                  <Hand className="size-5 animate-wave text-accent" />
                  <p className="font-semibold">Waving… waiting for a trader</p>
                </>
              )}
              {request.status === "accepted" && (
                <>
                  <MapPin className="size-5 text-primary" />
                  <p className="font-semibold">{assigned?.name ?? "Your trader"} is on the way</p>
                </>
              )}
              {request.status === "delivered" && (
                <>
                  <CheckCircle2 className="size-5 text-primary" />
                  <p className="font-semibold">Delivered — time to pay</p>
                </>
              )}
              {request.status === "paid" && (
                <>
                  <CheckCircle2 className="size-5 text-primary" />
                  <p className="font-semibold">
                    Paid {request.paidWith === "cash" ? "in cash" : "with MTN MoMo"}. Enjoy!
                  </p>
                </>
              )}
            </div>

            {request.status === "waving" && <WaveClock createdAt={request.createdAt} />}

            <ul className="space-y-1 text-sm text-muted-foreground">
              {request.items.map((line) => {
                const item = catalog.find((c) => c.id === line.id);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <li key={line.id} className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {line.qty} × {item.name} ({item.unit})
                  </li>
                );
              })}
              {request.wish && <li className="italic">also asked for: {request.wish}</li>}
            </ul>
            <p className="font-display text-xl font-bold">{formatRand(request.total)}</p>

            {timedOut && (
              <div className="space-y-2 rounded-xl bg-secondary p-3 text-sm">
                <p>Nobody has answered yet.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={waveAgain}>
                    <Hand /> Wave again
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {request.status === "delivered" && (
              <>
                <Button
                  variant="wave"
                  size="lg"
                  onClick={() => setPayOpen(true)}
                  disabled={payLoading}
                  className={payLoading ? "animate-pulse-glow" : ""}
                >
                  {payLoading ? (
                    <>
                      <Loader2 className="animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <Wallet /> Pay {formatRand(request.total)} with MTN MoMo
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    payCash();
                    toast.success("Cash payment recorded");
                  }}
                >
                  I paid cash
                </Button>
              </>
            )}

            {request.status !== "paid" ? (
              <Button variant="ghost" onClick={cancel}>
                Cancel request
              </Button>
            ) : (
              <div className="space-y-3">
                {request.paidWith === "wave-pay" && (
                  <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-center space-y-0.5">
                    <p className="font-semibold text-primary">Community Credit earned</p>
                    <p className="text-xs text-muted-foreground">
                      +R0.50 added · Total: {formatRand(communityCredit)}
                    </p>
                    <p className="text-xs text-muted-foreground">Use toward future purchases</p>
                  </div>
                )}
                <Button size="lg" variant="wave" className="w-full shadow-glow" onClick={finish}>
                  <Hand className="animate-wave" /> Wave Again
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Need something else? The market is waiting.
                </p>
              </div>
            )}
          </Card>
        )}

        {!request && (
          <div className="sticky bottom-0 z-500 mt-6 border-t bg-background/85 px-4 pt-3 pb-4 backdrop-blur-md">
            <Button size="xl" variant="wave" className="shadow-glow w-full" onClick={wave}>
              <Hand className="animate-wave" /> Raise my hand
              {total > 0 ? ` · ${formatRand(total)}` : ""}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {picked.length || wish.trim()
                ? "The nearest trader who has your items sees the wave first."
                : "Tap an item above, then raise your hand."}
            </p>
          </div>
        )}

        {!request && orders.length > 0 && (
          <section className="px-4 pb-8">
            <h2 className="flex items-center gap-2 px-1 pt-6 pb-2 text-lg font-semibold">
              <History className="size-5 text-primary" /> Past waves
            </h2>
            <ul className="space-y-2">
              {orders.map((order) => {
                const trader = runners.find((r) => r.id === order.runnerId);
                return (
                  <li key={order.id} className="rounded-2xl border px-4 py-3 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{trader?.name ?? "No trader"}</p>
                      <p className="font-display font-semibold">{formatRand(order.total)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {order.items.length} items ·{" "}
                        {order.status === "paid"
                          ? order.paidWith === "cash"
                            ? "paid cash"
                            : "paid MoMo"
                          : order.status}
                      </span>
                      <Badge
                        variant={order.status === "paid" ? "default" : "outline"}
                        className="capitalize text-[0.65rem]"
                      >
                        {order.status}
                      </Badge>
                    </div>
                    {order.status === "paid" && order.paidWith === "wave-pay" && (
                      <div className="pt-1 border-t flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            refundOrder(order.id);
                            toast.success(`Refunded ${formatRand(order.total)}`);
                          }}
                        >
                          Request Refund
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <WavePayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        amount={request?.total ?? 0}
        traderName={assigned?.name ?? "your trader"}
        onPay={async (msisdn) => {
          const orderId = request?.orderId;
          if (!orderId) {
            toast.error("Your trader has to accept the order before you can pay");
            return;
          }
          setPayLoading(true);
          try {
            // The amount is taken from the saved order on the server, never from this page.
            const started = await actions.startPayment.mutateAsync({ orderId, msisdn });
            if (started.status === "failed") {
              toast.error("MTN MoMo turned the request down — try again");
              setPayLoading(false);
              return;
            }

            toast.success(`MoMo request sent to ${msisdn} — approve it on your phone`);
            setPayOpen(false);

            // Ask MTN what happened, every 2s for up to a minute.
            for (let i = 0; i < 30; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const result = await actions.verifyPayment(orderId);
              if (result?.status === "successful") {
                updateState((prev) => {
                  if (!prev.request) return prev;
                  return {
                    ...prev,
                    request: { ...prev.request, status: "paid", paidWith: "wave-pay" },
                    wallet: {
                      ...prev.wallet,
                      stokvel_credit: Math.round((prev.wallet.stokvel_credit + 0.5) * 100) / 100,
                    },
                  };
                });
                actions.refresh();
                toast.success("Payment confirmed! Enjoy your veggies");
                toast.success("+R0.50 Mdeko Community Credit earned");
                setPayLoading(false);
                return;
              }
              if (result?.status === "failed") {
                toast.error("Payment was declined on your phone");
                setPayLoading(false);
                return;
              }
            }
            toast.error("Payment timeout — check your MoMo app and try again");
          } catch (err) {
            console.error("[momo] payment error", err);
            toast.error("Payment failed — please try again");
          }
          setPayLoading(false);
        }}
      />
    </main>
  );
}
