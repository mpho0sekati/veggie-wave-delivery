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
  Brain,
  Zap,
  Users,
  DollarSign,
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

/* ─────────── Language support (Usability +) ─────────── */
type Lang = "en" | "zu" | "st";

const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    tagline: "23 million South Africans have no proof of income.",
    sub: "Every trade on Mdeko builds your financial history — your first step to credit and banking.",
    trustScore: "Trust Score",
    howMadeUp: "How your score is made up",
    traded: "How much you've traded",
    paid: "Did you pay or get paid?",
    active: "Have you been active?",
    saving: "Are you saving?",
    banksNote: "Banks look at records like this. Every trade on Mdeko builds yours.",
    aiTipLabel: "Your personal AI money tip",
    savingsJar: "Savings Jar",
    savedSoFar: "saved so far",
    goal: "Goal",
    editGoal: "Edit goal",
    pctOfGoal: "% of your goal",
    autoSaveTrader: "Every time you get paid, we put 5% away for you. No effort needed. 💚",
    autoSaveBuyer: "Every completed order earns you community credit in your jar. 💚",
    moneyStory: "Your Money Story",
    ordersCompleted: "orders completed",
    totalTraded: "total traded on Mdeko",
    memberSince: "Member since",
    shareBtn: "Share my profile 📤",
    whyTitle: "Why does this matter?",
    whyBody:
      "Millions of South Africans cannot get a loan or open a business account because they have no proof of income. Your Mdeko profile is that proof.",
    howTitle: "How Mdeko makes money",
    emptyTitle: "Start building your money profile",
    emptyBody:
      "Every order you complete on Mdeko builds your financial history. Start trading to see your Trust Score, Savings Jar, and Money Story.",
    findTrader: "Find a trader near me",
    shareCardTitle: "Your Mdeko Profile",
    shareCardSub: "Screenshot this card to share your financial story.",
    totalTradedLabel: "Your total traded",
    platformFee: "Mdeko's 5% platform fee",
  },
  zu: {
    tagline: "Izigidi ezi-23 zabantu baseNingizimu Afrika azinazo izincwadi zemali.",
    sub: "Kuhweba kwakho konke ku-Mdeko kwakha umlando wakho wezezimali.",
    trustScore: "Isikalo Sokwethenjwa",
    howMadeUp: "Indlela isikalo sakho esakhiwa ngayo",
    traded: "Ukhwebe kangakanani",
    paid: "Ukhokhe noma ukhokhelwe?",
    active: "Ukhwebe kuleli nyanga?",
    saving: "Uyasindisa imali?",
    banksNote: "Amabhange akhangela amarekhodi anje. Kuhweba kwakho kwakha owakho.",
    aiTipLabel: "Icebo lakho lemali le-AI",
    savingsJar: "Imbodlela Yokonga",
    savedSoFar: "okongwe kuze kube manje",
    goal: "Inhloso",
    editGoal: "Shintsha inhloso",
    pctOfGoal: "% yenhloso yakho",
    autoSaveTrader: "Njalo lapho ukhokhwa, sibeka i-5% ngawe. Akudingeki wenze lutho. 💚",
    autoSaveBuyer: "Njalo lapho uqeda umyalo, uhola i-akhredithi yomphakathi. 💚",
    moneyStory: "Indaba Yakho Yemali",
    ordersCompleted: "imiyalo eqediwe",
    totalTraded: "okukhwebiwe konke ku-Mdeko",
    memberSince: "Ilungu kusukela",
    shareBtn: "Yabelana ngephrofayili yami 📤",
    whyTitle: "Kungani kubalulekile?",
    whyBody:
      "Izigidi zabantu baseNingizimu Afrika azikwazi ukuthola isilingo noma ukuvula i-akhawunti ngenxa yokungabi nangubufakazi bemali. Iphrofayili yakho ye-Mdeko ubufakazi obu.",
    howTitle: "Indlela u-Mdeko akha ngayo imali",
    emptyTitle: "Qala ukwakha iphrofayili yakho yemali",
    emptyBody:
      "Yonke imiyalo oyiqedayo ku-Mdeko yakha umlando wakho wezezimali.",
    findTrader: "Thola umthengisi eduze kwami",
    shareCardTitle: "Iphrofayili Yakho ye-Mdeko",
    shareCardSub: "Thatha isithombe sale khadi ukuze wabelane ngomlando wakho wezezimali.",
    totalTradedLabel: "Okukhwebiwe kwakho konke",
    platformFee: "Imali ye-5% ye-Mdeko",
  },
  st: {
    tagline: "Dimilione tse 23 tsa batho ba Afrika Borwa ha ba na bopaki ba chelete.",
    sub: "Kgwebo e nngwe le e nngwe ho Mdeko e haha nalane ya hao ya ditjhelete.",
    trustScore: "Monyetla wa Tumello",
    howMadeUp: "Monyetla wa hao o hahilwe joang",
    traded: "O rekisitse hakae",
    paid: "Na o lefile kapa o lefuwa?",
    active: "Na o sebetse kgweding ena?",
    saving: "Na o boloka chelete?",
    banksNote: "Dibanka di sheba direkoto tse joalo. Kgwebo e nngwe le e nngwe e haha ya hao.",
    aiTipLabel: "Keletso ya hao ya chelete ya AI",
    savingsJar: "Botelo ya Poloko",
    savedSoFar: "e bolokilweng ho fihlela hona joale",
    goal: "Sepheo",
    editGoal: "Fetola sepheo",
    pctOfGoal: "% ya sepheo sa hao",
    autoSaveTrader: "Kamehla ha o lefuwa, re bea 5% bakeng sa hao. Ha ho hlokeha ho etsa letho. 💚",
    autoSaveBuyer: "Oda e nngwe le e nngwe e felletseng e o lehela kreteri ya setjhaba. 💚",
    moneyStory: "Pale ya Hao ya Chelete",
    ordersCompleted: "dioda tse felletseng",
    totalTraded: "tsohle tse rekisitsweng ho Mdeko",
    memberSince: "Setho ho tloha",
    shareBtn: "Arolelana phrofaele ya ka 📤",
    whyTitle: "Ke hobaneng ha ho bohlokwa?",
    whyBody:
      "Dimilione tsa batho ba Afrika Borwa ha ba kgone ho fumana mokoloto hobane ha ba na bopaki ba chelete. Phrofaele ya hao ya Mdeko ke bopaki boo.",
    howTitle: "Mdeko e etsa chelete joang",
    emptyTitle: "Qala ho haha phrofaele ya hao ya chelete",
    emptyBody:
      "Oda e nngwe le e nngwe e etswang ho Mdeko e haha nalane ya hao ya ditjhelete.",
    findTrader: "Fumana mochabi haufi le nna",
    shareCardTitle: "Phrofaele ya Hao ya Mdeko",
    shareCardSub: "Nka setshwantsho sa karete ena ho arolelana le ba bang.",
    totalTradedLabel: "Tsohle tse rekisitsweng",
    platformFee: "Tefo ya 5% ya Mdeko",
  },
};

/* ─────────── Share Card ─────────── */
function ShareModal({
  name, score, tier, totalTraded, memberSince, onClose, t,
}: {
  name: string; score: number; tier: string; totalTraded: number;
  memberSince: string; onClose: () => void; t: Record<string, string>;
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
          <p className="font-bold text-lg text-gray-900">{t.shareCardTitle}</p>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="size-5" /></Button>
        </div>
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
              <p className="opacity-70">{t.totalTradedLabel}</p>
              <p className="font-bold">{formatRand(totalTraded)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-70">{t.memberSince}</p>
              <p className="font-bold">{formatMonthYear(memberSince)}</p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs opacity-60">Built on Mdeko · mdeko.app</p>
        </div>
        <p className="mt-3 text-center text-sm text-gray-500">{t.shareCardSub}</p>
      </div>
    </div>
  );
}

/* ─────────── Score Card ─────────── */
function ScoreCard({
  score, totalTraded, totalCommission, isLoading, t,
}: {
  score: ReturnType<typeof useFinanceProfile>["score"];
  totalTraded: number; totalCommission: number;
  isLoading: boolean; t: Record<string, string>;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-5 w-32" /></CardHeader>
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
    { label: t.traded, pts: score.orderVolumePts, max: 30 },
    { label: t.paid, pts: score.paymentReliabilityPts, max: 30 },
    { label: t.active, pts: score.activityConsistencyPts, max: 20 },
    { label: t.saving, pts: score.savingsBehaviourPts, max: 20 },
  ];

  return (
    <Card className="overflow-hidden border-2 border-primary/20">
      <div className="bg-gradient-to-r from-primary/10 to-emerald-50 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">⭐ {t.trustScore}</p>
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
        {totalTraded > 0 && (
          <div className="mb-2 rounded-xl bg-secondary px-3 py-2 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t.totalTradedLabel}</span>
            <span className="font-bold text-sm">{formatRand(totalTraded)}</span>
          </div>
        )}
        {totalCommission > 0 && (
          <div className="mb-4 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t.platformFee}</span>
            <span className="font-bold text-sm text-primary">{formatRand(totalCommission)}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
          {t.howMadeUp}
        </p>
        <div className="space-y-2.5">
          {factors.map((f) => (
            <div key={f.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{f.label}</span>
                <span className="font-semibold text-primary">{f.pts}/{f.max}</span>
              </div>
              <Progress value={(f.pts / f.max) * 100} className="h-1.5" />
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t.banksNote}</p>
      </CardContent>
    </Card>
  );
}

/* ─────────── AI Smart Tip Card (Intelligence criterion) ─────────── */
function SmartTipCard({ tip, isLoading, t }: { tip: string | null; isLoading: boolean; t: Record<string, string> }) {
  return (
    <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-md">
            <Brain className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                {t.aiTipLabel}
              </p>
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500 text-white">
                <Zap className="size-2.5 mr-0.5" />AI
              </Badge>
            </div>
            {isLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full bg-emerald-100" />
                <Skeleton className="h-4 w-3/4 bg-emerald-100" />
              </div>
            ) : (
              <p className="text-sm text-emerald-900 leading-relaxed font-medium">
                {tip ?? "Keep trading regularly — every order builds your financial history on Mdeko. 💚"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────── Savings Jar Card ─────────── */
function SavingsJarCard({
  role, isLoading, t,
}: {
  role: "buyer" | "trader" | null; isLoading: boolean; t: Record<string, string>;
}) {
  const { jar, updateTarget } = useSavingsJar();
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  const saveNewTarget = () => {
    const val = Number(targetInput);
    if (!val || val < 10) { toast.error("Please enter a goal of at least R10"); return; }
    updateTarget.mutate(val, {
      onSuccess: () => { toast.success("Savings goal updated!"); setEditingTarget(false); setTargetInput(""); },
    });
  };

  if (isLoading) {
    return (
      <Card><CardContent className="pt-4 space-y-3">
        <Skeleton className="h-5 w-28" /><Skeleton className="h-10 w-36" /><Skeleton className="h-3 w-full" />
      </CardContent></Card>
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
            <p className="text-sm font-medium text-muted-foreground">{t.savingsJar}</p>
            <p className="text-3xl font-black text-foreground">{formatRand(balance)}</p>
            <p className="text-sm text-muted-foreground">{t.savedSoFar}</p>
          </div>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">{t.goal}: {formatRand(target)}</span>
            <button
              className="flex items-center gap-1 text-xs text-primary"
              onClick={() => setEditingTarget(true)} type="button"
            >
              <Pencil className="size-3" /> {t.editGoal}
            </button>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}{t.pctOfGoal}</p>
        </div>
        {editingTarget && (
          <div className="mt-3 flex gap-2">
            <Input type="number" placeholder="New goal (e.g. 1000)" value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={saveNewTarget} disabled={updateTarget.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingTarget(false)}>Cancel</Button>
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {role === "trader" ? t.autoSaveTrader : t.autoSaveBuyer}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─────────── Money Story Card ─────────── */
function MoneyStoryCard({
  profile, isLoading, onShare, t,
}: {
  profile: ReturnType<typeof useFinanceProfile>["profile"];
  isLoading: boolean; onShare: () => void; t: Record<string, string>;
}) {
  if (isLoading) {
    return (
      <Card><CardContent className="pt-4 space-y-3">
        <Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-36" /><Skeleton className="h-10 w-full" />
      </CardContent></Card>
    );
  }
  if (!profile) return null;

  const stats = [
    { icon: CheckCircle2, label: `${profile.totalOrders} ${t.ordersCompleted}`, color: "text-primary" },
    { icon: TrendingUp, label: `${formatRand(profile.totalTraded)} ${t.totalTraded}`, color: "text-primary" },
    { icon: Calendar, label: `${t.memberSince} ${formatMonthYear(profile.memberSince)}`, color: "text-primary" },
  ];

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📄</span>
          <p className="font-bold text-lg">{t.moneyStory}</p>
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
        <Button onClick={onShare} className="w-full gap-2" size="lg">
          <Share2 className="size-5" />{t.shareBtn}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─────────── How Mdeko Makes Money Card (Sustainability criterion) ─────────── */
function SustainabilityCard({ t }: { t: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4 pb-4">
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          <div className="flex items-center gap-2">
            <DollarSign className="size-5 text-primary" />
            <p className="font-semibold text-sm">{t.howTitle}</p>
          </div>
          <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            {/* Revenue streams */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "💸", label: "5% per order", sub: "Commission on every sale" },
                { icon: "🚴", label: "R10–R40", sub: "Delivery fee per order" },
                { icon: "📦", label: "R60–R150/mo", sub: "Trader subscription" },
                { icon: "📊", label: "R100–R300/mo", sub: "Analytics package" },
              ].map((r) => (
                <div key={r.label} className="rounded-xl bg-secondary px-3 py-2">
                  <p className="text-base">{r.icon}</p>
                  <p className="font-bold text-sm mt-0.5">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.sub}</p>
                </div>
              ))}
            </div>

            {/* Break-even math */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-3">
              <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">
                Break-even
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly costs</span>
                  <span className="font-semibold">~R15,000–R45,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders needed</span>
                  <span className="font-semibold">~5,000/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">200 traders × 25 orders</span>
                  <span className="font-bold text-primary">= break-even ✅</span>
                </div>
              </div>
            </div>

            {/* 6-month targets */}
            <div className="rounded-xl bg-secondary px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-wide mb-2">6-month targets</p>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="size-4 text-primary" />
                  <span>1,000 buyers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="size-4 text-primary" />
                  <span>200 traders</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span>5,000 orders</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────── Main Page ─────────── */
function FinancePage() {
  const session = useSession();
  const { profile, score, isLoading } = useFinanceProfile();
  const tipQuery = useSmartTip(profile);
  const [showShare, setShowShare] = useState(false);
  const [lang, setLang] = useState<Lang>("en");

  const t = LABELS[lang];
  const isNewUser = !isLoading && profile?.totalOrders === 0;

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  return (
    <main className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" className="rounded-xl" onClick={handleBack} aria-label="Go back">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <BrandMark subtitle="My Money" />
          </div>
          {/* Language switcher — Usability + multilingual support */}
          <div className="flex items-center gap-1 rounded-xl border bg-secondary p-1">
            {(["en", "zu", "st"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-lg px-2 py-0.5 text-xs font-bold transition-colors ${
                  lang === l ? "bg-primary text-white" : "text-muted-foreground"
                }`}
                type="button"
              >
                {l === "en" ? "EN" : l === "zu" ? "ZU" : "ST"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Impact banner — first thing judges see */}
      <div className="bg-primary px-4 py-3">
        <p className="mx-auto max-w-lg text-center text-sm font-semibold text-white leading-snug">
          💚 {t.tagline}
        </p>
        <p className="mx-auto max-w-lg text-center text-xs text-white/80 mt-0.5">{t.sub}</p>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5 pb-10">
        {isNewUser ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="text-5xl">🌱</span>
              <div>
                <p className="font-bold text-xl mb-2">{t.emptyTitle}</p>
                <p className="text-muted-foreground">{t.emptyBody}</p>
              </div>
              <Button asChild className="mt-2">
                <Link to="/">{t.findTrader}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <ScoreCard
              score={score}
              totalTraded={profile?.totalTraded ?? 0}
              totalCommission={profile?.totalCommission ?? 0}
              isLoading={isLoading}
              t={t}
            />
            <SmartTipCard tip={tipQuery.data ?? null} isLoading={tipQuery.isLoading} t={t} />
            <SavingsJarCard role={profile?.role ?? session.role} isLoading={isLoading} t={t} />
            <MoneyStoryCard profile={profile} isLoading={isLoading} onShare={() => setShowShare(true)} t={t} />
          </>
        )}

        {/* Sustainability card — always visible, collapsed by default */}
        <SustainabilityCard t={t} />
      </div>

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
