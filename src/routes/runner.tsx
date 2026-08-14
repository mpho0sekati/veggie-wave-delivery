import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { Hand, Camera, ArrowLeft, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { catalogWith, distanceKm, formatRand, priceFor, walkMinutes } from "@/lib/veggie-data";
import { updateState, useAppState } from "@/lib/veggie-store";
import StockEditor from "@/components/StockEditor";
import DemandInsights from "@/components/DemandInsights";

const VeggieMap = lazy(() => import("@/components/VeggieMap"));

export const Route = createFileRoute("/runner")({
  head: () => ({
    meta: [
      { title: "Trader mode — Veggie Wave stall dashboard" },
      {
        name: "description",
        content:
          "Go online as a township veggie trader, set your own stock and prices, see who is waving nearby and get paid with Mdeko Pay.",
      },
      { property: "og:title", content: "Trader mode — Veggie Wave" },
      {
        property: "og:description",
        content:
          "Set your stock and prices, see waves nearby and what people are asking for, deliver and get paid instantly.",
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
  const state = useAppState();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);

  const me = state.runners.find((r) => r.id === MY_ID)!;
  const request = state.request;
  const km = distanceKm(state.buyer, me);
  const catalog = catalogWith(state.customItems);

  const canFill = request
    ? request.items.filter((line) => priceFor(me, line.id) !== null).length
    : 0;
  const myTotal = request
    ? request.items.reduce((sum, line) => sum + (priceFor(me, line.id) ?? 0) * line.qty, 0)
    : 0;

  const onPickAvatar = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      updateState((prev) => ({
        ...prev,
        runners: prev.runners.map((r) => (r.id === MY_ID ? { ...r, avatar: dataUrl } : r)),
      }));
      toast.success("Profile picture saved");
    };
    reader.readAsDataURL(file);
  };

  const setOnline = (online: boolean) =>
    updateState((prev) => ({
      ...prev,
      runners: prev.runners.map((r) => (r.id === MY_ID ? { ...r, online } : r)),
    }));

  const saveName = () => {
    if (!name.trim()) return;
    updateState((prev) => ({
      ...prev,
      runners: prev.runners.map((r) => (r.id === MY_ID ? { ...r, name: name.trim() } : r)),
    }));
    toast.success("Name updated");
  };

  const accept = () =>
    updateState((prev) => ({
      ...prev,
      request: prev.request
        ? { ...prev.request, status: "accepted", runnerId: MY_ID, total: myTotal }
        : null,
    }));

  const deliver = () =>
    updateState((prev) => ({
      ...prev,
      request: prev.request ? { ...prev.request, status: "delivered" } : null,
    }));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center gap-3 px-5 pt-6 pb-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to buyer view">
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Trader mode</h1>
          <p className="text-sm text-muted-foreground">
            {me.online ? "You're online" : "You're offline"} · {km.toFixed(1)} km from the wave
          </p>
        </div>
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
              runners={state.runners}
              activeRunnerId={request?.runnerId ?? null}
              waving={request?.status === "waving"}
              buyerPosition={state.buyer}
            />
          </Suspense>
        </ClientOnly>
      </section>

      <h2 className="mt-6 px-5 text-lg font-semibold">Waves near you</h2>
      <div className="px-4 pt-3">
        {!request && (
          <Card className="items-center gap-2 p-8 text-center">
            <Hand className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No one is waving right now. Stay online and you&apos;ll see the next one here.
            </p>
          </Card>
        )}

        {request && (
          <Card className="gap-3 p-5">
            <div className="flex items-center gap-2">
              <Hand
                className={`size-5 text-accent ${request.status === "waving" ? "animate-wave" : ""}`}
              />
              <p className="font-semibold">
                {request.status === "waving" && "Someone is waving"}
                {request.status === "accepted" && "You accepted — deliver now"}
                {request.status === "delivered" && "Waiting for payment"}
                {request.status === "paid" &&
                  (request.paidWith === "cash" ? "Paid in cash" : "Paid with Mdeko Pay")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {km.toFixed(1)} km away · about {walkMinutes(km)} min walk · you can fill {canFill}/
              {request.items.length}
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
                    {price === null && (
                      <span className="text-xs text-muted-foreground">not in your stock</span>
                    )}
                  </li>
                );
              })}
              {request.wish && (
                <li className="text-muted-foreground italic">also asked for: {request.wish}</li>
              )}
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
              <Button size="lg" variant="wave" onClick={deliver}>
                <CheckCircle2 /> I&apos;ve arrived — request payment
              </Button>
            )}
            {request.status === "delivered" && (
              <p className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm">
                <Wallet className="size-4 text-primary" /> Ask the customer to pay with Mdeko Pay,
                or take cash.
              </p>
            )}
          </Card>
        )}
      </div>

      <StockEditor
        runnerId={MY_ID}
        stock={me.stock}
        customItems={state.customItems}
        highlightItemId={highlight}
      />

      <DemandInsights state={state} runnerId={MY_ID} onAdded={setHighlight} />

      <div className="h-8" />
    </main>
  );
}
