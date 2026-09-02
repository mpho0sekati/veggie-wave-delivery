import { useState } from "react";
import { Smartphone, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRand } from "@/lib/veggie-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  traderName: string;
  /** Called with the normalised MSISDN when the buyer confirms. Parent owns loading + polling. */
  onPay: (msisdn: string) => Promise<void>;
};

/** Strip non-digits, normalise to 27XXXXXXXXX, return null if invalid. */
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
    setError("");
  };

  const confirm = async () => {
    if (!msisdn) {
      setError("Enter a valid South African mobile number, e.g. 0788 033 288");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onPay(msisdn);
      setPhone("");
      onOpenChange(false);
    } catch {
      setError("Payment request failed — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { setPhone(""); setError(""); onOpenChange(v); } }}>
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

          {/* Phone number input */}
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
              onChange={handlePhoneChange}
              disabled={busy}
              className={error ? "border-destructive" : ""}
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                You'll get a MoMo push notification to approve on your phone.
              </p>
            )}
          </div>

          <Button
            variant="wave"
            className="w-full"
            disabled={!valid || busy}
            onClick={confirm}
          >
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
