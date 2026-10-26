import { ensureDemoAccount } from "@/lib/demo-auth.functions";
import { cellSignIn, cellSignUp } from "@/lib/phone-auth.functions";
import { isValidPin, normaliseSaCell } from "@/lib/phone-auth";
import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Phone, ShoppingBasket, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandMark from "@/components/BrandMark";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Mdeko · Veggie Wave" },
      {
        name: "description",
        content: "Sign in to Mdeko to order fresh produce or manage your trader stall.",
      },
      { property: "og:title", content: "Sign in — Mdeko · Veggie Wave" },
      {
        property: "og:description",
        content: "Sign in to Mdeko to order fresh produce or manage your trader stall.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthLayout,
});

function AuthLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path === "/auth" ? <AuthPage /> : <Outlet />;
}

const ERRORS: Record<string, string> = {
  BAD_CELL: "Type a real SA cell number, like 082 123 4567.",
  BAD_PIN: "Your PIN must be 4 numbers.",
  NO_MATCH: "That number and PIN don't match. Try again or tap New here.",
  TAKEN: "This number already has an account. Tap I have an account.",
  NO_NAME: "Please type your name.",
  FAILED: "Something went wrong. Please try again.",
};

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (ERRORS[msg]) return ERRORS[msg];
  if (/fetch|network/i.test(msg)) return "No connection. Check your data and try again.";
  return ERRORS.FAILED;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [cell, setCell] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"buyer" | "trader">("buyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goHome = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();
    if (!profile) return navigate({ to: "/auth/onboarding" });
    navigate({ to: profile.role === "trader" ? "/runner" : "/" });
  };

  // One-tap demo sign-in for judges.
  const demoSignIn = async (demoRole: "buyer" | "trader") => {
    const creds = {
      email: demoRole === "trader" ? "demo.trader@mdeko.app" : "demo.buyer@mdeko.app",
      password: "mdeko-demo-1234",
    };
    setLoading(true);
    setError("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await ensureDemoAccount({ data: { role: demoRole } });
      const { error: e } = await supabase.auth.signInWithPassword(creds);
      if (e) throw e;
      const { data: savedProfile, error: readError } = await supabase.from("profiles").select("name").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle();
      if (readError) throw readError;
      if (!savedProfile) {
        const { error: setupError } = await supabase.rpc("setup_marketplace_profile", {
          _name: demoRole === "trader" ? "Armando" : "Demo Buyer",
          _role: demoRole,
        });
        if (setupError) throw setupError;
      }
      navigate({ to: demoRole === "trader" ? "/runner" : "/" });
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!normaliseSaCell(cell)) return setError(ERRORS.BAD_CELL);
    if (!isValidPin(pin)) return setError(ERRORS.BAD_PIN);
    if (mode === "signup" && !name.trim()) return setError(ERRORS.NO_NAME);
    setLoading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const res =
        mode === "signup"
          ? await cellSignUp({ data: { cell, pin, name, role } })
          : await cellSignIn({ data: { cell, pin } });
      if ("error" in res && res.error) throw new Error(res.error);
      if (!("session" in res) || !res.session) throw new Error("FAILED");
      const { error: e } = await supabase.auth.setSession(res.session);
      if (e) throw e;
      if (mode === "signup") {
        const { error: pe } = await supabase.rpc("setup_marketplace_profile", {
          _name: name.trim(),
          _role: role,
        });
        if (pe) throw pe;
        toast.success(role === "trader" ? "Your stall is ready!" : "Welcome to Mdeko!");
      } else {
        toast.success("Welcome back!");
      }
      await goHome();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-8">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/" }))}
        className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-sm font-medium"
      >
        ← Back
      </button>
      <div className="mb-6">
        <BrandMark subtitle="Fresh veggies, delivered to you" />
      </div>

      <Card className="w-full gap-5 p-6">
        <div className="flex rounded-xl bg-secondary p-1">
          {(
            [
              ["signup", "New here"],
              ["signin", "I have an account"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => {
                setMode(id);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "buyer", icon: ShoppingBasket, title: "I buy veggies" },
                { id: "trader", icon: Store, title: "I sell veggies" },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={role === r.id}
                onClick={() => setRole(r.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-4 transition-all ${role === r.id ? "border-primary bg-primary/10" : "border-transparent bg-secondary"}`}
              >
                <r.icon
                  className={`size-7 ${role === r.id ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="text-sm font-semibold">{r.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="auth-cell">Your cell number</Label>
          <Input
            id="auth-cell"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="082 123 4567"
            value={cell}
            onChange={(e) => setCell(e.target.value)}
            disabled={loading}
            className="h-12 text-lg"
          />
          <p className="text-xs text-muted-foreground">
            This number is also your MoMo number for paying
            {role === "trader" ? " and getting paid" : ""}.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="auth-pin">
            {mode === "signup" ? "Make a 4-number PIN" : "Your 4-number PIN"}
          </Label>
          <Input
            id="auth-pin"
            type="password"
            inputMode="numeric"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            disabled={loading}
            className="h-12 text-center text-2xl tracking-[0.6em]"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="auth-name">
              {role === "trader" ? "Your name or stall name" : "Your name"}
            </Label>
            <Input
              id="auth-name"
              placeholder={role === "trader" ? "Mama Joyce Veggies" : "Thabo"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="h-12"
            />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button variant="wave" size="lg" className="w-full" onClick={submit} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : mode === "signup" ? "Start" : "Go"}
        </Button>

        {mode === "signup" && (
          <a
            href="tel:*120*151%23"
            className="flex items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm"
          >
            <Phone className="size-5 shrink-0 text-primary" />
            <span>
              <span className="font-semibold">No MoMo yet? Tap to dial *120*151#</span>
              <span className="block text-xs text-muted-foreground">
                Free, takes 1 minute, works on any network. No bank needed.
              </span>
            </span>
          </a>
        )}
      </Card>

      <div className="mt-4 w-full rounded-2xl bg-secondary/60 p-3">
        <p className="mb-2 text-center text-xs text-muted-foreground">Judges: try it in one tap</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => demoSignIn("buyer")}
            disabled={loading}
          >
            <ShoppingBasket /> Demo buyer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => demoSignIn("trader")}
            disabled={loading}
          >
            <Store /> Demo trader
          </Button>
        </div>
      </div>
    </main>
  );
}
