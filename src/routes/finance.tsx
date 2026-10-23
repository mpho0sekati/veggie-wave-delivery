/**
 * Mdeko Finance — My Money page
 *
 * Design principles:
 * - No emojis. Lucide icons only.
 * - Youth-first language: "Clock it", "Stack it", "You're winning"
 * - Dark hero score card — feels like a bank card, not a form
 * - High contrast, large touch targets, mobile-first
 * - Multilingual: EN / Zulu / Sesotho
 * - Every section has a purpose a Grade 9 student understands instantly
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Share2,
  Pencil,
  X,
  Brain,
  Zap,
  Users,
  Banknote,
  PiggyBank,
  ShieldCheck,
  Flame,
  Trophy,
  Sprout,
  Rocket,
  ChevronDown,
  ChevronUp,
  Globe,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      { title: "My Money — Mdeko" },
      { name: "description", content: "Your financial identity on Mdeko." },
    ],
  }),
  component: FinancePage,
});

/* ─── helpers ─── */
function formatRand(n: number) {
  return `R${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

/* ─── tier config — icons, slogans, colours ─── */
type Tier = "Just Starting" | "Getting Going" | "Trusted" | "Champion";

const TIER_CONFIG: Record<
  Tier,
  { icon: React.ElementType; slogan: string; color: string; bg: string; ring: string }
> = {
  "Just Starting": {
    icon: Sprout,
    slogan: "Every legend started here.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  "Getting Going": {
    icon: Rocket,
    slogan: "You're building. Keep going.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
  },
  Trusted: {
    icon: ShieldCheck,
    slogan: "Clock it — you're trusted.",
    color: "text-primary",
    bg: "bg-primary/5",
    ring: "ring-primary/30",
  },
  Champion: {
    icon: Trophy,
    slogan: "You're winning. Stack more.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
};

function getTierKey(tier: string): Tier {
  if (tier.includes("Champion")) return "Champion";
  if (tier.includes("Trusted")) return "Trusted";
  if (tier.includes("Going")) return "Getting Going";
  return "Just Starting";
}

/* ─── language ─── */
type Lang = "en" | "zu" | "st";

const L: Record<Lang, Record<string, string>> = {
  en: {
    tagline: "23 million South Africans have no proof of income.",
    sub: "Every trade on Mdeko builds your financial history.",
    score: "Your Score",
    factorTrade: "How much you've sold",
    factorPaid: "Payments came through",
    factorActive: "You've been active",
    factorSaving: "You're stacking savings",
    scoreNote: "Banks look at records like this. Yours is growing.",
    aiLabel: "AI Money Tip",
    stackTitle: "Stack it",
    stackSaved: "saved",
    stackGoal: "Goal",
    stackEdit: "Change goal",
    stackTrader: "We save 5% for you every time you get paid.",
    stackBuyer: "Every order you complete adds to your stack.",
    storyTitle: "Your Record",
    storyOrders: "orders done",
    storyTraded: "traded on Mdeko",
    storyMember: "Member since",
    shareBtn: "Share my record",
    shareTitle: "My Mdeko Record",
    shareSub: "Screenshot and share your financial story.",
    bizTitle: "How Mdeko works",
    empty: "Start trading to build your financial record.",
    emptyBtn: "Find a trader",
    pctGoal: "% to goal",
  },
  zu: {
    tagline: "Izigidi ezi-23 azinazo izincwadi zemali.",
    sub: "Kuhweba kwakho ku-Mdeko kwakha umlando wakho.",
    score: "Isikalo Sakho",
    factorTrade: "Ukuthengisa kwakho",
    factorPaid: "Izikhokhelo zaze",
    factorActive: "Ukhwebe enyangeni",
    factorSaving: "Uyonga imali",
    scoreNote: "Amabhange akhangela amarekhodi anje.",
    aiLabel: "Icebo le-AI",
    stackTitle: "Buyisela",
    stackSaved: "okongwe",
    stackGoal: "Inhloso",
    stackEdit: "Shintsha inhloso",
    stackTrader: "Sibeka i-5% ngawe njalo lapho ukhokhwa.",
    stackBuyer: "Yonke imiyalo yakho iyengeza esifumleni sakho.",
    storyTitle: "Irekhodi Lakho",
    storyOrders: "imiyalo eqediwe",
    storyTraded: "okukhwebiwe ku-Mdeko",
    storyMember: "Ilungu kusukela",
    shareBtn: "Yabelana ngehrekhodi lami",
    shareTitle: "Ihrekhodi Lami le-Mdeko",
    shareSub: "Thatha isithombe wabelane.",
    bizTitle: "Indlela u-Mdeko asebenza ngayo",
    empty: "Qala ukuhweba ukwakha irekhodi lakho.",
    emptyBtn: "Thola umthengisi",
    pctGoal: "% yenhloso",
  },
  st: {
    tagline: "Dimilione tse 23 ha ba na bopaki ba chelete.",
    sub: "Kgwebo e nngwe le e nngwe ho Mdeko e haha nalane ya hao.",
    score: "Monyetla wa Hao",
    factorTrade: "O rekisitse hakae",
    factorPaid: "Ditefelo di fihletse",
    factorActive: "O sebetse kgweding",
    factorSaving: "O boloka chelete",
    scoreNote: "Dibanka di sheba direkoto tse joalo.",
    aiLabel: "Keletso ya AI",
    stackTitle: "Builetsa",
    stackSaved: "e bolokilweng",
    stackGoal: "Sepheo",
    stackEdit: "Fetola sepheo",
    stackTrader: "Re bea 5% bakeng sa hao kamehla ha o lefuwa.",
    stackBuyer: "Oda e nngwe le e nngwe e etswang e eketsa ya hao.",
    storyTitle: "Rekoto ya Hao",
    storyOrders: "dioda tse felletseng",
    storyTraded: "tse rekisitsweng ho Mdeko",
    storyMember: "Setho ho tloha",
    shareBtn: "Arolelana le rekoto ya ka",
    shareTitle: "Rekoto ya Ka ya Mdeko",
    shareSub: "Nka setshwantsho o arolelane.",
    bizTitle: "Mdeko e sebetsa jwang",
    empty: "Qala ho rekisa ho haha rekoto ya hao.",
    emptyBtn: "Fumana mochabi",
    pctGoal: "% ya sepheo",
  },
};

/* ════════════════ SHARE MODAL ════════════════ */
function ShareModal({
  name, score, tier, totalTraded, memberSince, onClose, t,
}: {
  name: string; score: number; tier: string; totalTraded: number;
  memberSince: string; onClose: () => void; t: Record<string, string>;
}) {
  const tk = getTierKey(tier);
  const cfg = TIER_CONFIG[tk];
  const TierIcon = cfg.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm animate-slide-up rounded-3xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display font-bold text-lg">{t.shareTitle}</p>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        {/* The card itself — screenshot-ready */}
        <div className="rounded-2xl bg-foreground p-5 text-background shadow-glow">
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-bold tracking-widest text-background/50 uppercase">
              Mdeko Finance
            </span>
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <p className="font-display text-2xl font-black">{name || "Mdeko Member"}</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-6xl font-black leading-none">{score}</span>
            <div className="mb-1">
              <p className="text-xs text-background/50">/ 100</p>
              <div className="flex items-center gap-1 mt-0.5">
                <TierIcon className="size-4 text-primary" />
                <span className="text-sm font-bold text-primary">{cfg.slogan}</span>
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-background/20 pt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-background/50 text-xs">{t.storyTraded}</p>
              <p className="font-bold">{formatRand(totalTraded)}</p>
            </div>
            <div>
              <p className="text-background/50 text-xs">{t.storyMember}</p>
              <p className="font-bold">{formatMonthYear(memberSince)}</p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-background/30">mdeko.app</p>
        </div>

        <p className="mt-3 text-center text-sm text-muted-foreground">{t.shareSub}</p>
      </div>
    </div>
  );
}

/* ════════════════ SCORE HERO CARD ════════════════ */
function ScoreCard({
  score, totalTraded, totalCommission, isLoading, t,
}: {
  score: ReturnType<typeof useFinanceProfile>["score"];
  totalTraded: number; totalCommission: number;
  isLoading: boolean; t: Record<string, string>;
}) {
  if (isLoading) {
    return (
      <div className="rounded-3xl bg-foreground p-6 animate-pulse">
        <Skeleton className="h-4 w-24 bg-background/20 mb-4" />
        <Skeleton className="h-16 w-32 bg-background/20 mb-3" />
        <Skeleton className="h-3 w-full bg-background/20" />
      </div>
    );
  }
  if (!score) return null;

  const tk = getTierKey(score.tier);
  const cfg = TIER_CONFIG[tk];
  const TierIcon = cfg.icon;

  const factors = [
    { label: t.factorTrade, pts: score.orderVolumePts, max: 30, icon: TrendingUp },
    { label: t.factorPaid, pts: score.paymentReliabilityPts, max: 30, icon: Banknote },
    { label: t.factorActive, pts: score.activityConsistencyPts, max: 20, icon: Flame },
    { label: t.factorSaving, pts: score.savingsBehaviourPts, max: 20, icon: PiggyBank },
  ];

  return (
    <div className="animate-slide-up rounded-3xl bg-foreground text-background overflow-hidden shadow-glow">
      {/* Hero section */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs font-bold tracking-widest text-background/50 uppercase">
            {t.score}
          </p>
          <div className="flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1">
            <TierIcon className="size-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">{cfg.slogan}</span>
          </div>
        </div>

        <div className="flex items-end gap-3 mt-2">
          <span className="font-display text-7xl font-black leading-none">{score.total}</span>
          <div className="mb-2">
            <span className="text-2xl text-background/40 font-bold">/ 100</span>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 h-2 w-full rounded-full bg-background/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${score.total}%` }}
          />
        </div>

        {/* Next step tip */}
        <p className="mt-3 text-sm text-background/70 leading-snug">{score.tip}</p>
      </div>

      {/* Business model strip */}
      {totalTraded > 0 && (
        <div className="border-t border-background/10 px-6 py-3 flex justify-between text-sm">
          <div>
            <p className="text-background/40 text-xs">Total traded</p>
            <p className="font-bold">{formatRand(totalTraded)}</p>
          </div>
          {totalCommission > 0 && (
            <div className="text-right">
              <p className="text-background/40 text-xs">Platform fee (5%)</p>
              <p className="font-bold text-primary">{formatRand(totalCommission)}</p>
            </div>
          )}
        </div>
      )}

      {/* Factor breakdown */}
      <div className="border-t border-background/10 px-6 py-4 space-y-3">
        <p className="text-xs font-bold tracking-widest text-background/40 uppercase mb-2">
          How it's calculated
        </p>
        {factors.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.label} className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background/10">
                <Icon className="size-4 text-background/70" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-background/70">{f.label}</span>
                  <span className="font-bold text-background">{f.pts}/{f.max}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-background/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(f.pts / f.max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <p className="pt-1 text-xs text-background/40">{t.scoreNote}</p>
      </div>
    </div>
  );
}

/* ════════════════ AI TIP CARD ════════════════ */
function SmartTipCard({ tip, isLoading, t }: {
  tip: string | null; isLoading: boolean; t: Record<string, string>;
}) {
  return (
    <Card className="animate-slide-up border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background ring-1 ring-primary/20">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <Brain className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-foreground">
                {t.aiLabel}
              </p>
              <Badge className="gap-1 text-[10px] px-1.5 py-0 h-4 bg-primary text-white font-bold">
                <Zap className="size-2.5" />AI
              </Badge>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <p className="text-base font-semibold text-foreground leading-snug">
                {tip ?? "Keep trading — every order builds your financial record on Mdeko."}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ════════════════ STACK IT — SAVINGS CARD ════════════════ */
function StackCard({ role, isLoading, t }: {
  role: "buyer" | "trader" | null; isLoading: boolean; t: Record<string, string>;
}) {
  const { jar, updateTarget } = useSavingsJar();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  const save = () => {
    const val = Number(input);
    if (!val || val < 10) { toast.error("Minimum goal is R10"); return; }
    updateTarget.mutate(val, {
      onSuccess: () => { toast.success("Goal updated!"); setEditing(false); setInput(""); },
    });
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse"><CardContent className="pt-5 space-y-3">
        <Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-28" /><Skeleton className="h-2 w-full" />
      </CardContent></Card>
    );
  }

  const balance = jar?.balance ?? 0;
  const target = jar?.targetAmount ?? 500;
  const pct = Math.min((balance / target) * 100, 100);

  return (
    <Card className="animate-slide-up overflow-hidden">
      {/* Coloured top strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-400 to-primary" />
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-5 text-primary" />
            <p className="font-display font-bold text-lg">{t.stackTitle}</p>
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            type="button"
          >
            <Pencil className="size-3" />{t.stackEdit}
          </button>
        </div>

        <div className="mt-3 mb-4">
          <p className="font-display text-4xl font-black text-foreground">{formatRand(balance)}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{t.stackSaved}</p>
        </div>

        {/* Progress */}
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{pct.toFixed(0)}{t.pctGoal}</span>
            <span>{t.stackGoal}: {formatRand(target)}</span>
          </div>
          <Progress value={pct} className="h-2.5" />
        </div>

        {editing && (
          <div className="flex gap-2 mt-3 mb-2">
            <Input
              type="number"
              placeholder={`New goal, e.g. 1000`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={save} disabled={updateTarget.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-snug">
          {role === "trader" ? t.stackTrader : t.stackBuyer}
        </p>
      </CardContent>
    </Card>
  );
}

/* ════════════════ YOUR RECORD CARD ════════════════ */
function RecordCard({ profile, isLoading, onShare, t }: {
  profile: ReturnType<typeof useFinanceProfile>["profile"];
  isLoading: boolean; onShare: () => void; t: Record<string, string>;
}) {
  if (isLoading) {
    return (
      <Card><CardContent className="pt-5 space-y-3">
        <Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /><Skeleton className="h-11 w-full mt-2" />
      </CardContent></Card>
    );
  }
  if (!profile) return null;

  const rows = [
    { Icon: CheckCircle2, value: `${profile.totalOrders}`, label: t.storyOrders },
    { Icon: TrendingUp, value: formatRand(profile.totalTraded), label: t.storyTraded },
    { Icon: Calendar, value: formatMonthYear(profile.memberSince), label: t.storyMember },
  ];

  return (
    <Card className="animate-slide-up">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="size-5 text-primary" />
          <p className="font-display font-bold text-lg">{t.storyTitle}</p>
        </div>

        <div className="space-y-3 mb-5">
          {rows.map(({ Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Icon className="size-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-base leading-tight">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={onShare} className="w-full gap-2 shadow-glow" size="lg">
          <Share2 className="size-5" />
          {t.shareBtn}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ════════════════ HOW MDEKO WORKS (SUSTAINABILITY) ════════════════ */
function BizCard({ t }: { t: Record<string, string> }) {
  const [open, setOpen] = useState(false);

  const streams = [
    { Icon: TrendingUp, label: "5% per order", sub: "Commission on every sale" },
    { Icon: Banknote, label: "R10–R40", sub: "Delivery fee per order" },
    { Icon: Users, label: "R60–R150/mo", sub: "Trader subscription" },
    { Icon: Brain, label: "R100–R300/mo", sub: "Analytics package" },
  ];

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4 pb-4">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          <div className="flex items-center gap-2">
            <Banknote className="size-5 text-primary" />
            <p className="font-bold text-sm">{t.bizTitle}</p>
          </div>
          {open
            ? <ChevronUp className="size-4 text-muted-foreground" />
            : <ChevronDown className="size-4 text-muted-foreground" />
          }
        </button>

        {open && (
          <div className="mt-4 space-y-3 animate-rise">
            <div className="grid grid-cols-2 gap-2">
              {streams.map(({ Icon, label, sub }) => (
                <div key={label} className="rounded-2xl bg-secondary px-3 py-3">
                  <Icon className="size-5 text-primary mb-1.5" />
                  <p className="font-bold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-foreground text-background px-4 py-3">
              <p className="text-xs font-bold tracking-widest uppercase text-background/50 mb-2">
                Break-even
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-background/60">Monthly costs</span>
                  <span className="font-bold">~R15,000–R45,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-background/60">Orders to break even</span>
                  <span className="font-bold">5,000/month</span>
                </div>
                <div className="flex justify-between border-t border-background/20 pt-1.5 mt-1.5">
                  <span className="text-background/60">200 traders × 25 orders</span>
                  <span className="font-bold text-primary">Break-even</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-secondary px-4 py-3">
              <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                6-month targets
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {[
                  { Icon: Users, v: "1,000", l: "buyers" },
                  { Icon: Users, v: "200", l: "traders" },
                  { Icon: CheckCircle2, v: "5,000", l: "orders" },
                ].map(({ Icon, v, l }) => (
                  <div key={l}>
                    <Icon className="size-4 text-primary mx-auto mb-1" />
                    <p className="font-black">{v}</p>
                    <p className="text-xs text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ════════════════ MAIN PAGE ════════════════ */
function FinancePage() {
  const session = useSession();
  const { profile, score, isLoading } = useFinanceProfile();
  const tipQuery = useSmartTip(profile);
  const [showShare, setShowShare] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const t = L[lang];

  const isNewUser = !isLoading && profile?.totalOrders === 0;

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  return (
    <main className="min-h-dvh bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button
            size="icon" variant="ghost" className="rounded-xl shrink-0"
            onClick={handleBack} aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <BrandMark subtitle="My Money" />
          </div>
          {/* Language switcher */}
          <div className="flex items-center gap-0.5 rounded-xl border bg-secondary p-1 shrink-0">
            <Globe className="size-3.5 text-muted-foreground ml-1 mr-0.5" />
            {(["en", "zu", "st"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-lg px-2 py-0.5 text-xs font-bold transition-all ${
                  lang === l
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                type="button"
                aria-label={`Switch to ${l}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Impact strip ── */}
      <div className="bg-foreground px-4 py-3">
        <p className="mx-auto max-w-lg text-center text-sm font-bold text-background leading-snug">
          {t.tagline}
        </p>
        <p className="mx-auto max-w-lg text-center text-xs text-background/60 mt-0.5">
          {t.sub}
        </p>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5 pb-12">
        {/* ── Empty state ── */}
        {isNewUser ? (
          <Card className="border-dashed animate-rise">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-3xl bg-primary/10">
                <Sprout className="size-8 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-xl mb-2">Every legend started here.</p>
                <p className="text-muted-foreground text-sm">{t.empty}</p>
              </div>
              <Button asChild size="lg" className="mt-1 shadow-glow">
                <Link to="/">{t.emptyBtn}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Card 1 — Score hero */}
            <ScoreCard
              score={score}
              totalTraded={profile?.totalTraded ?? 0}
              totalCommission={profile?.totalCommission ?? 0}
              isLoading={isLoading}
              t={t}
            />

            {/* Card 2 — AI tip */}
            <SmartTipCard tip={tipQuery.data ?? null} isLoading={tipQuery.isLoading} t={t} />

            {/* Card 3 — Stack it (savings) */}
            <StackCard role={profile?.role ?? session.role} isLoading={isLoading} t={t} />

            {/* Card 4 — Your record */}
            <RecordCard
              profile={profile}
              isLoading={isLoading}
              onShare={() => setShowShare(true)}
              t={t}
            />
          </>
        )}

        {/* Always visible — business model */}
        <BizCard t={t} />
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
          t={t}
        />
      )}
    </main>
  );
}
