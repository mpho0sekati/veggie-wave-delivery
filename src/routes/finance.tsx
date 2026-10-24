import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  Pencil,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSession } from "@/lib/use-session";
import {
  useFinanceProfile,
  useSmartTip,
  useSavingsJar,
  useBankBoost,
  useBankLink,
  useExportRecord,
} from "@/lib/use-finance";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "My Money — Mdeko" },
      {
        name: "description",
        content: "See your completed Mdeko orders, savings goal and financial record in one place.",
      },
      { property: "og:title", content: "My Money — Mdeko" },
      {
        property: "og:description",
        content:
          "Your Mdeko orders and savings, with optional bank connection and financial records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

function formatRand(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Lang = "en" | "zu" | "st";

const L: Record<Lang, Record<string, string>> = {
  en: {
    tagline: "23 million South Africans have no proof of income.",
    sub: "Every trade on Mdeko builds your financial history.",
    score: "Mdeko score",
    factorTrade: "How much you've sold",
    factorPaid: "Payments came through",
    factorActive: "You've been active",
    factorSaving: "You're stacking savings",
    scoreNote: "This is a Mdeko activity score, not a bank credit score.",
    aiLabel: "Money tip",
    stackTitle: "My savings",
    stackSaved: "saved",
    stackGoal: "Goal",
    stackEdit: "Change goal",
    stackTrader: "We save 5% for you every time you get paid.",
    stackBuyer: "Your saved amount on Mdeko.",
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

function SavingsSection({
  role,
  t,
}: {
  role: "buyer" | "trader" | null;
  t: Record<string, string>;
}) {
  const { jar, isLoading, updateTarget } = useSavingsJar();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const save = () => {
    const value = Number(input);
    if (!Number.isFinite(value) || value < 10) {
      toast.error("Your goal must be at least R10");
      return;
    }
    updateTarget.mutate(value, {
      onSuccess: () => {
        setEditing(false);
        toast.success("Savings goal updated");
      },
      onError: () => toast.error("Could not save your goal. Please try again."),
    });
  };
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!jar)
    return (
      <p className="text-sm text-muted-foreground">
        Your savings could not be loaded. Try again shortly.
      </p>
    );
  const pct = Math.min((jar.balance / jar.targetAmount) * 100, 100);
  return (
    <section className="border-b py-6" aria-labelledby="savings-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="savings-title" className="flex items-center gap-2 text-lg font-semibold">
          <PiggyBank className="size-5 text-primary" />
          {t.stackTitle}
        </h2>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Change savings goal"
          title="Change savings goal"
          onClick={() => {
            setInput(String(jar.targetAmount));
            setEditing(true);
          }}
        >
          <Pencil />
        </Button>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums">{formatRand(jar.balance)}</p>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {t.stackGoal}: {formatRand(jar.targetAmount)}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} className="mt-2 h-2" />
      <p className="mt-3 text-sm text-muted-foreground">
        {role === "trader" ? t.stackTrader : t.stackBuyer}
      </p>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-sm">
          <DialogTitle>My savings goal</DialogTitle>
          <DialogDescription>Choose the amount you want to save.</DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="savings-goal">Goal in rands</Label>
              <Input
                id="savings-goal"
                type="number"
                min={10}
                step="0.01"
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={updateTarget.isPending}>
              {updateTarget.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Save
              goal
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ScoreDetails({
  score,
  t,
}: {
  score: ReturnType<typeof useFinanceProfile>["score"];
  t: Record<string, string>;
}) {
  if (!score) return null;
  const factors = [
    { label: t.factorTrade, value: score.orderVolumePts, max: 30 },
    { label: t.factorPaid, value: score.paymentReliabilityPts, max: 30 },
    { label: t.factorActive, value: score.activityConsistencyPts, max: 20 },
    { label: t.factorSaving, value: score.savingsBehaviourPts, max: 20 },
  ];
  return (
    <div className="space-y-4">
      <p className="font-display text-4xl font-bold">
        {score.total}
        <span className="text-base font-normal text-muted-foreground"> / 100</span>
      </p>
      <p className="text-sm text-muted-foreground">{score.tip}</p>
      {factors.map((factor) => (
        <div key={factor.label}>
          <div className="mb-2 flex justify-between gap-3 text-sm">
            <span>{factor.label}</span>
            <span>
              {factor.value}/{factor.max}
            </span>
          </div>
          <Progress value={(factor.value / factor.max) * 100} className="h-2" />
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        This is a Mdeko activity score, not a bank credit score or a promise of a loan.
      </p>
    </div>
  );
}

const BANKS = [
  "fnb",
  "capitec",
  "nedbank",
  "absa",
  "standardbank",
  "investec",
  "tymebank",
] as const;
type BankId = (typeof BANKS)[number];
const bankNames: Record<BankId, string> = {
  fnb: "FNB",
  capitec: "Capitec",
  nedbank: "Nedbank",
  absa: "ABSA",
  standardbank: "Standard Bank",
  investec: "Investec",
  tymebank: "TymeBank",
};

function BankConnection() {
  const { data: boost, isLoading, isError } = useBankBoost();
  const { link, submitOtp } = useBankLink();
  const [step, setStep] = useState<"idle" | "form" | "otp" | "done">("idle");
  const [bank, setBank] = useState<BankId>("fnb");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const connect = async () => {
    try {
      const result = await link.mutateAsync({ bankId: bank, username, password });
      setPassword("");
      if (result.type === "success") {
        setStep("done");
        toast.success("Bank connected");
      } else if (result.type === "mfa_required") {
        setSessionToken(result.sessionToken);
        setStep("otp");
      } else toast.error(result.message);
    } catch {
      setPassword("");
      toast.error("Could not connect your bank. Please try again.");
    }
  };
  const verify = async () => {
    try {
      const result = await submitOtp.mutateAsync({ sessionToken, otp });
      if (result.type === "success") {
        setStep("done");
        setOtp("");
        setSessionToken("");
        toast.success("Bank connected");
      } else toast.error(result.message);
    } catch {
      toast.error("Could not check that code. Please try again.");
    }
  };
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (step === "done")
    return (
      <p className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="text-primary" />
        Your bank is connected.
      </p>
    );
  if (boost && boost.linkedAccounts > 0)
    return (
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt>Connected accounts</dt>
          <dd className="font-semibold">{boost.linkedAccounts}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Estimated monthly income</dt>
          <dd className="font-semibold">{formatRand(boost.estimatedMonthlyIncome)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Bank transactions</dt>
          <dd>{boost.transactionCount}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Extra Mdeko points</dt>
          <dd>{boost.boost}</dd>
        </div>
      </dl>
    );
  if (step === "idle")
    return (
      <div className="space-y-4">
        {isError && (
          <p className="text-sm text-muted-foreground">
            Bank connection status is unavailable right now.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Connect an existing bank account through Banklink to include your bank history. This is
          optional.
        </p>
        <Button className="h-11 w-full" onClick={() => setStep("form")}>
          <Building2 />
          Connect my bank
        </Button>
      </div>
    );
  if (step === "otp")
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="bank-otp">Code from your bank</Label>
          <Input
            id="bank-otp"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            inputMode="numeric"
            maxLength={8}
            autoComplete="one-time-code"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={!otp || submitOtp.isPending}>
          {submitOtp.isPending ? "Checking…" : "Confirm code"}
        </Button>
      </form>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void connect();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="bank-select">Your bank</Label>
        <Select
          value={bank}
          onValueChange={(value) => {
            const selected = BANKS.find((id) => id === value);
            if (selected) setBank(selected);
          }}
        >
          <SelectTrigger id="bank-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BANKS.map((id) => (
              <SelectItem key={id} value={id}>
                {bankNames[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bank-username">Online banking username</Label>
        <Input
          id="bank-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bank-password">Online banking password</Label>
        <Input
          id="bank-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Your details are sent to Banklink to connect your account.
      </p>
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={!username || !password || link.isPending}
      >
        {link.isPending ? "Connecting…" : "Connect my bank"}
      </Button>
    </form>
  );
}

function RecordDetails({ profile }: { profile: ReturnType<typeof useFinanceProfile>["profile"] }) {
  const { data: record, isLoading, isError, refetch, isFetching } = useExportRecord();
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if ((isError || !record) && profile)
    return (
      <div className="space-y-4">
        <div className="flex justify-between gap-3 text-sm"><span>Completed orders</span><strong>{profile.totalOrders}</strong></div>
        <div className="flex justify-between gap-3 text-sm"><span>Completed order value</span><strong>{formatRand(profile.totalTraded)}</strong></div>
        <p className="text-sm text-muted-foreground">{profile.recentOrders.length ? "Your latest completed orders" : "Your completed orders will appear here."}</p>
        <ul className="divide-y">{profile.recentOrders.map((order) => <li key={order.id} className="flex justify-between gap-3 py-3 text-sm"><span>{order.role === "trader" ? "Sale" : "Purchase"} · {formatDate(order.createdAt)}</span><strong>{formatRand(order.amount)}</strong></li>)}</ul>
        <p className="text-xs text-muted-foreground">Showing your account summary. The full record is unavailable right now.</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>Retry full record</Button>
      </div>
    );
  if (isError || !record)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Could not load your record.</p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          Try again
        </Button>
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3 text-sm">
        <span>Completed orders</span>
        <strong>{record.totalOrders}</strong>
      </div>
      <div className="flex justify-between gap-3 text-sm">
        <span>Completed order value</span>
        <strong>{formatRand(record.totalTraded)}</strong>
      </div>
      <ul className="max-h-56 divide-y overflow-y-auto">
        {record.transactions.map((transaction) => (
          <li
            key={transaction.reference}
            className="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <div className="min-w-0">
              <p>{transaction.type === "credit" ? "Sale" : "Purchase"}</p>
              <p className="text-xs text-muted-foreground">{formatDate(transaction.date)}</p>
            </div>
            <strong className="shrink-0">{formatRand(transaction.amount)}</strong>
          </li>
        ))}
      </ul>
      {record.transactions.length === 0 && (
        <p className="text-sm text-muted-foreground">Your completed orders will appear here.</p>
      )}
      <p className="text-xs text-muted-foreground">
        This is your Mdeko record, not a bank statement. Each lender decides what records it
        accepts.
      </p>
    </div>
  );
}

function FinancePage() {
  const session = useSession();
  const { profile, score, isLoading, isError } = useFinanceProfile();
  const tipQuery = useSmartTip(profile);
  const [lang, setLang] = useState<Lang>("en");
  const [panel, setPanel] = useState<"score" | "bank" | "record" | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const t = L[lang];
  const loading = session.loading || isLoading;
  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
            <Link to="/" aria-label="Back to veggies">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">Mdeko</p>
            <h1 className="text-xl font-semibold">My Money</h1>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-11"
            aria-label="Change language"
            title="Change language"
            onClick={() => setLanguageOpen(true)}
          >
            <Globe />
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-5 pb-12">
        {loading ? (
          <div className="space-y-4 py-8">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !session.userId ? (
          <section className="py-12">
            <PiggyBank className="mb-4 size-10 text-primary" />
            <h2 className="text-2xl font-semibold">Your money, in one place</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Sign in to see your Mdeko orders and savings.
            </p>
            <Button asChild className="mt-6 h-11">
              <Link to="/auth">Sign in</Link>
            </Button>
          </section>
        ) : isError || !profile ? (
          <section className="py-10">
            <h2 className="text-lg font-semibold">We couldn't load your money</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your records haven't changed.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </section>
        ) : (
          <>
            <section className="border-b py-6">
              <p className="text-sm text-muted-foreground">Completed order value</p>
              <p className="mt-2 break-words font-display text-4xl font-bold tabular-nums">
                {formatRand(profile.totalTraded)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {profile.totalOrders} completed {profile.totalOrders === 1 ? "order" : "orders"} ·
                purchases and sales
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Order totals, not your available balance.
              </p>
            </section>
            <SavingsSection role={profile.role ?? session.role} t={t} />
            <section className="border-b py-6" aria-labelledby="activity-title">
              <div className="flex items-center justify-between gap-2">
                <h2 id="activity-title" className="text-lg font-semibold">
                  Recent activity
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setPanel("record")}>
                  View record
                  <ChevronRight />
                </Button>
              </div>
              {profile.recentOrders.length > 0 ? (
                <ul className="mt-2 divide-y">
                  {profile.recentOrders.map((order) => (
                    <li key={order.id} className="flex items-center gap-3 py-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                        {order.role === "trader" ? (
                          <ArrowDownLeft className="size-5" />
                        ) : (
                          <ArrowUpRight className="size-5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {order.role === "trader" ? "Veggie sale" : "Veggie purchase"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)} · completed
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatRand(order.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-5">
                  <p className="text-sm text-muted-foreground">No completed orders yet.</p>
                  <Button asChild variant="outline" className="mt-3 h-11">
                    <Link to={profile.role === "trader" ? "/runner" : "/"}>
                      {profile.role === "trader" ? "Go to my stall" : "Pick veggies"}
                    </Link>
                  </Button>
                </div>
              )}
            </section>
            <nav aria-label="Money tools" className="divide-y">
              <Button
                variant="ghost"
                className="h-auto min-h-16 w-full justify-start gap-3 rounded-none px-0 py-4 text-left"
                onClick={() => setPanel("bank")}
              >
                <Building2 className="text-primary" />
                <span className="min-w-0 flex-1 whitespace-normal">
                  <span className="block font-semibold">My bank</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Connect an account · optional
                  </span>
                </span>
                <ChevronRight />
              </Button>
              <Button
                variant="ghost"
                className="h-auto min-h-16 w-full justify-start gap-3 rounded-none px-0 py-4 text-left"
                onClick={() => setPanel("score")}
              >
                <ShieldCheck className="text-primary" />
                <span className="min-w-0 flex-1 whitespace-normal">
                  <span className="block font-semibold">{t.score}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Your activity on Mdeko
                  </span>
                </span>
                <span className="text-sm">{score?.total ?? 0}/100</span>
                <ChevronRight />
              </Button>
            </nav>
            {tipQuery.data && (
              <aside className="mt-5 border-l-2 border-primary pl-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="size-4 text-primary" />
                  {t.aiLabel}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{tipQuery.data.replace(/â€”|â€“|â€"|ΓÇö/g, "—").replace(/â€™/g, "'")}</p>
              </aside>
            )}
          </>
        )}
      </div>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogTitle>
            {panel === "bank" ? "My bank" : panel === "score" ? t.score : "My Mdeko record"}
          </DialogTitle>
          <DialogDescription>
            {panel === "bank"
              ? "Your bank history, separate from your Mdeko orders."
              : panel === "score"
                ? "Based on your orders, payments, activity and savings."
                : "Your completed purchases and sales on Mdeko."}
          </DialogDescription>
          {panel === "bank" && <BankConnection />}
          {panel === "score" && <ScoreDetails score={score} t={t} />}
          {panel === "record" && <RecordDetails profile={profile} />}
        </DialogContent>
      </Dialog>
      <Dialog open={languageOpen} onOpenChange={setLanguageOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Language</DialogTitle>
          <DialogDescription>Choose your preferred language.</DialogDescription>
          <div className="space-y-2">
            {(["en", "zu", "st"] as Lang[]).map((value) => (
              <Button
                key={value}
                variant={value === lang ? "secondary" : "ghost"}
                className="h-11 w-full justify-between"
                onClick={() => {
                  setLang(value);
                  setLanguageOpen(false);
                }}
              >
                {value === "en" ? "English" : value === "zu" ? "isiZulu" : "Sesotho"}
                {value === lang && <CheckCircle2 />}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
