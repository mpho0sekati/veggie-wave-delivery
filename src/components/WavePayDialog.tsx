import { useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRand } from "@/lib/veggie-data";
import { payWithWavePay } from "@/lib/veggie-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  balance: number;
  traderName: string;
  onPaid: () => void;
};

export default function WavePayDialog({
  open,
  onOpenChange,
  amount,
  balance,
  traderName,
  onPaid,
}: Props) {
  const [pin, setPin] = useState("");

  const confirm = () => {
    const result = payWithWavePay(pin);
    setPin("");
    if (result === "wrong-pin") {
      toast.error("Wrong PIN — try 1234 in this demo");
      return;
    }
    if (result === "insufficient") {
      toast.error("Not enough in your Mdeko Pay balance");
      return;
    }
    if (result !== "ok") {
      toast.error("No order to pay for");
      return;
    }
    onOpenChange(false);
    onPaid();
    toast.success(`${formatRand(amount)} sent to ${traderName}`);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Mdeko Pay</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-secondary p-4 text-center">
            <Wallet className="mx-auto size-6 text-primary" />
            <p className="font-display mt-2 text-2xl font-bold">{formatRand(amount)}</p>
            <p className="text-sm text-muted-foreground">
              to {traderName} · balance {formatRand(balance)}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wave-pin">Enter your 4-digit PIN</Label>
            <Input
              id="wave-pin"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <Button variant="wave" className="w-full" disabled={pin.length !== 4} onClick={confirm}>
            Pay {formatRand(amount)}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Demo balance only — no real money moves.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
