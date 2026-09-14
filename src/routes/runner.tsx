import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Hand, Camera, ArrowLeft, CheckCircle2, Wallet, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  SEED_RUNNERS,
  catalogWith,
  distanceKm,
  formatRand,
  priceFor,
  walkMinutes,
} from "@/lib/veggie-data";
import {
  cancelRequest,
  failRequest,
  updateState,
  useAppState,
  setBuyerLocation,
} from "@/lib/veggie-store";
import { useGeolocation } from "@/lib/use-geolocation";
import { useSession } from "@/lib/use-session";
import { createLogger } from "@/lib/logger";

const runnerLogger = createLogger("RunnerRoute");
import { useMdekoActions, useMyOrders, useMySettlements, useOpenWaves } from "@/lib/use-mdeko";
import { useReportCourierPosition } from "@/lib/use-courier-tracking";
import { useWeatherWarning } from "@/lib/use-weather";
import { useRoute } from "@/lib/use-route";
import { useCompass } from "@/lib/use-compass";
import StockEditor from "@/components/StockEditor";
import DemandInsights from "@/components/DemandInsights";
import BrandMark from "@/components/BrandMark";
import OrderStepper from "@/components/OrderStepper";

const VeggieMap = lazy(() => import("@/components/VeggieMap"));

export const Route = createFileRoute("/runner")({
  head: () => ({
    meta: [
      { title: "Trader stall — Mdeko · Veggie Wave" },
      {
        name: "description",
        content:
          "Go online as a township veggie trader on Mdeko, set your stock and prices, see who is waving nearby and get paid with MTN MoMo.",
      },
      { property: "og:title", content: "Trader stall — Mdeko · Veggie Wave" },
      {
        property: "og:description",
        content: "Set your stock and prices, see waves nearby, deliver and get paid with MTN MoMo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RunnerPage,
});

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse bg-muted" />;
}

const MY_ID = "r1";

function RunnerPage() {
  runnerLogger.info("RunnerPage rendering");
  const state = useAppState();
  // Use targeted selectors so stock/runner changes trigger re-renders
  const runners = useAppState((s) => s.runners);
  const stateCustomItems = useAppState((s) => s.customItems);
  const stateRequest = useAppState((s) => s.request);
  const stateBuyer = useAppState((s) => s.buyer);
  runnerLogger.debug("Runner state", {
    runnersCount: runners.length,
    hasRequest: !!stateRequest,
    buyerLocated: stateBuyer.located,
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const session = useSession();
  const signedIn = Boolean(session.userId);
  const myId = state.me.id !== "" ? state.me.id : MY_ID;
  const me =
    runners.find((r) => r.id === myId) ??
    runners.find((r) => r.id === MY_ID) ??
    SEED_RUNNERS.find((r) => r.id === MY_ID) ??
    SEED_RUNNERS[0];

  // Get active delivery order for this trader
  const { data: myOrders } = useMyOrders(signedIn);
  const activeDeliveryOrder = useMemo(() => {
    return (
      myOrders?.find(
        (o) =>
          o.trader_id === (session.userId || myId) &&
          ["accepted", "preparing", "ready", "delivering"].includes(o.status),
      ) ?? null
    );
  }, [myOrders, session.userId, myId]);

  // Start live position reporting when delivering
  const { isReporting, currentPosition: courierCurrentPosition } = useReportCourierPosition(
    activeDeliveryOrder?.id ?? null,
    activeDeliveryOrder?.status === "delivering",
    5000, // 5 seconds throttle
    10, // 10 meters minimum movement
  );

  // Get route from courier position to buyer
  const {
    route,
    shouldReroute,
    isLoading: routeLoading,
    recalculateRoute,
  } = useRoute(
    activeDeliveryOrder?.id ?? null,
    courierCurrentPosition,
    activeDeliveryOrder?.status === "delivering",
  );

  // Get compass bearing as fallback
  const bearing = useCompass(courierCurrentPosition, stateBuyer);

  // Weather warning for active delivery orders
  const { warning: weatherWarning } = useWeatherWarning(activeDeliveryOrder?.id ?? null);

  const onPosition = useCallback((pos: { lat: number; lng: number }) => {
    setBuyerLocation(pos);
    setRecenterTrigger((p) => p + 1);
    toast.success("Location updated");
  }, []);