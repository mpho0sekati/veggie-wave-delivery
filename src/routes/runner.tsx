import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState, useCallback } from "react";
import { Hand, Camera, ArrowLeft, CheckCircle2, Wallet, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { catalogWith, distanceKm, formatRand, priceFor, walkMinutes } from "@/lib/veggie-data";
import {
  cancelRequest, failRequest, updateState, useAppState,
  setBuyerLocation,
} from "@/lib/veggie-store";
import { useGeolocation } from "@/lib/use-geolocation";
import StockEditor from "@/components/StockEditor";
import DemandInsights from "@/components/DemandInsights";
import BrandMark from "@/components/BrandMark";
import OrderStepper from "@/components/OrderStepper";

const VeggieMap = lazy(() => import("@/components/VeggieMap"));

export const Route = createFileRoute("/runner")({
  head: () => ({
    meta: [
      { title: "Trader stall — Mdeko · Veggie Wave" },
      { name: "description", content: "Go online as a township veggie trader on Mdeko, set your stock and prices, see who is waving nearby and get paid with MTN MoMo." },
      { property: "og:title", content: "Trader stall — Mdeko · Veggie Wave" },
      { property: "og:description", content: "Set your stock and prices, see waves nearby, deliver and get paid with MTN MoMo." },
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
  const state = useAppState();
  // Use targeted selectors so stock/runner changes trigger re-renders
  const runners = useAppState((s) => s.runners);
  const stateCustomItems = useAppState((s) => s.customItems);
  const stateRequest = useAppState((s) => s.request);
  const stateBuyer = useAppState((s) => s.buyer);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const myId = state.me.id !== "" ? state.me.id : MY_ID;
  const me = runners.find((r) => r.id === myId) ?? runners.find((r) => r.id === MY_ID)!;

  if (!me) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading your stall…</p>
      </main>
    );
  }

  const request = stateRequest;
  const km = distanceKm(stateBuyer, me);
  const catalog = catalogWith(stateCustomItems);
  const canFill = request ? request.items.filter((line) => priceFor(me, line.id) !== null).length : 0;
  const myTotal = request ? request.items.reduce((sum, line) => sum + (priceFor(me, line.id) ?? 0) * line.qty, 0) : 0;

  const onPosition = useCallback((pos: { lat: number; lng: number }) => {
    setBuyerLocation(pos);
    setRecenterTrigger((p) => p + 1);
    toast.success("Location updated");
  }, []);
  const { status: geoStatus, locate } = useGeolocation(onPosition);

  const onPickAvatar = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      updateState((prev) => ({
        ...prev,
        runners: prev.runners.map((r) => (r.id === me.id ? { ...r, avatar: dataUrl } : r)),
      }));
      toast.success("Profile picture saved");
    };
    reader.readAsDataURL(file);
  };

  const setOnline = (online: boolean) => {
    console.log(`\n  TRADER STATUS -> ${online ? "ONLINE" : "OFFLINE"}`);
    console.log(`   Trader: ${me.name} (${me.id})`);
    console.log(`   Time: ${new Date().toLocaleTimeString()}`);
    updateState((prev) => ({
      ...prev,
      runners: prev.runners.map((r) => (r.id === me.id ? { ...r, online } : r)),
    }));
  };

  const saveName = () => {
    if (!name.trim()) return;
    updateState((prev) => ({
      ...prev,
      runners: prev.runners.map((r) => (r.id === me.id ? { ...r, name: name.trim() } : r)),
    }));
    toast.success("Name updated");
  };

  const accept = () => {
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║         WAVE ACCEPTED BY TRADER          ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`  Trader  : ${me.name} (${me.id})`);
    console.log(`  Can fill: ${canFill}/${request?.items.length} items`);
    console.log(`  Total   : R${myTotal.toFixed(2)}`);
    console.log(`  Time    : ${new Date().toLocaleTimeString()}`);
    updateState((prev) => ({
      ...prev,
      request: prev.request
        ? { ...prev.request, status: "accepted", runnerId: me.id, total: myTotal }
        : null,
    }));
  };

  const deliver = () => {
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║       TRADER ARRIVED — DELIVERY DONE     ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`  Trader  : ${me.name}`);
    console.log(`  Distance: ${km.toFixed(2)} km`);
    console.log(`  Amount  : R${(request?.total ?? 0).toFixed(2)}`);
    console.log(`  Time    : ${new Date().toLocaleTimeString()}`);
    console.log("  Waiting for buyer to pay via MTN MoMo...");
    updateState((prev) => ({
      ...prev,
      request: prev.request ? { ...prev.request, status: "delivered" } : null,
    }));
  };

  if (!me) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading your stall…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="animate-rise flex items-center gap-2 px-4 pt-6 pb-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to buyer view">
          <Link to="/"><ArrowLeft /></Link>
        </Button>
        <BrandMark subtitle={`Trader stall · ${me.online ? "you're online" : "you're offline"}`} className="min-w-0" />
      </header>

      <Card className="mx-4 gap-4 p-5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-primary bg-secondary"
            aria-label="Upload profile picture">
            {me.avatar
              ? <img src={me.avatar} alt="Your profile" className="size-full object-cover" />
              : <Camera className="absolute inset-0 m-auto size-6 text-primary" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden"
            onChange={(e) => onPickAvatar(e.target.files?.[0])} />
          <div className="flex-1 space-y-2">
            <Label htmlFor="runner-name">Your name</Label>
            <div className="flex gap-2">
              <Input id="runner-name" placeholder={me.name} value={name} onChange={(e) => setName(e.target.value)} />
              <Button variant="secondary" onClick={saveName}>Save</Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <Label htmlFor="online">Available for deliveries</Label>
          <Switch id="online" checked={me.online} onCheckedChange={setOnline} />
        </div>
        <div className="flex items-center justify-between rounded-xl border px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="size-4 text-primary" /> Earnings today
          </span>
          <span className="font-display font-semibold">{formatRand(me.earnings)}</span>
        </div>
      </Card>

      <section className="relative mx-4 mt-4 h-56 overflow-hidden rounded-3xl border shadow-lift">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <VeggieMap
              runners={runners}
              activeRunnerId={request?.runnerId ?? null}
              waving={request?.status === "waving"}
              buyerPosition={stateBuyer}
              recenterTrigger={recenterTrigger}
            />
          </Suspense>
        </ClientOnly>
        <Button size="sm" variant="secondary" className="absolute top-3 left-3 z-400 shadow-lift"
          onClick={() => { locate(); setRecenterTrigger((p) => p + 1); }}>
          <Crosshair />
          {geoStatus === "locating" ? "Locating…" : state.buyer.located ? "Recentre" : "Use my location"}
        </Button>
      </section>

      <h2 className="mt-6 px-5 text-lg font-semibold">Waves near you</h2>
      <div className="px-4 pt-3">
        {!request && (
          <Card className="items-center gap-3 p-8 text-center border-dashed">
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
              <Hand className="size-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">No waves yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {me.online
                  ? "You are live — buyers nearby will see you on the map."
                  : "Toggle Available for deliveries above to go live."}
              </p>
            </div>
            {!me.online && (
              <p className="text-xs text-muted-foreground bg-secondary rounded-xl px-3 py-2">
                Switch on availability so nearby waves reach you
              </p>
            )}
          </Card>
        )}

        {request && (
          <Card className="animate-rise animate-slide-up gap-4 p-5">
            <OrderStepper status={request.status} />
            <div className="flex items-center gap-2">
              <Hand className={`size-5 text-accent ${request.status === "waving" ? "animate-wave" : ""}`} />
              <p className="font-semibold">
                {request.status === "waving" && "Someone is waving"}
                {request.status === "accepted" && "You accepted — deliver now"}
                {request.status === "delivered" && "Waiting for payment"}
                {request.status === "paid" && (request.paidWith === "cash" ? "Paid in cash" : "Paid with MTN MoMo")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {km.toFixed(1)} km away · about {walkMinutes(km)} min walk · you can fill {canFill}/{request.items.length}
            </p>
            <ul className="space-y-1 text-sm">
              {request.items.map((line) => {
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
                    {price === null && <span className="text-xs text-muted-foreground">not in your stock</span>}
                  </li>
                );
              })}
              {request.wish && <li className="text-muted-foreground italic">also asked for: {request.wish}</li>}
            </ul>
            <p className="font-display text-xl font-bold">
              {formatRand(request.status === "waving" ? myTotal : request.total)}
            </p>

            {request.status === "waving" && (
              <Button size="lg" onClick={accept} disabled={canFill === 0}>
                {canFill === 0 ? "Nothing you stock" : "Accept this wave"}
              </Button>
            )}
            {request.status === "accepted" && (
              <div className="space-y-2">
                <Button size="lg" variant="wave" className="w-full" onClick={deliver}>
                  <CheckCircle2 /> I&apos;ve arrived — request payment
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      console.log(`\n  DELIVERY FAILED -- ${me.name} at ${new Date().toLocaleTimeString()}`);
                      failRequest("Trader marked delivery as failed"); toast.error("Delivery marked as failed");
                    }}>
                    Mark Failed
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1"
                    onClick={() => {
                      console.log(`\n  WAVE DECLINED -- ${me.name} at ${new Date().toLocaleTimeString()}`);
                      cancelRequest("Trader cancelled"); toast.info("Wave cancelled");
                    }}>
                    Decline
                  </Button>
                </div>
              </div>
            )}
            {request.status === "delivered" && (
              <p className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm">
                <Wallet className="size-4 text-primary" /> Ask the customer to pay with MTN MoMo, or take cash.
              </p>
            )}
          </Card>
        )}
      </div>

      <StockEditor runnerId={me.id} stock={me.stock} customItems={stateCustomItems} highlightItemId={highlight} />

      <div className="mx-4 mt-4 rounded-2xl bg-primary/5 border border-primary/20 px-4 py-3">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Demand Intelligence</p>
        <p className="text-xs text-muted-foreground mt-0.5">See what buyers near you are asking for — restock before they wave.</p>
      </div>

      <DemandInsights state={{ ...state, userId: null, runners, customItems: stateCustomItems }} runnerId={me.id} onAdded={setHighlight} />
      <div className="h-8" />
    </main>
  );
}
