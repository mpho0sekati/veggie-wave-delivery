import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Phone, ShieldCheck, Store, ShoppingBasket, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import AppTabBar from "@/components/AppTabBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { saveTraderProfile } from "@/lib/use-marketplace";
import { signOutEverywhere, useSession } from "@/lib/use-session";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Mdeko · Veggie Wave" },
      { name: "description", content: "See and edit your Mdeko name, cell number and account." },
      { property: "og:title", content: "My profile — Mdeko · Veggie Wave" },
      {
        property: "og:description",
        content: "See and edit your Mdeko name, cell number and account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

/** Turns the sign-in address back into a readable SA cell number. */
function cellFromEmail(email: string | null): string | null {
  const m = email?.match(/^27(\d{9})@cell\.mdeko\.app$/);
  if (!m) return null;
  const d = `0${m[1]}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function ProfilePage() {
  const session = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<{ avatar: string | null; since: string | null }>({
    avatar: null,
    since: null,
  });

  useEffect(() => setName(session.name), [session.name]);
  useEffect(() => {
    if (!session.userId) return;
    void supabase
      .from("profiles")
      .select("avatar, created_at")
      .eq("id", session.userId)
      .maybeSingle()
      .then(({ data }) =>
        setDetails({ avatar: data?.avatar ?? null, since: data?.created_at ?? null }),
      );
  }, [session.userId]);

  const cell = cellFromEmail(session.email);
  const isDemo = session.email?.endsWith("@mdeko.app") && !cell;
  const isTrader = session.role === "trader";

  const save = async () => {
    if (!session.userId || !name.trim()) {
      toast.error("Type your name first");
      return;
    }
    setSaving(true);
    try {
      await saveTraderProfile(session.userId, { name: name.trim() });
      toast.success("Name saved");
    } catch {
      toast.error("Could not save your name — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-xl px-4 py-3">
          <p className="text-xs font-semibold text-primary">Mdeko</p>
          <h1 className="text-xl font-semibold">My profile</h1>
        </div>
        <div className="mx-auto max-w-xl px-3 pb-2">
          <AppTabBar signedIn={Boolean(session.userId)} className="shadow-none" />
        </div>
      </header>
      <div className="mx-auto max-w-xl space-y-4 px-5 py-6">
        {session.loading ? (
          <p className="text-sm text-muted-foreground">Loading your profile…</p>
        ) : !session.userId ? (
          <Card className="space-y-3 p-5">
            <UserRound className="size-10 text-primary" />
            <h2 className="text-lg font-semibold">Sign in to see your profile</h2>
            <Button asChild className="h-11">
              <Link to="/auth">Sign in</Link>
            </Button>
          </Card>
        ) : (
          <>
            <Card className="flex items-center gap-4 p-5">
              {details.avatar ? (
                <img
                  src={details.avatar}
                  alt=""
                  className="size-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                  {(session.name || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{session.name || "No name yet"}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  {isTrader ? <Store className="size-4" /> : <ShoppingBasket className="size-4" />}
                  {isTrader ? "Trader · I sell veggies" : "Buyer · I buy veggies"}
                </p>
                {details.since && (
                  <p className="text-xs text-muted-foreground">
                    Member since{" "}
                    {new Date(details.since).toLocaleDateString("en-ZA", {
                      timeZone: "Africa/Johannesburg",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <Label htmlFor="profile-name">{isTrader ? "Stall name" : "My name"}</Label>
              <div className="flex gap-2">
                <Input
                  id="profile-name"
                  className="h-11"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button className="h-11" disabled={saving} onClick={() => void save()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <p className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-primary" />
                <span className="font-medium">Cell number:</span>
                {cell ?? (isDemo ? "Demo account" : "Not linked")}
              </p>
              {cell && (
                <p className="text-xs text-muted-foreground">
                  This number is also your MoMo number for payments.
                </p>
              )}
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-primary" />
                <span className="font-medium">Sign-in:</span>
                {cell ? "Cell number + 4-number PIN" : "One-tap demo"}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-12">
                <Link to={isTrader ? "/runner" : "/"}>
                  {isTrader ? <Store /> : <ShoppingBasket />}
                  {isTrader ? "My stall" : "Buy veggies"}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12">
                <Link to="/finance">
                  <Wallet /> My Money
                </Link>
              </Button>
            </div>

            <Button
              variant="ghost"
              className="h-12 w-full text-destructive"
              onClick={async () => {
                await signOutEverywhere();
                toast.success("Signed out");
                navigate({ to: "/auth" });
              }}
            >
              <LogOut /> Sign out
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
