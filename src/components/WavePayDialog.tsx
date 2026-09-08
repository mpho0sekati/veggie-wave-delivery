import { useState } from "react";
import { Smartphone, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRand } from "@/lib/veggie-data";
import { cn } from "@/lib/utils";
import { COMMUNITY_CREDIT_PER_ORDER, PLATFORM_FEE, MTN_FEE } from "@/lib/veggie-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  traderName: string;
  onPay: (msisdn: string) => Promise<void>;
};

function normaliseMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `27${digits.slice(1)}`;
  if (/^27\d{9}$/.test(digits)) return digits;
  if (/^\d{9}$/.test(digits)) return `27${digits}`;
  return null;
}

export default function WavePayDialog({ open, onOpenChange, amount, traderName, onPay }: Props) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const msisdn = normaliseMsisdn(phone);
  const valid = msisdn !== null;
  const totalFee = PLATFORM_FEE + MTN_FEE;
  const canPay = valid && amount >= totalFee;

  const confirm = async () => {
    if (!msisdn) {
      setError("Enter a valid SA mobile number, e.g. 0788 033 288");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onPay(msisdn);
      setPhone("");
      onOpenChange(false);
    } catch (err) {
      console.error("WavePay failed:", err);
      setError("Payment request failed — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setPhone("");
          setError("");
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> MTN MoMo Payment
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Amount summary */}
          <div className="rounded-2xl bg-secondary p-4 text-center">
            <p className="font-display text-2xl font-bold">{formatRand(amount)}</p>
            <p className="text-sm text-muted-foreground">to {traderName}</p>
          </div>

          {/* Fee breakdown — business model */}
          <div className="rounded-xl border bg-card px-4 py-3 space-y-1.5 text-xs">
            <p className="font-semibold text-sm mb-2">How your payment is split</p>
            <div className="flex justify-between text-muted-foreground">
              <span>Trader receives</span>
              <span className="font-medium text-foreground">
                {formatRand(Math.max(0, amount - PLATFORM_FEE - MTN_FEE))}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Veggie Wave fee</span>
              <span>{formatRand(PLATFORM_FEE)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>MTN MoMo fee</span>
              <span>{formatRand(MTN_FEE)}</span>
            </div>
            <div className="border-t pt-1.5 flex justify-between items-center text-primary font-semibold">
              <span className="flex items-center gap-1">You earn Community Credit</span>
              <span>+{formatRand(COMMUNITY_CREDIT_PER_ORDER)}</span>
            </div>
          </div>

          {/* Phone number */}
          <div className="space-y-2">
            <Label htmlFor="momo-phone" className="flex items-center gap-2">
              <Smartphone className="size-4" /> Your MTN mobile number
            </Label>
            <Input
              id="momo-phone"
              type="tel"
              inputMode="tel"
              placeholder="e.g. 0788 033 288"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError("");
              }}
              disabled={busy}
              className={cn(error && "border-destructive")}
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                You will get a MoMo push notification to approve.
              </p>
            )}
          </div>

          <Button variant="wave" className="w-full" disabled={!canPay || busy} onClick={confirm}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> Sending request…
              </>
            ) : (
              <>
                <Wallet /> Pay {formatRand(amount)} with MoMo
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
