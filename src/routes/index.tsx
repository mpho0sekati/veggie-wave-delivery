import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Hand,
  ChevronDown,
  Search,
  Salad,
  Bike,
  ArrowLeft,
  Star,
  Store,
  MapPin,
  CheckCircle2,
  Crosshair,
  Wallet,
  History,
  Clock,
  ChevronUp,
  Loader2,
  WifiOff,
  CloudUpload,
  MessageCircle,
  ShoppingBasket,
  Truck,
} from "lucide-react";
import AppTabBar from "@/components/AppTabBar";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  setBuyerLocation,
  updateState,
  useAppState,
} from "@/lib/veggie-store";
import { useMarketplace } from "@/lib/use-marketplace";
import { nearbyTraders } from "@/lib/nearby-traders";
import { waveView } from "@/lib/wave-view";
import { useGeolocation } from "@/lib/use-geolocation";
import { PROVINCES, searchAreas, type Area } from "@/lib/areas";
import { useSession, signOutEverywhere } from "@/lib/use-session";
import { useMdekoActions, useMyOrders, useMyWave } from "@/lib/use-mdeko";
import { useCourierPositions } from "@/lib/use-courier-tracking";
import { useWeatherWarning } from "@/lib/use-weather";
import WavePayDialog from "@/components/WavePayDialog";
import { track } from "@/lib/track";
import JourneyProgress from "@/components/JourneyProgress";
import { buyerJourneyStep } from "@/lib/journey-progress";
import DescribeOrder from "@/components/DescribeOrder";
import ProducePicker from "@/components/ProducePicker";
import DeliveryCelebration, { useDeliveryCelebrations } from "@/components/DeliveryCelebration";
import { hasArrived } from "@/lib/delivery-celebrations";
import { addToOfflineQueue, type QueuedOrder } from "@/lib/offline-queue";
import { useOnline } from "@/lib/use-online";
import { useOfflineQueueCount, useOfflineSync } from "@/lib/use-offline-sync";

const VeggieMap = lazy(() => import("@/components/VeggieMap"));

// Matches the 10-minute server-side wave expiry (migration 0009).
const WAVE_TIMEOUT_MS = 600_000;

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
  const buyer = useAppState((s) => s.buyer);
  const { error: marketplaceError } = useMarketplace(buyer);
  const walletBalance = useAppState((s) => s.wallet.balance);
  const communityCredit = useAppState((s) => s.wallet.stokvel_credit);
  const runners = useAppState((s) => s.runners);
  const request = useAppState((s) => s.request);
  const orders = useAppState((s) => s.orders);
  const customItems = useAppState((s) => s.customItems);

  // Cart persists in localStorage so signing in never wipes the buyer's basket.
  const [qty, setQty] = useState<Record<string, number>>({});
  const [wish, setWish] = useState("");
  const [landmark, setLandmark] = useState("");
  const [cartReady, setCartReady] = useState(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem("mdeko-cart-qty") || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        setQty(
          Object.fromEntries(
            Object.entries(saved).filter(
              ([, value]) => typeof value === "number" && Number.isFinite(value) && value > 0,
            ),
          ),
        );
      }
      setWish(window.localStorage.getItem("mdeko-cart-wish") || "");
      setLandmark(window.localStorage.getItem("mdeko-landmark") || "");
    } catch {
      /* storage blocked or stale: start with an empty cart */
    }
    setCartReady(true);
  }, []);
  const [payOpen, setPayOpen] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [payLoading, setPayLoading] = useState(false);
  const isOnline = useOnline();
  const queuedCount = useOfflineQueueCount();

  // Save the cart on every change so it survives sign-in redirects and refreshes.
  useEffect(() => {
    if (!cartReady) return;
    try {
      window.localStorage.setItem("mdeko-cart-qty", JSON.stringify(qty));
    } catch {
      /* storage blocked */
    }
  }, [qty, cartReady]);
  useEffect(() => {
    if (!cartReady) return;
    try {
      window.localStorage.setItem("mdeko-cart-wish", wish);
    } catch {
      /* storage blocked */
    }
  }, [wish, cartReady]);
  useEffect(() => {
    if (!cartReady) return;
    try {
      window.localStorage.setItem("mdeko-landmark", landmark);
    } catch {
      /* storage blocked */
    }
  }, [landmark, cartReady]);

  const onPosition = useCallback((pos: { lat: number; lng: number }) => {
    setBuyerLocation(pos);
  }, []);
  const { status: geoStatus, locate, stop, message: geoMessage } = useGeolocation(onPosition);

  const navigate = useNavigate();
  const session = useSession();
  const signedIn = Boolean(session.userId);
  const actions = useMdekoActions();
  const waveQuery = useMyWave(signedIn);
  const ordersQuery = useMyOrders(signedIn);
  const liveWave = waveQuery.data;
  const liveOrders = ordersQuery.data;

  // When a saved offline wave reaches the server, show it as a live wave on this phone.
  const handleSynced = useCallback((order: QueuedOrder, waveId: string, createdAt: string) => {
    updateState((prev) => ({
      ...prev,
      request: {
        id: waveId,
        waveId,
        items: order.items,
        wish: order.wish,
        total: order.total ?? 0,
        note: order.note,
        status: "waving",
        runnerId: null,
        createdAt: new Date(createdAt).getTime(),
      },
    }));
    toast.success("Back online — your saved wave was sent to traders");
  }, []);
  useOfflineSync(handleSynced);

  // Mirror the saved wave/order from the backend onto the card, so the buyer sees
  // the trader's progress on this phone without refreshing.
  const liveOrder = useMemo(() => {
    if (!liveWave || !liveOrders) return null;
    return liveOrders.find((o) => o.wave_id === liveWave.id) ?? null;
  }, [liveWave, liveOrders]);

  const celebration = useDeliveryCelebrations(signedIn ? liveOrder : null);

  // Live courier tracking for active delivery orders
  const {
    latestPosition: courierPosition,
    setBuyerPosition,
    isDisconnected,
  } = useCourierPositions(liveOrder?.status === "delivering" ? liveOrder.id : null);

  const assigned: Runner | null = runners.find((r) => r.id === request?.runnerId) ?? null;

  // Weather warning for active delivery orders
  const { warning: weatherWarning } = useWeatherWarning(liveOrder?.id ?? null);

  // Update buyer position for ETA calculation
  useEffect(() => {
    if (buyer.located) {
      setBuyerPosition({ lat: buyer.lat, lng: buyer.lng });
    }
  }, [buyer.lat, buyer.lng, buyer.located, setBuyerPosition]);

  const [closedWave, setClosedWave] = useState<string | null>(null);
  useEffect(() => setClosedWave(localStorage.getItem("mdeko-closed-wave")), []);
  useEffect(() => {
    if (session.loading) return;
    if (!signedIn || (waveQuery.isSuccess && !liveWave)) {
      updateState((prev) => ({ ...prev, request: null }));
      return;
    }
    if (!liveWave) return;
    if (liveWave.id === closedWave || localStorage.getItem("mdeko-closed-wave") === liveWave.id) {
      updateState((prev) => ({ ...prev, request: null }));
      return;
    }
    if (
      liveWave.status === "expired" ||
      liveWave.status === "declined" ||
      liveOrder?.cancelled_at
    ) {
      updateState((prev) => ({ ...prev, request: null }));
      return;
    }
    updateState((prev) => ({ ...prev, request: waveView(liveWave, liveOrder) }));
  }, [signedIn, session.loading, waveQuery.isSuccess, liveWave, liveOrder, closedWave]);

  const catalog = useMemo(() => catalogWith(customItems), [customItems]);
  const online = useMemo(() => nearbyTraders(runners, buyer), [runners, buyer]);
  // Demo barrows drift around the map so it never looks empty. Map-only: they
  // are never listed, ranked or orderable.
  const [demoTick, setDemoTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setDemoTick((t) => t + 1), 3000);
    return () => window.clearInterval(id);
  }, []);
  const demoRunners = useMemo<Runner[]>(() => {
    const names = ["Mama Thandi", "Sipho", "Lerato", "Bra Joe", "Nomsa", "Tumi"];
    return names.map((name, i) => {
      const angle = (i / names.length) * Math.PI * 2 + demoTick * 0.04 * (i % 2 ? 1 : -1);
      const radius = 0.006 + (i % 3) * 0.004;
      return {
        id: `demo-${i}`,
        name,
        lat: buyer.lat + Math.sin(angle) * radius,
        lng: buyer.lng + Math.cos(angle) * radius,
        online: true,
        rating: 4.5 + (i % 5) / 10,
        avatar: null,
        stock: [],
        earnings: 0,
      };
    });
  }, [buyer.lat, buyer.lng, demoTick]);
  const mapRunners = useMemo(() => {
    const real =
      assigned && !online.some((r) => r.id === assigned.id) ? [...online, assigned] : online;
    return request ? real : [...real, ...demoRunners];
  }, [online, assigned, demoRunners, request]);
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
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [mapOnly, setMapOnly] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaName, setAreaName] = useState<string | null>(null);
  const chooseArea = (a: Area) => {
    stop();
    onPosition({ lat: a.lat, lng: a.lng });
    setAreaName(a.name);
    setAreaOpen(false);
    setAreaQuery("");
    setRecenterTrigger((p) => p + 1);
    toast.success(`Showing ${a.name}`);
  };
  const [describeOpen, setDescribeOpen] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);
  // Uber behaviour: only once the trader is on the way does the drawer shrink to a slim
  // tracking bar. When an order is accepted the buyer must choose how to pay, so keep it open.
  useEffect(() => {
    setIsCollapsed(hasRequest && request?.status === "delivering");
  }, [hasRequest, request?.status]);

  const best = ranked[0] ?? null;
  const total = best?.total ?? 0;

  const clearSavedCart = useCallback(() => {
    try {
      window.localStorage.removeItem("mdeko-cart-qty");
      window.localStorage.removeItem("mdeko-cart-wish");
    } catch {
      /* storage blocked */
    }
  }, []);

  const bump = useCallback(
    (id: string, delta: number) =>
      setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) })),
    [],
  );

  const wave = useCallback(async () => {
    if (!picked.length) {
      toast.error("Pick at least one veggie; your extra request goes with it");
      return;
    }
    if (!buyer.located) {
      locate();
      toast.info("Set your delivery pin first — use your location or choose an area");
      return;
    }
    if (!signedIn) {
      toast.error("Sign in first so traders can reach you");
      navigate({ to: "/auth" });
      return;
    }

    const items = picked.map((p) => ({ id: p.id, qty: qty[p.id] ?? 0 }));

    // No connection: save the wave on the phone — it sends itself when we're back online.
    if (!isOnline) {
      addToOfflineQueue({
        id: crypto.randomUUID(),
        items,
        wish: wish.trim(),
        lat: buyer.located ? buyer.lat : null,
        lng: buyer.located ? buyer.lng : null,
        note: landmark.trim() || `${picked.length} items`,
        total,
        createdAt: Date.now(),
      });
      logDemand([
        ...picked.map((p) => ({ itemId: p.id, label: p.name })),
        ...(wish.trim() ? [{ itemId: null, label: wish.trim().toLowerCase() }] : []),
      ]);
      setQty({});
      setWish("");
      clearSavedCart();
      toast.success("You're offline — request saved. It sends itself when you're back online.");
      return;
    }

    try {
      track("wave_placed", `${picked.length} items`);
      const saved = await actions.createWave.mutateAsync({
        items,
        wish: wish.trim(),
        note: landmark.trim() || `${picked.length} items`,
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
          landmark: landmark.trim() || undefined,
          status: "waving",
          runnerId: null,
          createdAt: new Date(saved.created_at).getTime(),
        },
      }));
      logDemand([
        ...picked.map((p) => ({ itemId: p.id, label: p.name })),
        ...(wish.trim() ? [{ itemId: null, label: wish.trim().toLowerCase() }] : []),
      ]);
      clearSavedCart();
      toast.success("Hand raised — traders nearby can see you waving");
    } catch (err) {
      console.error("[mdeko] wave failed", err);
      toast.error("Could not send your wave — please try again");
    }
  }, [
    picked,
    wish,
    total,
    qty,
    signedIn,
    navigate,
    actions.createWave,
    buyer,
    isOnline,
    landmark,
    locate,
    clearSavedCart,
  ]);

  const waveAgain = useCallback(async () => {
    if (!request) return;
    try {
      await actions.createWave.mutateAsync({
        items: request.items,
        wish: request.wish,
        note: request.note,
        lat: buyer.lat,
        lng: buyer.lng,
      });
      toast.success("New wave sent");
    } catch {
      toast.error("Could not send another wave");
    }
  }, [request, actions.createWave, buyer]);
  const cancel = useCallback(async () => {
    if (!request?.waveId) return;
    try {
      await actions.cancelWave.mutateAsync(request.waveId);
      track("wave_cancelled", request.status);
      setClosedWave(request.waveId);
      cancelRequest();
      setQty({});
      setWish("");
      clearSavedCart();
      toast.info("Request cancelled");
    } catch {
      toast.error("This order has payment or delivery in progress and cannot be cancelled");
    }
  }, [request, actions.cancelWave, clearSavedCart]);
  const finish = useCallback(() => {
    if (liveOrder?.status !== "completed") return;
    setClosedWave(request?.waveId ?? null);
    if (request?.waveId) localStorage.setItem("mdeko-closed-wave", request.waveId);
    archiveRequest();
    setQty({});
    setWish("");
  }, [request, liveOrder?.status]);
  const timedOut =
    request?.status === "waving" && Date.now() - (request?.createdAt ?? 0) > WAVE_TIMEOUT_MS;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <DeliveryCelebration moment={celebration.moment} onDone={celebration.dismiss} />
      {/* Full screen edge-to-edge Leaflet map */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <VeggieMap
              runners={mapRunners}
              activeRunnerId={request?.runnerId ?? selectedRunnerId ?? null}
              waving={request?.status === "waving"}
              buyerPosition={buyer}
              buyerLocated={buyer.located}
              delivered={Boolean(request && hasArrived(liveOrder))}
              courierPosition={courierPosition}
              isGpsDisconnected={isDisconnected}
              recenterTrigger={recenterTrigger}
              onPickPosition={(pos) => {
                stop();
                onPosition(pos);
                toast.success("Map pin updated");
              }}
            />
          </Suspense>
        </ClientOnly>
      </div>

      {/* Always-visible icon bar — nothing hidden in a menu */}
      <header className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 mx-auto max-w-lg space-y-2">
        <AppTabBar
          signedIn={signedIn}
          onSignOut={signOutEverywhere}
          onHelp={() => setDescribeOpen(true)}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pr-12">
          <Button
            type="button"
            variant="outline"
            onClick={() => setAreaOpen(true)}
            aria-label="Change area"
            className="h-11 min-w-0 justify-start gap-1.5 rounded-full bg-background/95 px-3 text-xs font-medium shadow-sm"
          >
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {geoStatus === "locating" && !areaName
                ? "Finding you…"
                : `${areaName ?? (buyer.located ? "Near me" : "Choose area")} · ${online.length} traders`}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
          <Link
            to="/finance"
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border bg-background/95 px-3 text-xs font-semibold shadow-sm"
          >
            <Wallet className="size-4 text-primary" />
            {formatRand(walletBalance + communityCredit)}
          </Link>
        </div>
      </header>

      <Dialog open={areaOpen} onOpenChange={setAreaOpen}>
        <DialogContent className="max-h-[85dvh] max-w-sm overflow-y-auto">
          <DialogTitle>Change area</DialogTitle>
          <DialogDescription>Pick a township to see barrows there.</DialogDescription>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder="Search township"
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={() => {
              setAreaName(null);
              setAreaOpen(false);
              locate();
              setRecenterTrigger((p) => p + 1);
            }}
          >
            <Crosshair className="size-4" /> Use my location
          </Button>
          {PROVINCES.map((prov) => {
            const list = searchAreas(areaQuery).filter((a) => a.province === prov);
            if (!list.length) return null;
            return (
              <div key={prov} className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {prov}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {list.map((a) => (
                    <Button
                      key={a.name}
                      variant={areaName === a.name ? "default" : "secondary"}
                      className="h-auto min-h-11 min-w-0 justify-start gap-1.5 whitespace-normal break-words px-2 py-2 text-xs [&_svg]:shrink-0"
                      onClick={() => chooseArea(a)}
                    >
                      <MapPin className="size-4" /> {a.name}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </DialogContent>
      </Dialog>

      {/* Floating map controls */}
      <div className="absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+4.75rem)] right-4 z-10 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="size-11 rounded-full border shadow-lg backdrop-blur-md"
          onClick={() => {
            locate();
            setRecenterTrigger((p) => p + 1);
          }}
          aria-label="Find my location"
          title="Find my location"
        >
          <Crosshair className="size-5" />
        </Button>
      </div>

      {/* Offline notice — waves are saved on the phone and sent on reconnect */}
      {!isOnline && (
        <div className="absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+8rem)] z-10 mx-auto flex max-w-lg items-center justify-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-md">
          <WifiOff className="size-4 shrink-0 text-destructive" />
          No internet · your wave will be saved
        </div>
      )}

      {/* Floating bottom drawer — collapses to a slim tracking bar during delivery */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 mx-auto flex max-h-[calc(100dvh-9.5rem)] w-full max-w-lg flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-2xl transition-[height] duration-300 ease-out motion-reduce:transition-none sm:bottom-4 sm:rounded-2xl sm:border ${
          (request && isCollapsed) || (!request && mapOnly)
            ? "h-auto"
            : request
              ? "h-auto"
              : sheetExpanded
                ? "h-[88dvh]"
                : "h-[62dvh]"
        }`}
      >
        {!request && mapOnly ? (
          <Button
            variant="ghost"
            onClick={() => setMapOnly(false)}
            className="h-auto w-full justify-start gap-3 px-5 py-3 text-left"
            aria-label="Show veggies"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
              <Salad className="size-6 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Pick veggies</span>
              <span className="block text-xs text-muted-foreground">Tap to open your basket</span>
            </span>
            <ChevronUp className="size-5 shrink-0 text-muted-foreground" />
          </Button>
        ) : request && isCollapsed ? (
          <Button
            variant="ghost"
            onClick={() => setIsCollapsed(false)}
            className="h-auto w-full justify-start gap-3 whitespace-normal px-5 py-3 text-left"
            aria-expanded="false"
            aria-label="Show order details"
          >
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
              {request.status === "waving" ? (
                <Hand className="size-6 text-primary" />
              ) : (
                <Bike className="size-6 text-primary" />
              )}
              {request.status === "waving" && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {request.status === "waving"
                  ? "Waving… waiting for a trader"
                  : request.status === "accepted" && liveOrder?.payment_method !== "cash"
                    ? "Order accepted! Tap to pay"
                    : request.status === "delivered"
                      ? "Delivered — tap to confirm"
                      : courierPosition
                        ? `${assigned?.name ?? "Your trader"} is on the way`
                        : "Waiting for your trader's location…"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatRand(request.total)} · tap for details
              </p>
            </div>
            {courierPosition && (
              <div className="shrink-0 text-right">
                <p className="font-display text-2xl font-bold leading-none text-primary">
                  {courierPosition.etaMinutes}
                  <span className="text-xs font-medium text-muted-foreground"> min</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistance(courierPosition.distanceKm)}
                </p>
              </div>
            )}
            <ChevronUp className="size-5 shrink-0 text-muted-foreground" />
          </Button>
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-3 py-2 sm:px-4">
              <div className="min-w-0">
                <h1 className="text-base font-semibold leading-5 sm:text-lg">
                  {request ? "Your wave" : "Fresh veggies, delivered"}
                </h1>
                {!request && (
                  <p className="truncate text-xs text-muted-foreground">
                    {buyer.located
                      ? `${ranked.length} traders nearby${geoStatus === "approximate" ? " · location is approximate" : ""}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {!request && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-11 px-2"
                    onClick={() => setMapOnly(true)}
                    aria-label="Hide and show the full map"
                  >
                    <MapPin /> Map
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11"
                  onClick={() => (request ? setIsCollapsed(true) : setSheetExpanded((v) => !v))}
                  aria-expanded={request ? true : sheetExpanded}
                  aria-label={
                    request ? "Minimize order details" : sheetExpanded ? "Show less" : "Show more"
                  }
                >
                  <ChevronUp
                    className={`size-5 transition-transform motion-reduce:transition-none ${sheetExpanded ? "rotate-180" : ""}`}
                  />
                </Button>
              </div>
            </div>
            <JourneyProgress
              label="Your veggie journey"
              steps={[
                { label: "Pick veggies", icon: ShoppingBasket },
                { label: "Wave", icon: Hand },
                { label: "Delivery", icon: Truck },
                { label: "Received", icon: CheckCircle2 },
              ]}
              current={buyerJourneyStep(Boolean(picked.length || wish.trim()), request?.status)}
              className="shrink-0 border-b px-4 py-2"
            />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
              <div className="px-1 pb-5">
                {request && geoMessage && (
                  <p className="mx-4 mt-2 text-xs text-muted-foreground">{geoMessage}</p>
                )}

                {!request && (
                  <>
                    {!buyer.located && (
                      <Button
                        variant="ghost"
                        className="mx-4 mt-2 h-11 justify-start px-0 text-primary"
                        onClick={locate}
                        disabled={geoStatus === "locating"}
                      >
                        {geoStatus === "locating" ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <MapPin />
                        )}
                        {geoStatus === "locating" ? "Finding you…" : "Set my location"}
                      </Button>
                    )}
                    {geoMessage && (
                      <p className="mx-4 mt-1 text-xs text-muted-foreground" role="status">
                        {geoMessage}
                      </p>
                    )}
                    <ProducePicker
                      catalog={catalog}
                      quantities={qty}
                      traders={online}
                      onChange={bump}
                    />

                    <details className="mx-4 mt-4 border-t pt-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Can't find what you need?
                      </summary>
                      <div className="mx-4 mt-4 space-y-2">
                        <Label htmlFor="wish">Something else?</Label>
                        <Input
                          id="wish"
                          placeholder="e.g. blueberries"
                          value={wish}
                          onChange={(e) => setWish(e.target.value)}
                        />
                      </div>
                    </details>
                    <details className="mx-4 mt-4 border-t pt-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Add a delivery note
                      </summary>
                      <div className="mx-4 mt-4 space-y-2">
                        <Label htmlFor="landmark" className="flex items-center gap-2">
                          <MapPin className="size-4 text-primary" /> Where should they find you?
                        </Label>
                        <Input
                          id="landmark"
                          placeholder="e.g. opposite the blue container spaza"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                        />
                      </div>
                    </details>
                    <details className="mt-4 border-t pt-3">
                      <summary className="mx-4 cursor-pointer text-sm font-medium">
                        Traders near you · {ranked.length}
                      </summary>

                      {ranked.length === 0 ? (
                        <Card className="mx-4 mt-2 items-center gap-2 p-8 text-center">
                          <Store className="size-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {!signedIn
                              ? "Sign in to see traders near you."
                              : !buyer.located
                                ? "Set your location to see traders near you."
                                : "No Mdeko trader is online around you yet. Pick what you need anyway."}
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
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/10 shadow-glow ring-2 ring-primary/30"
                                    : index === 0
                                      ? "border-primary bg-secondary"
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
                                  <div className="flex items-center gap-2 truncate font-semibold">
                                    {runner.name}
                                    {bestMatch && (
                                      <Badge className="shrink-0" variant="default">
                                        best match
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="size-3.5 text-primary" />{" "}
                                      {formatDistance(km)} away
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="size-3.5" /> about {etaMin} min
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Star className="size-3.5 text-accent" />{" "}
                                      {runner.rating.toFixed(1)}
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
                    </details>
                  </>
                )}

                {request && (
                  <Card className="animate-rise animate-slide-up mx-4 mt-4 gap-4 p-5">
                    <div className="flex items-center gap-2">
                      {request.status === "waving" && (
                        <>
                          <Hand className="size-5 animate-wave text-accent" />
                          <p className="font-semibold">Waving… waiting for a trader</p>
                        </>
                      )}
                      {(request.status === "accepted" || request.status === "delivering") && (
                        <>
                          <MapPin className="size-5 text-primary" />
                          <div>
                            <p className="font-semibold">
                              {request.status === "accepted"
                                ? `Order accepted by ${assigned?.name ?? "your trader"}!`
                                : `${assigned?.name ?? "Your trader"} is on the way`}
                            </p>
                            {request.status === "accepted" &&
                            liveOrder?.payment_method !== "cash" &&
                            liveOrder?.status === "accepted" ? (
                              <p className="text-xs text-muted-foreground">
                                Choose how to pay below so they can start delivering
                              </p>
                            ) : courierPosition ? (
                              <p className="text-xs text-muted-foreground">
                                ~{courierPosition.etaMinutes} min ·{" "}
                                {formatDistance(courierPosition.distanceKm)} away
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {request.status === "accepted"
                                  ? liveOrder?.payment_method === "cash"
                                    ? "Cash selected · your trader is preparing your veggies"
                                    : "Payment approved · your trader is preparing your veggies"
                                  : "Waiting for their live location…"}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                      {request.status === "delivered" && (
                        <>
                          <CheckCircle2 className="size-5 text-primary" />
                          <p className="font-semibold">Delivered — confirm received</p>
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

                    {/* WhatsApp the trader once they've accepted — township coordination by landmark */}
                    {(request.status === "accepted" || request.status === "delivering") &&
                      assigned?.phone && (
                        <a
                          href={`https://wa.me/${assigned.phone}?text=${encodeURIComponent(
                            `Hi ${assigned.name}, I waved for your veggies on Mdeko.${
                              request.landmark ? ` I'm at: ${request.landmark}.` : ""
                            } How far are you?`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm"
                        >
                          <MessageCircle className="size-5" /> WhatsApp {assigned.name}
                        </a>
                      )}

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
                    {request.landmark && (
                      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-4 shrink-0 text-primary" />
                        <span>Find me: {request.landmark}</span>
                      </p>
                    )}
                    <p className="font-display text-xl font-bold">
                      {request.status === "waving"
                        ? "Price confirmed when accepted"
                        : formatRand(request.total)}
                    </p>

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

                    {liveOrder &&
                      liveOrder.status === "accepted" &&
                      liveOrder.payment_method !== "cash" && (
                        <div className="space-y-2">
                          <Button className="w-full" onClick={() => setPayOpen(true)}>
                            Pay with MTN MoMo
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={async () => {
                              try {
                                await actions.chooseCash.mutateAsync(liveOrder.id);
                                toast.success("Cash on delivery selected");
                              } catch {
                                toast.error("Could not change payment method");
                              }
                            }}
                          >
                            Cash on delivery
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full text-xs text-muted-foreground"
                            disabled={actions.demoApprovePayment.isPending}
                            onClick={async () => {
                              try {
                                await actions.demoApprovePayment.mutateAsync({
                                  orderId: liveOrder.id,
                                });
                                toast.success(
                                  "Demo payment approved — your trader can start delivering",
                                );
                              } catch {
                                toast.error("Could not approve the demo payment");
                              }
                            }}
                          >
                            {actions.demoApprovePayment.isPending
                              ? "Approving…"
                              : "Demo: approve payment instantly (no real money)"}
                          </Button>
                        </div>
                      )}
                    {liveOrder?.payment_method === "cash" && request.status !== "paid" && (
                      <p className="text-sm text-muted-foreground">Cash on delivery selected</p>
                    )}
                    {request.status === "delivered" && (
                      <>
                        {liveOrder?.payment_method !== "cash" && (
                          <p className="text-sm text-primary">
                            Payment approved · confirm your veggies arrived
                          </p>
                        )}
                        <Button
                          variant="outline"
                          disabled={actions.confirmCash.isPending || actions.advanceOrder.isPending}
                          onClick={async () => {
                            if (!request.orderId) return;
                            try {
                              if (liveOrder?.payment_method === "cash")
                                await actions.confirmCash.mutateAsync(request.orderId);
                              else
                                await actions.advanceOrder.mutateAsync({
                                  orderId: request.orderId,
                                  status: "completed",
                                });
                              celebration.confirm(request.orderId);
                              track("cash_confirmed", liveOrder?.payment_method ?? "");
                              toast.success("Order completed");
                            } catch {
                              toast.error("Could not complete this order");
                            }
                          }}
                        >
                          {liveOrder?.payment_method === "cash"
                            ? "I paid cash"
                            : "Confirm received"}
                        </Button>
                      </>
                    )}

                    {request.status !== "paid" ? (
                      <Button variant="ghost" onClick={cancel}>
                        Cancel request
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <Button
                          size="lg"
                          variant="wave"
                          className="w-full shadow-glow"
                          onClick={finish}
                        >
                          <Hand className="animate-wave" /> Wave Again
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            finish();
                            setMapOnly(true);
                          }}
                        >
                          <ArrowLeft /> Back to map
                        </Button>
                      </div>
                    )}
                  </Card>
                )}

                {!request && orders.length > 0 && (
                  <details className="mx-4 mt-4 border-t pt-3 pb-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      My past orders · {orders.length}
                    </summary>
                    <h2 className="flex items-center gap-2 px-1 pt-6 pb-2 text-lg font-semibold">
                      <History className="size-5 text-primary" /> My past orders
                    </h2>
                    <ul className="space-y-2">
                      {orders.map((order) => {
                        const trader = runners.find((r) => r.id === order.runnerId);
                        return (
                          <li
                            key={order.id}
                            className="rounded-2xl border px-4 py-3 text-sm space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{trader?.name ?? "No trader"}</p>
                              <p className="font-display font-semibold">
                                {formatRand(order.total)}
                              </p>
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
                                    toast.info(
                                      "Refunds require a review with your trader; no money has been refunded",
                                    );
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
                  </details>
                )}
              </div>
            </div>

            {/* Fixed footer — the wave button is always reachable, never covering content */}
            {!request && (
              <div className="shrink-0 border-t bg-background/85 px-4 pt-2 pb-3 backdrop-blur-md">
                <p className="mb-2 text-center text-xs text-muted-foreground" role="status">
                  {marketplaceError || waveQuery.isError || ordersQuery.isError
                    ? "Connection interrupted — your saved order is safe"
                    : !buyer.located
                      ? "Choose your delivery area"
                      : picked.length
                        ? "Basket ready"
                        : "Your basket is empty"}
                </p>
                {(picked.length > 0 || wish.trim()) && (
                  <details className="mb-2 text-sm">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 py-1 font-medium">
                      <span>
                        {picked.reduce((sum, item) => sum + (qty[item.id] ?? 0), 0)} in your basket
                        {wish.trim() ? " · extra request" : ""}
                      </span>
                      <ChevronUp className="size-4 text-muted-foreground" />
                    </summary>
                    <ul className="max-h-24 space-y-1 overflow-y-auto py-2 text-muted-foreground">
                      {picked.map((item) => (
                        <li key={item.id}>
                          {qty[item.id]} × {item.name} · {item.unit}
                        </li>
                      ))}
                      {wish.trim() && <li>{wish.trim()}</li>}
                    </ul>
                    <p className="pb-2 text-xs text-muted-foreground">
                      {total > 0
                        ? "Estimated price, with delivery"
                        : "Your trader will confirm the price"}
                    </p>
                  </details>
                )}
                <Button
                  size="xl"
                  variant="wave"
                  className="shadow-glow w-full gap-2 px-3"
                  onClick={wave}
                  disabled={actions.createWave.isPending || (!picked.length && !wish.trim())}
                >
                  {actions.createWave.isPending ? <Loader2 className="animate-spin" /> : <Hand />}
                  {actions.createWave.isPending ? "Sending…" : "Raise my hand"}
                  {total > 0 ? ` · ${formatRand(total)}` : ""}
                </Button>
                {queuedCount > 0 && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
                    <CloudUpload className="size-3" /> {queuedCount} saved{" "}
                    {queuedCount === 1 ? "request" : "requests"} — sends automatically when you're
                    back online
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={describeOpen} onOpenChange={setDescribeOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>Make my veggie list</DialogTitle>
          <DialogDescription>What are you cooking or shopping for?</DialogDescription>
          <DescribeOrder
            catalog={catalog}
            unframed
            onApply={(items, extras) => {
              setQty(Object.fromEntries(items.map((l) => [l.id, l.qty])));
              setWish(extras.join(", "));
              setDescribeOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <WavePayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        amount={request?.total ?? 0}
        traderName={assigned?.name ?? "your trader"}
        onPay={async (msisdn) => {
          const orderId = request?.orderId;
          if (!orderId) {
            toast.error("Your trader has to accept the order before you can pay");
            throw new Error("order-not-accepted");
          }
          setPayLoading(true);
          const low = `Not enough money in MoMo? You need at least R${(request?.total ?? 0).toFixed(2)}. Top up or pay cash.`;
          track("payment_started", `momo:${request?.total ?? 0}`);
          try {
            // The amount is taken from the saved order on the server, never from this page.
            const started = await actions.startPayment.mutateAsync({ orderId, msisdn });
            if (started.status === "failed") {
              track("payment_failed", `rejected:${started.providerStatus ?? ""}`);
              toast.error(`MTN MoMo turned the request down. ${low}`, { duration: 8000 });
              setPayLoading(false);
              throw new Error("payment-rejected");
            }

            toast.success(`MoMo request sent to ${msisdn} — approve it on your phone`);
            setPayOpen(false);

            // Ask MTN what happened, every 2s for up to a minute.
            for (let i = 0; i < 30; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const result = await actions.verifyPayment(orderId);
              if (result?.status === "successful") {
                track("payment_completed", "momo");
                actions.refresh();
                toast.success("Payment approved — your trader can deliver");

                setPayLoading(false);
                return;
              }
              if (result?.status === "failed") {
                track("payment_failed", `declined:${result.providerStatus ?? ""}`);
                toast.error(`Payment was declined. ${low}`, { duration: 8000 });
                setPayLoading(false);
                return;
              }
            }
            track("payment_timeout");
            toast.error("No answer from MoMo. Check your phone for the PIN prompt, or pay cash.", {
              duration: 8000,
            });
          } catch (err) {
            console.error("[momo] payment error", err);
            toast.error(
              err instanceof Error && err.message.includes("momo-not-configured")
                ? "MTN MoMo is not connected yet. Choose cash on delivery."
                : `Payment did not go through. ${low}`,
            );
            throw err;
          } finally {
            setPayLoading(false);
          }
        }}
      />
    </main>
  );
}
