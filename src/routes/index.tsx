import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useGeolocation } from "@/lib/use-geolocation";
import {
  createWave,
  getMyWave,
  getOrder,
  advanceOrder,
  startMomoPayment,
  verifyMomoPayment,
  listMyOrders,
} from "@/lib/mdeko.functions";
import { setBuyerLocation } from "@/lib/veggie-store-supabase";
import WavePayDialog from "@/components/WavePayDialog";
import BrandMark from "@/components/BrandMark";
import OrderStepper from "@/components/OrderStepper";

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
          "Live map of nearby Mdeko traders with their own stock and prices. Wave, get your fruit and veg delivered, pay with MTN MoMo.",
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
  const [runners, setRunners] = useState<Runner[]>([]);
  const [order, setOrder] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [buyer, setBuyer] = useState({ lat: -33.9249, lng: 18.4241, located: false });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [wish, setWish] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const onPosition = useCallback(async (pos: { lat: number; lng: number }) => {
    if (await setBuyerLocation(pos)) {
      setBuyer((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, located: true }));
      setRecenterTrigger((prev) => prev + 1);
    }
  }, []);
  const { status: geoStatus, locate, stop, message: geoMessage } = useGeolocation(onPosition);
  const onMapPick = useCallback(
    async (pos: { lat: number; lng: number }) => {
      stop();
      if (await setBuyerLocation(pos)) {
        setBuyer((prev) => ({ ...prev, lat: pos.lat, lng: pos.lng, located: true }));
        setRecenterTrigger((prev) => prev + 1);
        toast.success("Location pin updated on map");
      } else {
        toast.error("Failed to save your chosen location");
      }
    },
    [stop],
  );

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load orders
        const myOrders = await listMyOrders();
        setOrders(myOrders);
        // Find active order
        const active = myOrders.find(
          (o) => !["completed", "failed", "cancelled"].includes(o.status),
        );
        if (active) {
          setOrder(active);
        }
      } catch (err) {
        console.error("Failed to load orders", err);
      }
    };
    loadData();
  }, []);

  const picked = useMemo(() => catalogWith([]).filter((c) => (qty[c.id] ?? 0) > 0), [qty]);
  const catalog = useMemo(() => catalogWith([]), []);
  const online = runners.filter((r) => r.online);

  // Traders ranked by stock match, then distance
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
        const isSuitable = km <= MAX_SUITABLE_DISTANCE_KM;
        return { runner, km, have: have.length, subtotal, deliveryFee, total, etaMin, isSuitable };
      })
      .filter((r) => r.isSuitable)
      .sort((a, b) => b.have - a.have || a.km - b.km);
  }, [online, buyer, picked, qty]);

  const hasOrder = Boolean(order);
  const [isCollapsed, setIsCollapsed] = useState(hasOrder);
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);

  useEffect(() => {
    setIsCollapsed(hasOrder);
  }, [hasOrder]);

  const best = ranked[0] ?? null;
  const total = best?.total ?? 0;
  const assignedTrader = runners.find((r) => r.id === order?.trader_id);

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
    setLoading(true);
    try {
      const newWave = await createWave({
        data: {
          items: picked.map((p) => ({ id: p.id, qty: qty[p.id] ?? 0 })),
          wish: wish.trim(),
          lat: buyer.lat,
          lng: buyer.lng,
        },
      });
      // After wave created, fetch the order that was created
      const myOrder = await getMyWave();
      toast.success("Hand raised — traders nearby can see you waving");
    } catch (error) {
      toast.error("Failed to raise hand");
    } finally {
      setLoading(false);
    }
  }, [picked, wish, buyer.lat, buyer.lng, qty]);

  const cancel = useCallback(async () => {
    if (!order) return;
    try {
      // In V2, we'd need a declineWave or cancelOrder function
      // For now, just clear local state
      setOrder(null);
      setQty({});
      setWish("");
      toast.info("Order cancelled");
    } catch (error) {
      toast.error("Failed to cancel order");
    }
  }, [order]);

  const initiatePayment = useCallback(
    async (msisdn: string) => {
      if (!order) return;
      setPaymentLoading(true);
      try {
        const result = await startMomoPayment({
          data: { orderId: order.id, msisdn },
        });
        if (result.status === "pending") {
          toast.success(`Payment request sent to ${msisdn}`);
          // Poll for completion
          const checkPayment = async () => {
            for (let i = 0; i < 30; i++) {
              const verified = await verifyMomoPayment({ data: { orderId: order.id } });
              if (verified?.status === "successful") {
                setOrder((prev: any) => ({ ...prev, status: "completed" }));
                toast.success("Payment confirmed!");
                return;
              }
              await new Promise((r) => setTimeout(r, 1000));
            }
            toast.error("Payment timeout — please verify manually");
          };
          checkPayment();
        }
      } catch (error) {
        toast.error("Failed to initiate payment");
      } finally {
        setPaymentLoading(false);
      }
    },
    [order],
  );

  const timedOut =
    order?.status === "creating" &&
    order?.created_at &&
    Date.now() - order.created_at > WAVE_TIMEOUT_MS;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col pb-4">
      <header className="animate-rise flex items-center justify-between gap-3 px-5 pt-6 pb-3">
        <BrandMark
          subtitle={
            geoStatus === "locating"
              ? "Finding your location…"
              : buyer.located
                ? `${online.length} traders around you`
                : `${online.length} traders · location not shared`
          }
        />
        <Button asChild variant="secondary" size="sm" className="shrink-0">
          <Link to="/runner">
            <Store /> I&apos;m a trader
          </Link>
        </Button>
      </header>

      <section
        className={`relative mx-4 overflow-hidden rounded-3xl border shadow-lift transition-[height] duration-300 ${
          isCollapsed ? "h-40" : "h-72"
        }`}
      >
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <VeggieMap
              runners={runners}
              activeRunnerId={order?.trader_id ?? selectedRunnerId ?? null}
              waving={order?.status === "creating"}
              buyerPosition={buyer}
              recenterTrigger={recenterTrigger}
              onPickPosition={onMapPick}
            />
          </Suspense>
        </ClientOnly>
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-3 left-3 z-400 shadow-lift"
          onClick={() => {
            locate();
            setRecenterTrigger((prev) => prev + 1);
          }}
        >
          <Crosshair />
          {geoStatus === "locating"
            ? "Locating…"
            : buyer.located
              ? "Recentre on me"
              : "Use my location"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-3 right-3 z-400 shadow-lift"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={isCollapsed ? "Expand map" : "Collapse map"}
        >
          {isCollapsed ? <ChevronDown /> : <ChevronUp />}
          {isCollapsed ? "Expand" : "Collapse"}
        </Button>
      </section>

      <p className="mx-5 mt-3 text-sm text-muted-foreground">
        {geoMessage ? `${geoMessage} ` : ""}Tap or click anywhere on the map to drop your pin.
      </p>

      {!order && (
        <>
          <h2 className="mt-6 px-5 text-lg font-semibold">Traders near you</h2>
          {ranked.length === 0 ? (
            <Card className="mx-4 mt-2 items-center gap-2 p-8 text-center">
              <Store className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No Mdeko trader is online around you yet. Pick what you need anyway — the next
                trader to come online will see your wave.
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
                      setSelectedRunnerId((prev) => (prev === runner.id ? null : runner.id));
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
                          alt={`${runner.name}'s profile`}
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
                        ? `from ${formatRand(
                            Math.min(
                              ...online
                                .map((r) => priceFor(r, item.id))
                                .filter((p): p is number => p !== null),
                            ),
                          )}`
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
              Even if nobody has it yet, we tell the traders people are asking for it.
            </p>
          </div>
        </>
      )}

      {order && (
        <Card className="animate-rise mx-4 mt-4 gap-4 p-5">
          <OrderStepper
            status={
              order.status as
                "waving" | "accepted" | "delivered" | "paid" | "cancelled" | "failed" | "refunded"
            }
          />
          <div className="flex items-center gap-2">
            {order.status === "creating" && (
              <>
                <Hand className="size-5 animate-wave text-accent" />
                <p className="font-semibold">Waving… waiting for a trader</p>
              </>
            )}
            {order.status === "accepted" && assignedTrader && (
              <>
                <MapPin className="size-5 text-primary" />
                <p className="font-semibold">{assignedTrader.name} is on the way</p>
              </>
            )}
            {order.status === "delivered" && (
              <>
                <CheckCircle2 className="size-5 text-primary" />
                <p className="font-semibold">Delivered — time to pay</p>
              </>
            )}
            {order.status === "completed" && (
              <>
                <CheckCircle2 className="size-5 text-primary" />
                <p className="font-semibold">Payment received. Enjoy your veggies!</p>
              </>
            )}
          </div>

          {order.status === "creating" && <WaveClock createdAt={order.created_at} />}

          <ul className="space-y-1 text-sm text-muted-foreground">
            {order.items?.map((line: any) => {
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
            {order.wish && <li className="italic">also asked for: {order.wish}</li>}
          </ul>
          <p className="font-display text-xl font-bold">{formatRand(order.amount)}</p>

          {timedOut && (
            <div className="space-y-2 rounded-xl bg-secondary p-3 text-sm">
              <p>Nobody has answered yet.</p>
              <Button size="sm" variant="outline" onClick={cancel}>
                Try another trader
              </Button>
            </div>
          )}

          {order.status === "delivered" && (
            <Button
              variant="wave"
              size="lg"
              onClick={() => setPayOpen(true)}
              disabled={paymentLoading}
            >
              {paymentLoading ? <Loader2 className="animate-spin" /> : <Wallet />}
              Pay {formatRand(order.amount)} with MTN MoMo
            </Button>
          )}
          {order.status !== "completed" && (
            <Button variant="ghost" onClick={cancel}>
              Cancel order
            </Button>
          )}
        </Card>
      )}

      {!order && (
        <div className="sticky bottom-0 z-500 mt-6 border-t bg-background/85 px-4 pt-3 pb-4 backdrop-blur-md">
          <Button
            size="xl"
            variant="wave"
            className="shadow-glow w-full"
            onClick={wave}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Hand className="animate-wave" />}
            Raise my hand {total > 0 ? ` · ${formatRand(total)}` : ""}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {picked.length || wish.trim()
              ? "The nearest Mdeko trader who has your items sees the wave first."
              : "Tap an item above, then raise your hand."}
          </p>
        </div>
      )}

      {!order && orders.length > 0 && (
        <section className="px-4 pb-8">
          <h2 className="flex items-center gap-2 px-1 pt-6 pb-2 text-lg font-semibold">
            <History className="size-5 text-primary" /> Past orders
          </h2>
          <ul className="space-y-2">
            {orders.map((o) => {
              const trader = runners.find((r) => r.id === o.trader_id);
              return (
                <li key={o.id} className="rounded-2xl border px-4 py-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{trader?.name ?? "No trader"}</p>
                    <p className="font-display font-semibold">{formatRand(o.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {o.items?.length ?? 0} items · {o.status}
                    </span>
                    <Badge
                      variant={
                        o.status === "completed"
                          ? "default"
                          : o.status === "cancelled" || o.status === "failed"
                            ? "outline"
                            : "outline"
                      }
                      className="capitalize text-[0.65rem]"
                    >
                      {o.status}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <WavePayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        amount={order?.amount ?? 0}
        traderName={assignedTrader?.name ?? "your trader"}
        onPay={initiatePayment}
      />
    </main>
  );
}
