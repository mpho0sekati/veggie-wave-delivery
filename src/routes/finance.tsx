import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Sparkles,
  Share2,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSession } from "@/lib/use-session";
import { useFinanceProfile, useSmartTip, useSavingsJar } from "@/lib/use-finance";
import BrandMark from "@/components/BrandMark";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "My Money — Mdeko Finance" },
      {
        name: "description",
        content:
          "Your financial identity on Mdeko. See your Trust Score, Savings Jar, and Money Story — built from every trade you make.",
      },
    ],
  }),
  component: FinancePage,
});

function formatRand(amount: number) {
  return `R${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatMonthYear(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

/* ────────── Share Card Modal ────────── */
function ShareModal({
  name,
  score,
  tier,
  totalTraded,
  memberSince,
  onClose,
}: {
  name: string;
  score: number;
  tier: string;
  totalTraded: number;
  memberSince: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-bold text-lg text-gray-900">Your Mdeko Profile</p>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        {/* Screenshot-ready card */}
        <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 p-5 text-white">
          <div className="mb-1 text-xs font-medium opacity-80">MDEKO FINANCE</div>
          <p className="text-xl font-bold">{name || "Mdeko Member"}</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-black">{score}</span>
            <span className="mb-1 text-lg opacity-80">/ 100</span>
          </div>
          <p className="mt-1 text-sm font-medium opacity-90">{tier}</p>
          <div className="mt-4 border-t border-white/30 pt-4 flex justify-between text-sm">
            <div>
              <p className="opacity-70">Total traded</p>
              <p className="font-bold">{formatRand(totalTraded)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-70">Member since</p>
              <p className="font-bold">{formatMonthYear(memberSince)}</p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs opacity-60">Built on Mdeko · mdeko.app</p>
        </div>

        <p className="mt-3 text-center text-sm text-gray-500">
          Screenshot this card to share your financial story.
        </p>
      </div>
    </div>
  );
}

/* ────────── Score Card ────────── */
function ScoreCard({
  score,
  totalTraded,
  totalCommission,
  isLoading,
}: {
  score: ReturnType<typeof useFinanceProfile>["score"];
  totalTraded: number;
  totalCommission: number;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (!score) return null;

  const factors = [
    { label: "How much you've traded", pts: score.orderVolumePts, max: 30 },
    { label: "Did you pay or get paid?", pts: score.paymentReliabilityPts, max: 30 },
    { label: "Have you been active?", pts: score.activityConsistencyPts, max: 20 },
    { label: "Are you saving?", pts: score.savingsBehaviourPts, max: 20 },
  ];

  return (
    <Card className="overflow-hidden border-2 border-primary/20">
      <div className="bg-gradient-to-r from-primary/10 to-emerald-50 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">⭐ Trust Score</p>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-primary">{score.total}</span>
              <span className="text-lg text-muted-foreground mb-1">/ 100</span>
            </div>
          </div>
          <Badge className="text-sm px-3 py-1 bg-primary text-white">{score.tier}</Badge>
        </div>
        <Progress value={score.total} className="mt-3 h-3" />
        <p className="mt-2 text-sm text-primary font-medium">{score.tip}</p>
      </div>

      <CardContent className="pt-4 pb-5">
        {/* FIX 2 — commission visible here so judges see the business model */}
        {totalTraded > 0 && (
          <div className="mb-4 rounded-xl bg-secondary px-3 py-2 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Your total traded</span>
            <span className="font-bold text-sm">{formatRand(totalTraded)}</span>
          </div>
        )}
        {totalCommission > 0 && (
          <div className="mb-4 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Mdeko's 5% platform fee</span>
            <span className="font-bold text-sm text-primary">{formatRand(totalCommission)}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
          How your score is made up
        </p>
        <div className="space-y-2.5">
          {factors.map((f) => (
            <div key={f.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{f.label}</span>
                <span className="font-semibold text-primary">
                  {f.pts}/{f.max}
                </span>
              </div>
              <Progress value={(f.pts / f.max) * 100} className="h-1.5" />
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Banks look at records like this. Every trade on Mdeko builds yours.
        </p>
      </CardContent>
    </Card>
  );
}

/* ────────── Smart Tip Card ────────── */
function SmartTipCard({ tip, isLoading }: { tip: string | null; isLoading: boolean }) {
  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Sparkles className="size-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-emerald-700 mb-1 uppercase tracking-wide">
              🤖 Your personal money tip
            </p>
            {isLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full bg-emerald-100" />
                <Skeleton className="h-4 w-3/4 bg-emerald-100" />
              </div>
            ) : (
              <p className="text-sm text-emerald-900 leading-relaxed">
                {tip ?? "Keep trading regularly — every order builds your financial history on Mdeko. 💚"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────── Savings Jar Card ────────── */
function SavingsJarCard({
  role,
  isLoading,
}: {
  role: "buyer" | "trader" | null;
  isLoading: boolean;
}) {
  const { jar, deposit, updateTarget } = useSavingsJar();
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  const saveNewTarget = () => {
    const val = Number(targetInput);
    if (!val || val < 10) {
      toast.error("Please enter a goal of at least R10");
      return;
    }
    updateTarget.mutate(val, {
      onSuccess: () => {
        toast.success("Savings goal updated!");
        setEditingTarget(false);
        setTargetInput("");
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }

  const balance = jar?.balance ?? 0;
  const target = jar?.targetAmount ?? 500;
  const pct = Math.min((balance / target) * 100, 100);

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">🪣</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Savings Jar</p>
            <p className="text-3xl font-black text-foreground">{formatRand(balance)}</p>
            <p className="text-sm text-muted-foreground">saved so far</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Goal: {formatRand(target)}</span>
            <button
              className="flex items-center gap-1 text-xs text-primary"
              onClick={() => setEditingTarget(true)}
              type="button"
            >
              <Pencil className="size-3" /> Edit goal
            </button>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}% of your goal</p>
        </div>

        {editingTarget && (
          <div className="mt-3 flex gap-2">
            <Input
              type="number"
              placeholder="New goal (e.g. 1000)"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={saveNewTarget} disabled={updateTarget.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingTarget(false)}>
              Cancel
            </Button>
          </div>
        )}

        <p className="mt-3 text-sm text-muted-foreground">
          {role === "trader"
            ? "Every time you get paid, we put 5% away for you. No effort needed. 💚"
            : "Every completed order earns you community credit in your jar. 💚"}
        </p>
      </CardContent>
    </Card>
  );
}

/* ────────── Money Story Card ────────── */
function MoneyStoryCard({
  profile,
  isLoading,
  onShare,
}: {
  profile: ReturnType<typeof useFinanceProfile>["profile"];
  isLoading: boolean;
  onShare: () => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const stats = [
    {
      icon: CheckCircle2,
      label: `${profile.totalOrders} order${profile.totalOrders === 1 ? "" : "s"} completed`,
      color: "text-primary",
    },
    {
      icon: TrendingUp,
      label: `${formatRand(profile.totalTraded)} total traded on Mdeko`,
      color: "text-primary",
    },
    {
      icon: Calendar,
      label: `Member since ${formatMonthYear(profile.memberSince)}`,
      color: "text-primary",
    },
  ];

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📄</span>
          <p className="font-bold text-lg">Your Money Story</p>
        </div>

        <div className="space-y-3 mb-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <Icon className={`size-5 shrink-0 ${s.color}`} />
                <span className="text-base">{s.label}</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mb-4 bg-secondary rounded-xl px-3 py-2">
          Mdeko earns a small fee on each order — that keeps the app running for everyone in the
          community.
        </p>

        <Button onClick={onShare} className="w-full gap-2" size="lg">
          <Share2 className="size-5" />
          Share my profile 📤
        </Button>
      </CardContent>
    </Card>
  );
}

/* ────────── Main Page ────────── */
function FinancePage() {
  const session = useSession();
  const { profile, score, isLoading } = useFinanceProfile();
  const tipQuery = useSmartTip(profile);
  const [showShare, setShowShare] = useState(false);

  const isNewUser = !isLoading && profile?.totalOrders === 0;

  // FIX 1 — back button goes to where the user came from,
  // so traders return to /runner and buyers return to /
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <main className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-xl"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <BrandMark subtitle="My Money" />
          </div>
          <Wallet className="size-6 text-primary" />
        </div>
      </header>

      {/* FIX 3 — Impact statement moved to TOP so judges see it in first 3 seconds */}
      <div className="bg-primary px-4 py-3">
        <p className="mx-auto max-w-lg text-center text-sm font-semibold text-white leading-snug">
          💚 23 million South Africans have no proof of income.
        </p>
        <p className="mx-auto max-w-lg text-center text-xs text-white/80 mt-0.5">
          Every trade on Mdeko builds your financial history — your first step to credit and banking.
        </p>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5 pb-10">
        {/* Empty state for brand new users */}
        {isNewUser ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="text-5xl">🌱</span>
              <div>
                <p className="font-bold text-xl mb-2">Start building your money profile</p>
                <p className="text-muted-foreground">
                  Every order you complete on Mdeko builds your financial history. Start trading to
                  see your Trust Score, Savings Jar, and Money Story.
                </p>
              </div>
              <Button asChild className="mt-2">
                <Link to="/">Find a trader near me</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Card 1: Trust Score */}
            <ScoreCard score={score} totalTraded={profile?.totalTraded ?? 0} totalCommission={profile?.totalCommission ?? 0} isLoading={isLoading} />

            {/* Card 2: Smart Tip (AI) */}
            <SmartTipCard tip={tipQuery.data ?? null} isLoading={tipQuery.isLoading} />

            {/* Card 3: Savings Jar */}
            <SavingsJarCard role={profile?.role ?? session.role} isLoading={isLoading} />

            {/* Card 4: Money Story */}
            <MoneyStoryCard
              profile={profile}
              isLoading={isLoading}
              onShare={() => setShowShare(true)}
            />
          </>
        )}
      </div>

      {/* Share modal */}
      {showShare && profile && score && (
        <ShareModal
          name={session.name}
          score={score.total}
          tier={score.tier}
          totalTraded={profile.totalTraded}
          memberSince={profile.memberSince}
          onClose={() => setShowShare(false)}
        />
      )}
    </main>
  );
}
