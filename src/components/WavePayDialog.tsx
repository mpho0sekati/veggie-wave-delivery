import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Smartphone, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRand } from "@/lib/veggie-data";
import { cn } from "@/lib/utils";
import { COMMUNITY_CREDIT_PER_ORDER, PLATFORM_FEE, MTN_FEE } from "@/lib/veggie-store";
import { createLogger } from "@/lib/logger";

const payLogger = createLogger("WavePay");

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  traderName: string;
  onPay: (msisdn: string) => Promise<void>;
};

function normaliseMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  payLogger.debug("Normalizing MSISDN", { raw, digits, length: digits.length });
  if (/^0\d{9}$/.test(digits)) {
    payLogger.debug("MSISDN: 0-prefix format");
    return `27${digits.slice(1)}`;
  }
  if (/^27\d{9}$/.test(digits)) {
    payLogger.debug("MSISDN: 27-prefix format");
    return digits;
  }
  if (/^\d{9}$/.test(digits)) {
    payLogger.debug("MSISDN: 9-digit format");
    return `27${digits}`;
  }
  payLogger.warn("Invalid MSISDN format", { raw, digits });
  return null;
}

export default function WavePayDialog({ open, onOpenChange, amount, traderName, onPay }: Props) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Fill in the cell number the person signed up with, so they never type it twice.
  useEffect(() => {
    if (!open || phone) return;
    import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data } = await supabase.auth.getSession();
      const saved = data.session?.user.user_metadata?.phone;
      if (typeof saved === "string" && /^27\d{9}$/.test(saved)) setPhone(`0${saved.slice(2)}`);
    });
  }, [open, phone]);

  payLogger.info("WavePayDialog rendered", { open, amount, traderName });

  const msisdn = normaliseMsisdn(phone);
  const valid = msisdn !== null;
  const totalFee = PLATFORM_FEE + MTN_FEE;
  const canPay = valid && amount >= totalFee;

  payLogger.debug("Payment state", { valid, canPay, amount, totalFee, phoneLength: phone.length });

  const confirm = async () => {
    payLogger.info("Payment confirm clicked", { msisdn, amount });
    if (!msisdn) {
      payLogger.warn("Payment attempt with invalid MSISDN", { phone });
      setError("Enter a valid SA mobile number, e.g. 0788 033 288");
      return;
    }
    if (amount < totalFee) {
      payLogger.warn("Payment amount below minimum", { amount, totalFee });
    }
    setBusy(true);
    setError("");
    try {
      payLogger.info("Calling onPay", { msisdn, amount });
      await onPay(msisdn);
      payLogger.info("Payment successful", { msisdn, amount });
      setPhone("");
      onOpenChange(false);
    } catch (err) {
      payLogger.error("Payment failed", { msisdn, amount, error: err });
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

          <p className="text-center text-xs text-muted-foreground">
            Have a bank account?{" "}
            <Link to="/finance" className="font-medium text-primary underline">
              Add your bank (optional)
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
