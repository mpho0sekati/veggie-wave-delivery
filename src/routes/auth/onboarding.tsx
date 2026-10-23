import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUserRole, getUserRole } from "@/lib/auth-guard";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Mdeko · Veggie Wave" },
      { name: "description", content: "Set up your Mdeko buyer profile or produce trader stall." },
      { property: "og:title", content: "Welcome — Mdeko · Veggie Wave" },
      { property: "og:description", content: "Set up your Mdeko buyer profile or produce trader stall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"role" | "buyer-details" | "trader-details">("role");
  const [buyerName, setBuyerName] = useState("");
  const [traderName, setTraderName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBuyerOnboard = async () => {
    if (!buyerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setLoading(true);
    try {
      setUserRole("buyer");
      localStorage.setItem("buyer-name", buyerName);
      toast.success("Welcome! You're all set.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error("Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTraderOnboard = async () => {
    if (!traderName.trim()) {
      toast.error("Please enter your trader name");
      return;
    }
    setLoading(true);
    try {
      setUserRole("trader");
      localStorage.setItem("trader-name", traderName);
      toast.success("Welcome trader! Set up your stock next.");
      navigate({ to: "/runner" });
    } catch (err) {
      toast.error("Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 pb-8">
      {step === "role" && (
        <Card className="w-full gap-6 p-8 text-center">
          <div>
            <h1 className="text-2xl font-bold">Welcome to Mdeko</h1>
            <p className="mt-2 text-sm text-muted-foreground">How would you like to use Veggie Wave?</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              onClick={() => setStep("buyer-details")}
              className="h-16 flex-col items-center justify-center gap-2"
            >
              <span className="text-2xl">👋</span>
              <span>I want to buy fresh veggies</span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => setStep("trader-details")}
              className="h-16 flex-col items-center justify-center gap-2"
            >
              <span className="text-2xl">🛒</span>
              <span>I'm a trader selling produce</span>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            You can always switch roles later from your profile.
          </p>
        </Card>
      )}

      {step === "buyer-details" && (
        <Card className="w-full gap-4 p-8">
          <div>
            <h2 className="text-xl font-bold">What's your name?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Traders will see this when you raise your hand</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyer-name">Your name</Label>
            <Input
              id="buyer-name"
              placeholder="e.g. Thandi"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("role")}
              disabled={loading}
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handleBuyerOnboard} disabled={loading} className="flex-1">
              {loading ? "Setting up..." : "Start shopping"}
            </Button>
          </div>
        </Card>
      )}

      {step === "trader-details" && (
        <Card className="w-full gap-4 p-8">
          <div>
            <h2 className="text-xl font-bold">Your stall name</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buyers will see this on the map and when they raise their hand
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trader-name">Stall name</Label>
            <Input
              id="trader-name"
              placeholder="e.g. Mama Zoe's Fresh Veggies"
              value={traderName}
              onChange={(e) => setTraderName(e.target.value)}
              disabled={loading}
            />
          </div>

          <p className="text-xs text-muted-foreground bg-secondary px-3 py-2 rounded">
            You'll set your stock and prices right after this.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("role")}
              disabled={loading}
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handleTraderOnboard} disabled={loading} className="flex-1">
              {loading ? "Setting up..." : "Open my stall"}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}
