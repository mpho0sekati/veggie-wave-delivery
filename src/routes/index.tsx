import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Hand,
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
  LogOut,
  Menu,
  WifiOff,
  CloudUpload,
  Wand2,
  MessageCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { waveView } from "@/lib/wave-view";
import { useGeolocation } from "@/lib/use-geolocation";
import { useSession, signOutEverywhere } from "@/lib/use-session";
import { useMdekoActions, useMyOrders, useMyWave } from "@/lib/use-mdeko";
import { useCourierPositions } from "@/lib/use-courier-tracking";
import { useWeatherWarning } from "@/lib/use-weather";
import WavePayDialog from "@/components/WavePayDialog";
import BrandMark from "@/components/BrandMark";
import OrderStepper from "@/components/OrderStepper";
import DescribeOrder from "@/components/DescribeOrder";
import ProducePicker from "@/components/ProducePicker";
import { addToOfflineQueue, type QueuedOrder } from "@/lib/offline-queue";
import { useOnline } from "@/lib/use-online";
import { useOfflineQueueCount, useOfflineSync } from "@/lib/use-offline-sync";

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
  useMarketplace();
  const walletBalance = useAppState((s) => s.wallet.balance);
  const communityCredit = useAppState((s) => s.wallet.stokvel_credit);
  const runners = useAppState((s) => s.runners);
  const request = useAppState((s) => s.request);
  const orders = useAppState((s) => s.orders);
  const customItems = useAppState((s) => s.customItems);
  const buyer = useAppState((s) => s.buyer);

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
    setRecenterTrigger((prev) => prev + 1);
  }, []);
  const { status: geoStatus, locate, stop, message: geoMessage } = useGeolocation(onPosition);

  const navigate = useNavigate();
  const session = useSession();
  const signedIn = Boolean(session.userId);
  const actions = useMdekoActions();
  const { data: liveWave } = useMyWave(signedIn);
  const { data: liveOrders } = useMyOrders(signedIn);

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
    if (!signedIn || !liveWave) return;
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
  }, [signedIn, liveWave, liveOrder, closedWave]);

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
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);
  // Uber behaviour: during a live delivery the drawer shrinks to a slim tracking bar
  // so the map stays the hero; it expands again when the wave needs a decision.
  useEffect(() => {
    setIsCollapsed(
      hasRequest && (request?.status === "accepted" || request?.status === "delivering"),
    );
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

    // No connection: save the wave on the phone — it sends itself when we're back online.
    if (!isOnline) {
      addToOfflineQueue({
        id: crypto.randomUUID(),
        items,
        wish: wish.trim(),
        lat: buyer.located ? buyer.lat : null,
        lng: buyer.located ? buyer.lng : null,
        note: `${picked.length} items`,
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
    setClosedWave(request?.waveId ?? null);
    if (request?.waveId) localStorage.setItem("mdeko-closed-wave", request.waveId);
    archiveRequest();
    setQty({});
    setWish("");
  }, [request]);
  const timedOut =
    request?.status === "waving" && Date.now() - (request?.createdAt ?? 0) > WAVE_TIMEOUT_MS;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      {/* Full screen edge-to-edge Leaflet map */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <VeggieMap
              runners={runners}
              activeRunnerId={request?.runnerId ?? selectedRunnerId ?? null}
              waving={request?.status === "waving"}
              buyerPosition={buyer}
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

      {/* Uber-style floating round menu button */}
      <header className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="size-12 rounded-full border bg-background shadow-lg"
              aria-label="Open menu"
            >
              <Menu className="size-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-2">
              <BrandMark
                subtitle={
                  geoStatus === "locating"
                    ? "Finding your location…"
                    : `${online.length} traders nearby`
                }
              />
            </div>
            <div className="border-t px-2 py-3 text-sm">
              <p className="flex justify-between gap-3">
                <span>Mdeko Pay</span>
                <strong>{formatRand(walletBalance)}</strong>
              </p>
              {communityCredit > 0 && (
                <p className="mt-1 flex justify-between gap-3 text-muted-foreground">
                  <span>Community Credit</span>
                  <span>{formatRand(communityCredit)}</span>
                </p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDescribeOpen(true)}>
              <Wand2 /> Help me make a list
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/runner">
                <Store /> Sell veggies
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/finance">
                <Wallet /> My Money
              </Link>
            </DropdownMenuItem>
            {signedIn ? (
              <DropdownMenuItem
                onClick={async () => {
                  await signOutEverywhere();
                  toast.success("Signed out");
                  navigate({ to: "/auth" });
                }}
              >
                <LogOut /> Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/auth">Sign in</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-10 -translate-x-1/2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm">
        <BrandMark />
      </div>

      {/* Floating map controls */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="size-10 rounded-full border shadow-lg backdrop-blur-md"
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
        <div className="absolute left-1/2 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border bg-background/95 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md">
          <WifiOff className="size-4 text-destructive" />
          No internet · your wave will be saved
        </div>
      )}

      {/* Floating bottom drawer — collapses to a slim tracking bar during delivery */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-2xl transition-[height] duration-300 ease-out motion-reduce:transition-none sm:bottom-4 sm:rounded-2xl sm:border ${
          request && isCollapsed
            ? "h-auto"
            : sheetExpanded || request
              ? "h-[88dvh]"
              : "h-[62dvh] max-h-[620px]"
        }`}
      >
        {request && isCollapsed ? (
          <Button
            variant="ghost"
            onClick={() => setIsCollapsed(false)}
            className="h-auto w-full justify-start gap-3 whitespace-normal px-5 py-3 text-left"
            aria-expanded="false"
            aria-label="Show order details"
          >
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl">
              {request.status === "waving" ? "👋" : "🚴"}
              {request.status === "waving" && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {request.status === "waving"
                  ? "Waving… waiting for a trader"
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
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold">
                  {request ? "Your wave" : "What do you need?"}
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
                <Button
                  size="icon"
                  variant="ghost"
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
                        {geoStatus === "locating" ? <Loader2 className="animate-spin" /> : <MapPin />}
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
                    <OrderStepper status={request.status} />
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
                              {assigned?.name ?? "Your trader"} is on the way
                            </p>
                            {courierPosition ? (
                              <p className="text-xs text-muted-foreground">
                                ~{courierPosition.etaMinutes} min ·{" "}
                                {formatDistance(courierPosition.distanceKm)} away
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Waiting for their live location…
                              </p>
                            )}
                          </div>
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
                        </div>
                      )}
                    {liveOrder?.payment_method === "cash" && request.status !== "paid" && (
                      <p className="text-sm text-muted-foreground">Cash on delivery selected</p>
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
                        {request.paidWith === "wave-pay" && (
                          <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-center space-y-0.5">
                            <p className="font-semibold text-primary">Community Credit earned</p>
                            <p className="text-xs text-muted-foreground">
                              +R0.50 added · Total: {formatRand(communityCredit)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Use toward future purchases
                            </p>
                          </div>
                        )}
                        <Button
                          size="lg"
                          variant="wave"
                          className="w-full shadow-glow"
                          onClick={finish}
                        >
                          <Hand className="animate-wave" /> Wave Again
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">
                          Need something else? The market is waiting.
                        </p>
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
                        <li key={item.id}>{qty[item.id]} × {item.name} · {item.unit}</li>
                      ))}
                      {wish.trim() && <li>{wish.trim()}</li>}
                    </ul>
                    <p className="pb-2 text-xs text-muted-foreground">
                      {total > 0 ? "Estimated price, with delivery" : "Your trader will confirm the price"}
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
          try {
            // The amount is taken from the saved order on the server, never from this page.
            const started = await actions.startPayment.mutateAsync({ orderId, msisdn });
            if (started.status === "failed") {
              toast.error("MTN MoMo turned the request down — try again");
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
                updateState((prev) => {
                  if (!prev.request) return prev;
                  return {
                    ...prev,
                    request: { ...prev.request, status: "paid", paidWith: "wave-pay" },
                  };
                });
                actions.refresh();
                toast.success("Payment confirmed! Enjoy your veggies");

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
            toast.error(
              err instanceof Error && err.message.includes("momo-not-configured")
                ? "MTN MoMo is not connected yet. Choose cash on delivery."
                : "Payment failed — please try again",
            );
            throw err;
          }
          setPayLoading(false);
        }}
      />
    </main>
  );
}
