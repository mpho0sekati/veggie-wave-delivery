import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState, useCallback, useEffect } from "react";
import { Hand, Camera, ArrowLeft, CheckCircle2, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { catalogWith, distanceKm, formatRand, priceFor, walkMinutes } from "@/lib/veggie-data";
import {
  setOnline,
  updateName,
  updateAvatar,
} from "@/lib/veggie-store-supabase";
import {
  listOpenWaves,
  acceptWave,
  advanceOrder,
  declineWave,
} from "@/lib/mdeko.functions";
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
          "Go online as a township veggie trader on Mdeko, set your own stock and prices, see who is waving nearby and get paid with MTN MoMo.",
      },
      { property: "og:title", content: "Trader stall — Mdeko · Veggie Wave" },
      {
        property: "og:description",
        content:
          "Set your stock and prices, see waves nearby and what people are asking for, deliver and get paid with MTN MoMo.",
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

function RunnerPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [waves, setWaves] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [online, setOnlineState] = useState(false);

  // Load trader data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // In real app, fetch from API
        setMe({
          id: "trader-1",
          name: "Your Name",
          avatar: null,
          online: false,
          earnings: 0,
          rating: 4.8,
          stock: [],
        });
      } catch (err) {
        console.error("Failed to load trader data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Poll for open waves
  useEffect(() => {
    if (!online || !me) return;
    const interval = setInterval(async () => {
      try {
        const openWaves = await listOpenWaves();
        setWaves(openWaves);
      } catch (err) {
        console.error("Failed to fetch waves", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [online, me]);

  if (!me) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading your stall…</p>
      </main>
    );
  }

  const catalog = catalogWith([]);
  const buyer = { lat: -33.9249, lng: 18.4241 };
  const km = distanceKm(buyer, { lat: order?.buyer_lat ?? -33.9249, lng: order?.buyer_lng ?? 18.4241 });

  const canFill = order
    ? order.items?.filter((line: any) => priceFor(me, line.id) !== null).length ?? 0
    : 0;
  const myTotal = order
    ? order.items?.reduce((sum: number, line: any) => sum + (priceFor(me, line.id) ?? 0) * line.qty, 0) ?? 0
    : 0;

  const onPickAvatar = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      try {
        await updateAvatar(dataUrl);
        toast.success("Profile picture saved");
      } catch (error) {
        toast.error("Failed to save picture");
      }
    };
    reader.readAsDataURL(file);
  };

  const onOnlineChange = useCallback(
    async (isOnline: boolean) => {
      try {
        await setOnline(isOnline);
        setOnlineState(isOnline);
        toast.success(isOnline ? "You're now online" : "You're now offline");
      } catch (error) {
        toast.error("Failed to update status");
      }
    },
    []
  );

  const saveName = useCallback(async () => {
    if (!name.trim()) return;
    try {
      await updateName(name.trim());
      setMe((prev: any) => ({ ...prev, name: name.trim() }));
      toast.success("Name updated");
    } catch (error) {
      toast.error("Failed to update name");
    }
  }, [name]);

  const accept = useCallback(async () => {
    if (!order) return;
    try {
      const accepted = await acceptWave({ data: { waveId: order.wave_id } });
      setOrder(accepted);
      toast.success("Wave accepted!");
    } catch (error) {
      toast.error("Failed to accept wave");
    }
  }, [order]);

  const decline = useCallback(async () => {
    if (!order) return;
    try {
      await declineWave({ data: { waveId: order.wave_id } });
      setOrder(null);
      toast.info("Wave declined");
    } catch (error) {
      toast.error("Failed to decline wave");
    }
  }, [order]);

  const markDelivering = useCallback(async () => {
    if (!order) return;
    try {
      const updated = await advanceOrder({ data: { orderId: order.id, status: "delivering" } });
      setOrder(updated);
      toast.success("On the way!");
    } catch (error) {
      toast.error("Failed to update status");
    }
  }, [order]);

  const markDelivered = useCallback(async () => {
    if (!order) return;
    try {
      const updated = await advanceOrder({ data: { orderId: order.id, status: "delivered" } });
      setOrder(updated);
      toast.success("Marked as delivered — awaiting payment");
    } catch (error) {
      toast.error("Failed to mark delivered");
    }
  }, [order]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="animate-rise flex items-center gap-2 px-4 pt-6 pb-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to buyer view">
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <BrandMark
          subtitle={`Trader stall · ${online ? "you're online" : "you're offline"}`}
          className="min-w-0"
        />
      </header>

      <Card className="mx-4 gap-4 p-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-primary bg-secondary"
            aria-label="Upload profile picture"
          >
            {me.avatar ? (
              <img src={me.avatar} alt="Your profile" className="size-full object-cover" />
            ) : (
              <Camera className="absolute inset-0 m-auto size-6 text-primary" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => onPickAvatar(e.target.files?.[0])}
          />
          <div className="flex-1 space-y-2">
            <Label htmlFor="runner-name">Your name</Label>
            <div className="flex gap-2">
              <Input
                id="runner-name"
                placeholder={me.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button variant="secondary" onClick={saveName}>
                Save
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <Label htmlFor="online">Available for deliveries</Label>
          <Switch id="online" checked={online} onCheckedChange={onOnlineChange} />
        </div>
        <div className="flex items-center justify-between rounded-xl border px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="size-4 text-primary" /> Earnings today
          </span>
          <span className="font-display font-semibold">{formatRand(me.earnings ?? 0)}</span>
        </div>
      </Card>

      <section className="relative mx-4 mt-4 h-56 overflow-hidden rounded-3xl border shadow-lift">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <VeggieMap
              runners={[me]}
              activeRunnerId={order?.trader_id ?? null}
              waving={order?.status === "creating"}
              buyerPosition={buyer}
            />
          </Suspense>
        </ClientOnly>
      </section>

      <h2 className="mt-6 px-5 text-lg font-semibold">Waves near you</h2>
      <div className="px-4 pt-3">
        {!order && waves.length === 0 && (
          <Card className="items-center gap-2 p-8 text-center">
            <Hand className="size-8 text-muted-foreground" />
            <p className="font-semibold">No hands up right now</p>
            <p className="text-sm text-muted-foreground">
              {online
                ? "Keep your stall online — the next wave nearby lands here."
                : "Switch on 'Available for deliveries' so nearby waves reach you."}
            </p>
          </Card>
        )}

        {order && (
          <Card className="animate-rise gap-4 p-5">
            <OrderStepper
              status={
                order.status as
                  | "waving"
                  | "accepted"
                  | "delivered"
                  | "paid"
                  | "cancelled"
                  | "failed"
                  | "refunded"
              }
            />
            <div className="flex items-center gap-2">
              <Hand className={`size-5 text-accent ${order.status === "creating" ? "animate-wave" : ""}`} />
              <p className="font-semibold">
                {order.status === "creating" && "Someone is waving"}
                {order.status === "accepted" && "You accepted — prepare for delivery"}
                {order.status === "delivering" && "On the way to customer"}
                {order.status === "delivered" && "Waiting for payment"}
                {order.status === "completed" && "Order complete"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {km.toFixed(1)} km away · about {walkMinutes(km)} min walk · you can fill {canFill}/
              {order.items?.length ?? 0}
            </p>
            <ul className="space-y-1 text-sm">
              {order.items?.map((line: any) => {
                const item = catalog.find((c) => c.id === line.id);
                if (!item) return null;
                const Icon = item.icon;
                const price = priceFor(me, line.id);
                return (
                  <li key={line.id} className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <span className={price === null ? "text-muted-foreground line-through" : ""}>
                      {line.qty} × {item.name} ({item.unit})
                    </span>
                    {price === null && (
                      <span className="text-xs text-muted-foreground">not in your stock</span>
                    )}
                  </li>
                );
              })}
              {order.wish && (
                <li className="text-muted-foreground italic">also asked for: {order.wish}</li>
              )}
            </ul>
            <p className="font-display text-xl font-bold">
              {formatRand(order.status === "creating" ? myTotal : order.amount)}
            </p>

            {order.status === "creating" && (
              <Button
                size="lg"
                onClick={accept}
                disabled={canFill === 0 || loading}
              >
                {canFill === 0 ? "Nothing you stock" : "Accept this wave"}
              </Button>
            )}
            {order.status === "accepted" && (
              <div className="space-y-2">
                <Button
                  size="lg"
                  variant="wave"
                  className="w-full"
                  onClick={markDelivering}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  I&apos;m on my way
                </Button>
                <Button size="sm" variant="outline" onClick={decline} disabled={loading}>
                  Can&apos;t deliver
                </Button>
              </div>
            )}
            {order.status === "delivering" && (
              <Button
                size="lg"
                variant="wave"
                className="w-full"
                onClick={markDelivered}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                I&apos;ve arrived — request payment
              </Button>
            )}
            {order.status === "delivered" && (
              <p className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm">
                <Wallet className="size-4 text-primary" /> Waiting for customer payment via MTN MoMo...
              </p>
            )}
          </Card>
        )}
      </div>

      <StockEditor
        runnerId={me.id}
        stock={me.stock ?? []}
        customItems={[]}
        highlightItemId={highlight}
      />

      <DemandInsights state={{ runners: [me], request: order, orders: [], demand: [], customItems: [], wallet: { balance: 0, pin: "" }, buyer: { ...buyer, located: true }, me, userId: me.id }} runnerId={me.id} onAdded={setHighlight} />

      <div className="h-8" />
    </main>
  );
}