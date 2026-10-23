import { useEffect, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type GuideStep = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

type Props = { storageKey: string; steps: GuideStep[] };

/** Short swipe-through guide shown once per device on the first visit. */
export default function WelcomeGuide({ storageKey, steps }: Props) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      /* storage blocked: skip guide */
    }
  }, [storageKey]);

  const close = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const step = steps[i];
  if (!step) return null;
  const Icon = step.icon;
  const last = i === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm gap-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-8 text-primary" />
        </div>
        <div className="space-y-2">
          <DialogTitle className="text-xl">{step.title}</DialogTitle>
          <DialogDescription>{step.body}</DialogDescription>
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden>
          {steps.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={close}>
            Skip
          </Button>
          <Button className="flex-1" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? "Let's go" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
