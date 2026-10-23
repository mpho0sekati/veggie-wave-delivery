import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, ShoppingBasket, Store } from "lucide-react";
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
      { name: "description", content: "Sign in to Mdeko to order fresh produce or manage your trader stall." },
      { property: "og:title", content: "Sign in — Mdeko · Veggie Wave" },
      { property: "og:description", content: "Sign in to Mdeko to order fresh produce or manage your trader stall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Try again.";
  if (m.includes("already registered")) return "You already have an account — please sign in.";
  if (m.includes("password") && (m.includes("weak") || m.includes("at least")))
    return "Pick a stronger password: at least 8 characters with a number.";
  if (m.includes("email not confirmed")) return "Please confirm your email first, then sign in.";
  if (m.includes("fetch") || m.includes("network")) return "No connection. Check your internet and try again.";
  return msg || "Something went wrong. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"buyer" | "trader">("buyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          toast.success("Account created — check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }
        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({ id: data.user.id, name: name.trim(), role });
          if (profileError) throw profileError;
        }
        toast.success("Account created! Welcome to Mdeko.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        toast.success("Welcome back!");
      }

      // The role always comes from the saved profile, never from the form,
      // so nobody can land on the trader stall by editing the page.
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      let savedRole: "buyer" | "trader" = "buyer";
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.role === "trader") savedRole = "trader";
      }
      navigate({ to: savedRole === "trader" ? "/runner" : "/" });
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 pb-8">
      <div className="mb-8">
        <BrandMark subtitle="Fresh veggies, delivered to you" />
      </div>

      <Card className="w-full gap-5 p-6">
        {/* Mode toggle */}
        <div className="flex rounded-xl bg-secondary p-1">
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Create account
          </button>
        </div>

        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="auth-name">Your name</Label>
            <Input
              id="auth-name"
              placeholder="e.g. Thabo Nkosi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <div className="relative">
            <Input
              id="auth-password"
              type={showPw ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="pr-10"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div className="space-y-2">
            <Label>I want to…</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "buyer", icon: ShoppingBasket, title: "Buy veggies", sub: "Wave a trader to me" },
                  { id: "trader", icon: Store, title: "Sell veggies", sub: "Get orders nearby" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={role === r.id}
                  onClick={() => setRole(r.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-center transition-all ${role === r.id ? "border-primary bg-primary/10" : "border-transparent bg-secondary"}`}
                >
                  <r.icon className={`size-6 ${role === r.id ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-semibold">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{r.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button variant="wave" className="w-full" onClick={submit} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" />{" "}
              {mode === "signup" ? "Creating account…" : "Signing in…"}
            </>
          ) : mode === "signup" ? (
            "Create account"
          ) : (
            "Sign in"
          )}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or test with demo accounts</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                const { supabase } = await import("@/integrations/supabase/client");
                // Try anonymous sign in or sign in with password fallback
                const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
                const user = anonData?.user;

                if (user) {
                  await supabase
                    .from("profiles")
                    .upsert({ id: user.id, name: "Demo Buyer", role: "buyer" });
                  toast.success("Logged in as Demo Buyer");
                  navigate({ to: "/" });
                  return;
                }

                // Fallback to password sign in if anonymous auth is disabled
                const demoEmail = "buyer.demo@mdeko.co.za";
                const demoPass = "DemoPassword123!";
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                  email: demoEmail,
                  password: demoPass,
                });

                if (signInErr) {
                  throw new Error(
                    "Could not log in as Demo Buyer: " + (anonErr?.message || signInErr.message),
                  );
                }

                toast.success("Logged in as Demo Buyer");
                navigate({ to: "/" });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Demo sign in failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            Demo Buyer
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                const { supabase } = await import("@/integrations/supabase/client");
                // Try anonymous sign in or sign in with password fallback
                const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
                const user = anonData?.user;

                if (user) {
                  await supabase
                    .from("profiles")
                    .upsert({ id: user.id, name: "Demo Trader", role: "trader" });
                  toast.success("Logged in as Demo Trader");
                  navigate({ to: "/runner" });
                  return;
                }

                // Fallback to password sign in if anonymous auth is disabled
                const demoEmail = "trader.demo@mdeko.co.za";
                const demoPass = "DemoPassword123!";
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                  email: demoEmail,
                  password: demoPass,
                });

                if (signInErr) {
                  throw new Error(
                    "Could not log in as Demo Trader: " + (anonErr?.message || signInErr.message),
                  );
                }

                toast.success("Logged in as Demo Trader");
                navigate({ to: "/runner" });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Demo sign in failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            Demo Trader
          </Button>
        </div>
      </Card>
    </main>
  );
}
