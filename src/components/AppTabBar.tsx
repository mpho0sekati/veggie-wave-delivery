import { Link, useRouterState } from "@tanstack/react-router";
import { Hand, LogIn, UserRound, Store, Wallet, Wand2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import InstallMdeko from "@/components/InstallMdeko";
import UpdateMdeko from "@/components/UpdateMdeko";
import { Button } from "@/components/ui/button";

type Props = {
  signedIn: boolean;
  onSignOut?: () => Promise<void>;
  /** Shows the "Make a list" helper button (buyer page only). */
  onHelp?: () => void;
  className?: string;
};

type Tab = {
  to?: "/" | "/runner" | "/finance" | "/auth" | "/profile";
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
};

/** Always-visible icon bar, like Facebook's top tabs. Nothing is hidden in a menu. */
export default function AppTabBar({ signedIn, onSignOut, onHelp, className }: Props) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const tabs: Tab[] = [
    { to: "/", label: "Buy", icon: Hand },
    ...(onHelp ? [{ label: "Make list", icon: Wand2, onClick: onHelp }] : []),
    { to: "/runner", label: "Sell", icon: Store },
    { to: "/finance", label: "Money", icon: Wallet },
    signedIn
      ? { to: "/profile", label: "Me", icon: UserRound }
      : { to: "/auth", label: "Sign in", icon: LogIn },
  ];

  return (
    <nav
      aria-label="Main"
      className={cn(
        "grid min-w-0 grid-flow-col auto-cols-[minmax(0,1fr)] items-stretch rounded-2xl border bg-background/95 px-1 py-1 shadow-lg backdrop-blur-md",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.to !== undefined && path === t.to;
        const inner = (
          <>
            <t.icon
              className={cn(
                "size-5 shrink-0 sm:size-6",
                active ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium leading-4 sm:text-[11px]",
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
          "flex h-auto min-h-14 min-w-0 w-full flex-col items-center justify-center gap-1 rounded-xl px-0 pt-2 pb-1 transition-colors hover:bg-secondary active:bg-secondary";
        return t.to ? (
          <Link key={t.label} to={t.to} className={cls} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <Button key={t.label} variant="ghost" type="button" onClick={t.onClick} className={cls}>
            {inner}
          </Button>
        );
      })}
      <UpdateMdeko />
      <InstallMdeko />
    </nav>
  );
}
