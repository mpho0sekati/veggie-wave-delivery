import { Check } from "lucide-react";

const STEPS = [
  { key: "waving", label: "Waving" },
  { key: "accepted", label: "On the way" },
  { key: "delivered", label: "Delivered" },
  { key: "paid", label: "Paid" },
] as const;

type Props = { status: "waving" | "accepted" | "delivered" | "paid" };

/** Four-step progress rail for a wave: waving → on the way → delivered → paid. */
export default function OrderStepper({ status }: Props) {
  const current = STEPS.findIndex((s) => s.key === status);
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
