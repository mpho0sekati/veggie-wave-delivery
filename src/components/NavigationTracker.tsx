import { Check } from "lucide-react";

export type NavigationStep = {
  id: string;
  label: string;
  sublabel?: string;
  completed: boolean;
  active?: boolean;
};

type Props = {
  steps: NavigationStep[];
  className?: string;
};

export default function NavigationTracker({ steps, className = "" }: Props) {
  if (!steps || steps.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border bg-background/90 backdrop-blur-md p-3.5 shadow-lg max-w-[280px] text-xs transition-all ${className}`}
      aria-label="Navigation progress tracker"
    >
      <p className="font-semibold text-foreground mb-2.5 px-0.5 tracking-tight flex items-center justify-between">
        <span>Delivery Milestones</span>
        <span className="text-[10px] text-muted-foreground font-normal">
          {steps.filter((s) => s.completed).length}/{steps.length} completed
        </span>
      </p>

      <ol className="relative space-y-3">
        {steps.map((step, idx) => {
          const isCompleted = step.completed;
          const isActive = step.active && !isCompleted;
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.id || idx} className="relative flex items-start gap-3">
              {/* Connecting vertical line */}
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-5 -bottom-3 w-0.5 transition-colors duration-500 ${
                    isCompleted ? "bg-primary" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Milestone Icon / Circle */}
              <div
                className={`relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-500 ${
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground scale-105 shadow-glow"
                    : isActive
                      ? "border-primary bg-secondary text-primary ring-2 ring-primary/30 animate-pulse"
                      : "border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="size-3 stroke-[3]" /> : idx + 1}
              </div>

              {/* Step text content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`font-semibold transition-colors duration-300 leading-tight ${
                    isCompleted
                      ? "text-primary"
                      : isActive
                        ? "text-foreground font-bold"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {step.sublabel && (
                  <p
                    className={`text-[11px] mt-0.5 transition-colors duration-300 ${
                      isCompleted ? "text-primary/70" : "text-muted-foreground"
                    }`}
                  >
                    {step.sublabel}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
