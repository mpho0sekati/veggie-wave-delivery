import { Hand } from "lucide-react";

type Props = { subtitle?: string; className?: string };

/** Mdeko wordmark with the "Veggie Wave" slogan underneath. */
export default function BrandMark({ subtitle, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="bg-brand shadow-glow flex size-11 shrink-0 items-center justify-center rounded-2xl">
        <Hand className="animate-wave size-6 text-primary-foreground" />
      </span>
      <div className="min-w-0">
        <p className="text-brand font-display text-2xl leading-none font-bold tracking-tight">
          Mdeko
        </p>
        <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Veggie Wave
        </p>
        {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
