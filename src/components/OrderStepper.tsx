import { Check, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import type { WaveStatus } from "@/lib/veggie-store";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  { key: "waving", label: "Waving" },
  { key: "accepted", label: "On the way" },
  { key: "delivered", label: "Delivered" },
  { key: "paid", label: "Paid" },
] as const;

type Props = { status: WaveStatus };

/** Four-step progress rail for a wave: waving → on the way → delivered → paid, with special handling for cancelled/failed/refunded. */
export default function OrderStepper({ status }: Props) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        <XCircle className="size-4 text-destructive shrink-0" />
        <span className="font-semibold text-foreground">Order Cancelled</span>
        <Badge variant="outline" className="ml-auto text-xs">
          Cancelled
        </Badge>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        <span className="font-semibold">Delivery Failed</span>
        <Badge variant="destructive" className="ml-auto text-xs">
          Failed
        </Badge>
      </div>
    );
  }

  if (status === "refunded") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-primary">
        <RefreshCw className="size-4 shrink-0" />
        <span className="font-semibold">Refund Processed</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          Refunded
        </Badge>
      </div>
    );
  }

  const current = STEPS.findIndex((s) => s.key === (status === "delivering" ? "accepted" : status));
  return (
    <ol className="flex items-start gap-1" aria-label="Order progress">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={`h-0.5 flex-1 rounded-full ${index === 0 ? "bg-transparent" : done || active ? "bg-primary" : "bg-border"}`}
              />
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.65rem] font-bold transition-colors ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary text-primary shadow-glow"
                      : "border-border text-muted-foreground"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={`h-0.5 flex-1 rounded-full ${index === STEPS.length - 1 ? "bg-transparent" : done ? "bg-primary" : "bg-border"}`}
              />
            </div>
            <span
              className={`text-[0.7rem] leading-tight ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
