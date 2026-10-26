import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Smartphone, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRand } from "@/lib/veggie-data";
import { cn } from "@/lib/utils";
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
  payLogger.warn("Invalid MSISDN format");
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
  const canPay = valid && amount > 0;

  const confirm = async () => {
    payLogger.info("Payment confirm clicked", { amount });
    if (!msisdn) {
      payLogger.warn("Payment attempt with invalid MSISDN");
      setError("Enter a valid SA mobile number, e.g. 0788 033 288");
      return;
    }
    setBusy(true);
    setError("");
    try {
      payLogger.info("Sending payment request", { amount });
      await onPay(msisdn);
      payLogger.info("Payment request handled", { amount });
      setPhone("");
      onOpenChange(false);
    } catch {
      payLogger.error("Payment failed", { amount });
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

          <p className="text-sm text-muted-foreground">Order total includes delivery. Payment is confirmed only after you approve it with MTN MoMo.</p>

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
