import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Hand, LogIn, LogOut, Store, Wallet, Wand2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  signedIn: boolean;
  onSignOut?: () => Promise<void>;
  /** Shows the "Make a list" helper button (buyer page only). */
  onHelp?: () => void;
  className?: string;
};

type Tab = { to?: "/" | "/runner" | "/finance" | "/auth"; label: string; icon: LucideIcon; onClick?: () => void };

/** Always-visible icon bar, like Facebook's top tabs. Nothing is hidden in a menu. */
export default function AppTabBar({ signedIn, onSignOut, onHelp, className }: Props) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const tabs: Tab[] = [
    { to: "/", label: "Buy", icon: Hand },
    ...(onHelp ? [{ label: "Make list", icon: Wand2, onClick: onHelp }] : []),
    { to: "/runner", label: "Sell", icon: Store },
    { to: "/finance", label: "Money", icon: Wallet },
    signedIn
      ? {
          label: "Sign out",
          icon: LogOut,
          onClick: async () => {
            await onSignOut?.();
            toast.success("Signed out");
            navigate({ to: "/auth" });
          },
        }
      : { to: "/auth", label: "Sign in", icon: LogIn },
  ];

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex items-stretch justify-around rounded-2xl border bg-background/95 px-1 py-1 shadow-lg backdrop-blur-md",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.to !== undefined && path === t.to;
        const inner = (
          <>
            <t.icon className={cn("size-6", active ? "text-primary" : "text-muted-foreground")} />
            <span
              className={cn(
                "text-[11px] font-medium leading-none",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {t.label}
            </span>
            <span
              aria-hidden
              className={cn("h-0.5 w-6 rounded-full", active ? "bg-primary" : "bg-transparent")}
            />
          </>
        );
        const cls =
          "flex min-w-14 flex-1 flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-1 transition-colors hover:bg-secondary active:bg-secondary";
        return t.to ? (
          <Link key={t.label} to={t.to} className={cls} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <button key={t.label} type="button" onClick={t.onClick} className={cls}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
