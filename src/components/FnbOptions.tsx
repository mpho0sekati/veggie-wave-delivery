import { useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Download,
  ExternalLink,
  FlaskConical,
  MessageSquareText,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createLenderRecordCsv } from "@/lib/finance-record";
import { demoBalanceCents, demoCashOutCents } from "@/lib/ewallet-demo";
import type { ExportRecord, MoneyProfile } from "@/lib/finance.functions";

const AMOUNTS = [20, 50, 100];

function maskCell(cell: string) {
  const d = cell.replace(/\D/g, "");
  if (d.length < 4) return "your cell";
  return `${d.slice(0, 3)} *** ${d.slice(-4)}`;
}

/** Demo-only eWallet cash-out simulator. No money moves and nothing is sent to FNB. */
export function FnbCashOut({ available }: { available?: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [cell, setCell] = useState("");
  const [step, setStep] = useState<"form" | "sent">("form");
  const [withdrawnCents, setWithdrawnCents] = useState(0);
  const [receipt, setReceipt] = useState<{ cents: number; remaining: number; cell: string } | null>(
    null,
  );
  const [pin] = useState(() => String(1000 + Math.floor(Math.random() * 9000)));
  const remainingCents = demoBalanceCents(available, withdrawnCents);
  const amountCents = demoCashOutCents(amount, remainingCents);
  const money = (cents: number) => `R${(cents / 100).toFixed(2)}`;

  const reset = () => {
    setStep("form");
    setAmount("");
  };
  const send = () => {
    if (amountCents === null) {
      toast.error(`Choose an amount up to ${money(remainingCents)}`);
      return;
    }
    if (cell.replace(/\D/g, "").length < 10) {
      toast.error("Enter a 10-digit SA cell number");
      return;
    }
    setReceipt({ cents: amountCents, remaining: remainingCents - amountCents, cell });
    setWithdrawnCents((previous) => previous + amountCents);
    setStep("sent");
  };

  return (
    <>
      <Button
        variant="outline"
        className="mt-4 h-auto min-h-12 w-full justify-start gap-3 whitespace-normal py-3 text-left"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Banknote className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Cash out with FNB eWallet</span>
          <span className="block text-xs font-normal text-muted-foreground">
            Get cash at an FNB ATM, no bank card · Demo
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            Mdeko savings: {money(demoBalanceCents(available))}
            {withdrawnCents > 0 && ` · Demo left: ${money(remainingCents)}`}
          </span>
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold">
            <FlaskConical className="size-3" /> Demo simulation · no real money moves
          </span>
          <DialogTitle>FNB eWallet cash-out</DialogTitle>
          {step !== "sent" ? (
            <>
              <DialogDescription>
                Try cashing out your recorded Mdeko savings. Your real savings stay unchanged.
              </DialogDescription>
              <div className="space-y-2">
                <p className="text-sm font-medium">How much?</p>
                <div className="grid grid-cols-3 gap-2">
                  {AMOUNTS.map((a) => (
                    <Button
                      key={a}
                      type="button"
                      variant={amount === String(a) ? "default" : "outline"}
                      className="min-h-11"
                      disabled={a * 100 > remainingCents}
                      onClick={() => setAmount(String(a))}
                    >
                      R{a}
                    </Button>
                  ))}
                </div>
                <p className="text-sm font-semibold">
                  Available in this demo: {money(remainingCents)}
                </p>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Amount (R)</span>
                  <Input
                    aria-label="Cash-out amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11"
                  />
                </label>
                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  disabled={remainingCents === 0}
                  onClick={() => setAmount((remainingCents / 100).toFixed(2))}
                >
                  Use full balance · {money(remainingCents)}
                </Button>
                {remainingCents === 0 && (
                  <p className="text-sm text-muted-foreground">No savings left for this demo.</p>
                )}
                {amount !== "" && amountCents === null && (
                  <p role="alert" className="text-sm text-destructive">
                    Enter an amount above R0 and no more than {money(remainingCents)}.
                  </p>
                )}
                {amountCents !== null && (
                  <p className="text-sm text-muted-foreground">
                    Left after demo cash-out: {money(remainingCents - amountCents)}
                  </p>
                )}
              </div>
              <label className="space-y-2 text-sm font-medium">
                <span className="block">Cell number</span>
                <Input
                  inputMode="tel"
                  aria-label="Cell number"
                  placeholder="082 123 4567"
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                  className="h-11"
                />
              </label>
              <Button className="min-h-12 w-full" disabled={amountCents === null} onClick={send}>
                <Smartphone />
                {amountCents === null
                  ? "Send demo eWallet"
                  : `Send ${money(amountCents)} demo eWallet`}
              </Button>
            </>
          ) : (
            <>
              <DialogDescription>This is the SMS the trader would get.</DialogDescription>
              <div className="rounded-lg border bg-secondary p-4 animate-rise">
                <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <MessageSquareText className="size-4" /> SMS · FNB
                </p>
                <p className="mt-2 text-sm">
                  Demo: {money(receipt?.cents ?? 0)} eWallet to {maskCell(receipt?.cell ?? "")} from
                  Mdeko savings. Your example ATM PIN is{" "}
                  <span className="font-bold tabular-nums">{pin}</span>. Valid 16 hours.
                </p>
              </div>
              <p className="text-sm font-semibold">
                Demo balance left: {money(receipt?.remaining ?? remainingCents)}
              </p>
              <p className="text-sm font-medium">At any FNB ATM</p>
              <ol className="space-y-2 text-sm">
                {[
                  "Tap “Cardless services”",
                  "Choose “eWallet” and type the cell number",
                  `Type the PIN ${pin}`,
                  `Take your ${money(receipt?.cents ?? 0)} cash`,
                ].map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                Demo only. Mdeko is not connected to FNB and no SMS was sent. A live version would
                need an FNB partnership.
              </p>
              <Button variant="outline" className="min-h-11" onClick={reset}>
                Try another amount
              </Button>
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={() => {
                  setWithdrawnCents(0);
                  setReceipt(null);
                  reset();
                }}
              >
                Reset demo to recorded savings
              </Button>
              <Button asChild variant="ghost" className="h-auto min-h-11 whitespace-normal">
                <a
                  href="https://www.fnb.co.za/send-money/eWallet/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Real FNB eWallet information <ExternalLink />
                </a>
              </Button>
            </>
          )}
          <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
            <ArrowLeft /> Back to My Money
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FnbAccountInfo() {
  return (
    <section className="space-y-3 border-b pb-4" aria-label="FNB business account information">
      <h3 className="flex items-center gap-2 font-semibold">
        <Building2 className="size-4 text-primary" /> FNB First Business Zero
      </h3>
      <p className="text-sm text-muted-foreground">
        Need a business account? Explore FNB’s account for sole proprietors. FNB decides
        eligibility, fees and terms. You apply directly with FNB, not through Mdeko.
      </p>
      <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3">
        <a
          href="https://www.fnb.co.za/business-banking/accounts/FirstBusinessZeroAccount.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore account at FNB <ExternalLink />
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">
        Mdeko is not partnered with or endorsed by FNB. Bank linking below is optional and separate
        from opening an account.
      </p>
    </section>
  );
}

export function DownloadLenderRecord({
  record,
  profile,
}: {
  record: ExportRecord | null;
  profile: MoneyProfile | null;
}) {
  const download = () => {
    const csv = createLenderRecordCsv(record, profile);
    if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mdeko-financial-record.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Record downloaded. Nothing was sent to FNB.");
  };
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Record for lender review">
      <Button
        className="h-auto min-h-11 w-full whitespace-normal py-3"
        onClick={download}
        disabled={!record && !profile}
      >
        <Download /> {record ? "Download record for FNB review" : "Download summary for FNB review"}
      </Button>
      <p className="text-xs text-muted-foreground">
        A CSV file for you to share yourself. Not sent to FNB; not a loan application or a promise
        of credit. FNB decides which records it accepts.
      </p>
      <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3">
        <a
          href="https://www.fnb.co.za/business/borrow.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore FNB business funding <ExternalLink />
        </a>
      </Button>
    </section>
  );
}
