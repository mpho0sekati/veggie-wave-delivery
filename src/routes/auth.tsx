import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError(err instanceof Error ? err.message : "Something went wrong");
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
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
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
          <Input
            id="auth-password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        {mode === "signup" && (
          <div className="space-y-2">
            <Label>I am a…</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRole("buyer")}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${role === "buyer" ? "border-primary bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
              >
                Buyer
              </button>
              <button
                onClick={() => setRole("trader")}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${role === "trader" ? "border-primary bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
              >
                Trader
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

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
