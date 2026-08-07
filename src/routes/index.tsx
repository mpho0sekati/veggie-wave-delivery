import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import {
  Hand,
  Minus,
  Plus,
  ScanLine,
  Star,
  Truck,
  MapPin,
  CheckCircle2,
  Crosshair,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATALOG, distanceKm, formatRand, walkMinutes } from "@/lib/veggie-data";
import { setBuyerLocation, updateState, useAppState } from "@/lib/veggie-store";
import { useGeolocation } from "@/lib/use-geolocation";

const VeggieMap = lazy(() => import("@/components/VeggieMap"));


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veggie Wave — Raise your hand, fresh veggies come to you" },
      {
        name: "description",
        content:
          "See the nearest veggie runner on the map, wave to signal what you need, and pay instantly with Capitec Scan to Pay.",
      },
      { property: "og:title", content: "Veggie Wave — Raise your hand for fresh veggies" },
      {
        property: "og:description",
        content:
          "Live map of nearby veggie runners. Wave, get your fruit and veg delivered, pay by Capitec scan.",
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

function BuyerPage() {
  const state = useAppState();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [payOpen, setPayOpen] = useState(false);
  const buyer = state.buyer;
  const onPosition = useCallback((pos: { lat: number; lng: number }) => {
    setBuyerLocation(pos);
  }, []);
  const { status: geoStatus, locate } = useGeolocation(onPosition);

  const online = state.runners.filter((r) => r.online);
  const nearbyRunners = useMemo(
    () =>
      [...online]
        .map((r) => ({ runner: r, km: distanceKm(buyer, r) }))
        .sort((a, b) => a.km - b.km),
    [online, buyer],
  );
  const nearest = nearbyRunners[0]?.runner ?? null;
  const nearestKm = nearbyRunners[0]?.km ?? 0;


  const picked = CATALOG.filter((c) => (qty[c.id] ?? 0) > 0);
  const total = picked.reduce((sum, c) => sum + c.price * (qty[c.id] ?? 0), 0);
  const request = state.request;
  const assigned = state.runners.find((r) => r.id === request?.runnerId) ?? null;

  const bump = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));

  const wave = () => {
    if (!picked.length) {
      toast.error("Pick what you need first");
      return;
    }
    updateState((prev) => ({
      ...prev,
      request: {
        id: crypto.randomUUID(),
        items: picked.map((p) => ({ id: p.id, qty: qty[p.id] ?? 0 })),
        total,
        note: `${picked.length} items`,
        status: "waving",
        runnerId: null,
        createdAt: Date.now(),
      },
    }));
    toast.success("Hand raised — nearby runners can see you waving");
  };

  const cancel = () => {
    updateState((prev) => ({ ...prev, request: null }));
    setQty({});
  };

  const markPaid = () => {
    updateState((prev) => ({
      ...prev,
      request: prev.request ? { ...prev.request, status: "paid" } : null,
    }));
    setPayOpen(false);
    toast.success("Paid with Capitec Scan to Pay");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <div>
          <h1 className="text-2xl font-bold">Veggie Wave</h1>
          <p className="text-sm text-muted-foreground">
            {online.length} runners near you
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/runner">
            <Truck /> I&apos;m a runner
          </Link>
        </Button>
      </header>

      <section className="relative mx-4 h-72 overflow-hidden rounded-3xl border shadow-lift">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <VeggieMap
              runners={state.runners}
              activeRunnerId={request?.runnerId ?? null}
              waving={request?.status === "waving"}
            />
          </Suspense>
        </ClientOnly>
      </section>

      {nearest && !request && (
        <Card className="mx-4 mt-4 flex flex-row items-center gap-3 p-4">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
            {nearest.name.charAt(0)}
          </span>
          <div className="flex-1">
            <p className="font-semibold">{nearest.name} is closest</p>
            <p className="text-sm text-muted-foreground">
              {distanceKm(BUYER_POSITION, nearest).toFixed(1)} km ·{" "}
              {walkMinutes(distanceKm(BUYER_POSITION, nearest))} min
            </p>
          </div>
          <Badge variant="secondary">
            <Star className="size-3" /> {nearest.rating.toFixed(1)}
          </Badge>
        </Card>
      )}

      {!request && (
        <>
          <h2 className="mt-6 px-5 text-lg font-semibold">What do you need?</h2>
          <div className="grid grid-cols-2 gap-3 px-4 pt-3">
            {CATALOG.map((item) => {
              const Icon = item.icon;
              const count = qty[item.id] ?? 0;
              return (
                <Card
                  key={item.id}
                  className={`gap-2 p-4 transition-colors ${count ? "border-primary bg-secondary" : ""}`}
                >
                  <Icon className="size-7 text-primary" />
                  <div>
                    <p className="font-semibold leading-tight">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.unit} · {formatRand(item.price)}
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
        </>
      )}

      {request && (
        <Card className="mx-4 mt-4 gap-3 p-5">
          <div className="flex items-center gap-2">
            {request.status === "waving" && (
              <>
                <Hand className="size-5 animate-wave text-accent" />
                <p className="font-semibold">Waving… waiting for a runner</p>
              </>
            )}
            {request.status === "accepted" && assigned && (
              <>
                <MapPin className="size-5 text-primary" />
                <p className="font-semibold">{assigned.name} is on the way</p>
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
                <p className="font-semibold">Paid. Enjoy your veggies!</p>
              </>
            )}
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {request.items.map((line) => {
              const item = CATALOG.find((c) => c.id === line.id);
              if (!item) return null;
              const Icon = item.icon;
              return (
                <li key={line.id} className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  {line.qty} × {item.name} ({item.unit})
                </li>
              );
            })}
          </ul>
          <p className="font-display text-xl font-bold">{formatRand(request.total)}</p>
          {request.status === "delivered" && (
            <Button variant="capitec" size="lg" onClick={() => setPayOpen(true)}>
              <ScanLine /> Capitec Scan to Pay
            </Button>
          )}
          {request.status !== "paid" ? (
            <Button variant="ghost" onClick={cancel}>
              Cancel request
            </Button>
          ) : (
            <Button variant="outline" onClick={cancel}>
              New order
            </Button>
          )}
        </Card>
      )}

      {!request && (
        <div className="sticky bottom-0 mt-6 border-t bg-background/90 p-4 backdrop-blur">
          <Button size="xl" variant="wave" className="w-full" onClick={wave}>
            <Hand className="animate-wave" /> Raise my hand
            {total > 0 ? ` · ${formatRand(total)}` : ""}
          </Button>
        </div>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Capitec Scan to Pay</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div
              className="size-40 rounded-xl border bg-foreground"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(var(--foreground) 0% 25%, var(--card) 0% 50%)",
                backgroundSize: "16px 16px",
              }}
              aria-label="Capitec payment QR code"
            />
            <p className="text-center text-sm text-muted-foreground">
              Scan this code in the Capitec app to pay{" "}
              {formatRand(request?.total ?? 0)} to your runner.
            </p>
            <Button variant="capitec" className="w-full" onClick={markPaid}>
              I&apos;ve paid
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
