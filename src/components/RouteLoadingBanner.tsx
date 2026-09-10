import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const DEFAULT_MESSAGES = [
  "Harvesting optimal routes...",
  "Analyzing live traffic...",
  "Checking toll & shortcut alternatives...",
  "Calculating seller distance...",
  "Optimizing ETA...",
];

type Props = {
  isLoading: boolean;
  messages?: string[];
  intervalMs?: number;
  onComplete?: () => void;
};

export default function RouteLoadingBanner({
  isLoading,
  messages = DEFAULT_MESSAGES,
  intervalMs = 800,
}: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isLoading, messages.length, intervalMs]);

  if (!isLoading) return null;

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm rounded-2xl bg-background/80 backdrop-blur-md border border-primary/20 p-3.5 shadow-xl transition-all duration-300 animate-slide-down"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-4 animate-spin text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider">
            Calculating Route
          </p>
          <p className="text-xs font-medium text-foreground truncate transition-all duration-200">
            {messages[index]}
          </p>
        </div>
        <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
      </div>

      {/* Looping subtle progress bar */}
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-primary/10">
        <div className="h-full bg-primary animate-pulse-progress rounded-full" />
      </div>
    </div>
  );
}
