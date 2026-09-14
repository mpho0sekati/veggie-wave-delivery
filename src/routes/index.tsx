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
    toast.success("New location set on map");
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