import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { Hand, Camera, ArrowLeft, CheckCircle2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BUYER_POSITION, CATALOG, distanceKm, formatRand, walkMinutes } from "@/lib/veggie-data";
import { updateState, useAppState } from "@/lib/veggie-store";

const VeggieMap = lazy(() => import("@/components/VeggieMap"));

export const Route = createFileRoute("/runner")({
  head: () => ({
    meta: [
      { title: "Runner mode — Veggie Wave seller dashboard" },
      {
        name: "description",
        content:
          "Go online as a veggie runner, see who is waving nearby, deliver their fruit and veg, and get paid by Capitec scan.",
      },
      { property: "og:title", content: "Runner mode — Veggie Wave" },
      {
        property: "og:description",
        content: "Go online, see waves nearby, deliver fresh produce and get paid instantly.",
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

  const me = state.runners.find((r) => r.id === MY_ID)!;
  const request = state.request;
  const km = distanceKm(BUYER_POSITION, me);

  const onPickAvatar = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      updateState((prev) => ({
        ...prev,
        runners: prev.runners.map((r) =>
          r.id === MY_ID ? { ...r, avatar: dataUrl } : r,
        ),
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
        ? { ...prev.request, status: "accepted", runnerId: MY_ID }
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
          <h1 className="text-2xl font-bold">Runner mode</h1>
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
      </Card>

      <section className="relative mx-4 mt-4 h-56 overflow-hidden rounded-3xl border shadow-lift">
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

      <h2 className="mt-6 px-5 text-lg font-semibold">Waves near you</h2>
      <div className="px-4 pt-3 pb-8">
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
                {request.status === "paid" && "Paid — nice work"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {km.toFixed(1)} km away · about {walkMinutes(km)} min walk
            </p>
            <ul className="space-y-1 text-sm">
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

            {request.status === "waving" && (
              <Button size="lg" onClick={accept}>
                Accept this wave
              </Button>
            )}
            {request.status === "accepted" && (
              <Button size="lg" variant="wave" onClick={deliver}>
                <CheckCircle2 /> I&apos;ve arrived — request payment
              </Button>
            )}
            {request.status === "delivered" && (
              <p className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm">
                <ScanLine className="size-4 text-capitec" /> Show your Capitec Scan to Pay
                code to the customer.
              </p>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
