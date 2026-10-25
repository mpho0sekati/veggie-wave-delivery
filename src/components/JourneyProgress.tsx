import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  steps: { label: string; icon: LucideIcon }[];
  current: number;
  className?: string;
};

/** Read-only progress: the existing shopping and delivery controls remain authoritative. */
export default function JourneyProgress({ label, steps, current, className }: Props) {
  return (
    <ol aria-label={label} className={cn("flex w-full items-start", className)}>
      {steps.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        const Icon = complete ? Check : step.icon;
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            aria-label={`${step.label}${complete ? ", done" : active ? ", now" : ""}`}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 text-center"
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-4 left-[calc(50%+1rem)] h-px w-[calc(100%-2rem)]",
                  complete ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full",
                complete
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-secondary text-primary ring-2 ring-primary/30"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span
              className={cn(
                "text-[11px] leading-4",
                active || complete ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
