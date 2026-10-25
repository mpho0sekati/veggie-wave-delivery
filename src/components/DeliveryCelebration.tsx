import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CreateTypes } from "canvas-confetti";
import {
  DeliveryCelebrationGate,
  type CelebrationMoment,
  type DeliverySnapshot,
} from "@/lib/delivery-celebrations";

export function useDeliveryCelebrations(order: DeliverySnapshot | null | undefined) {
  const gate = useRef(new DeliveryCelebrationGate());
  const [queue, setQueue] = useState<CelebrationMoment[]>([]);
  useEffect(() => {
    if (!order) return;
    const moments = gate.current.observe(order);
    if (moments.length) setQueue((previous) => [...previous, ...moments]);
  }, [order]);
  const confirm = useCallback((id: string) => {
    if (gate.current.claim(id, "confirmation")) {
      setQueue((previous) => [...previous, "confirmation"]);
    }
  }, []);
  const dismiss = useCallback(() => setQueue((previous) => previous.slice(1)), []);
  return { moment: queue[0] ?? null, confirm, dismiss };
}

export default function DeliveryCelebration({ moment, onDone }: {
  moment: CelebrationMoment | null;
  onDone: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!moment) return;
    let disposed = false;
    let burst: CreateTypes | undefined;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void import("canvas-confetti").then(({ default: confetti }) => {
        if (disposed || !canvas.current) return;
        burst = confetti.create(canvas.current, { resize: true });
        const tokens = getComputedStyle(document.documentElement);
        // canvas-confetti accepts hex, while our theme uses modern CSS colors.
        const swatch = document.createElement("canvas");
        swatch.width = swatch.height = 1;
        const context = swatch.getContext("2d");
        if (!context) return;
        const colors = ["--primary", "--accent", "--capitec"].map((token) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = tokens.getPropertyValue(token).trim();
          context.fillRect(0, 0, 1, 1);
          const pixel = context.getImageData(0, 0, 1, 1).data;
          return `#${Array.from(pixel.slice(0, 3)).map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
        });
        void burst({
          particleCount: moment === "arrival" ? 35 : 65,
          spread: moment === "arrival" ? 65 : 95,
          origin: { x: 0.5, y: 0.65 },
          startVelocity: 32,
          ticks: 110,
          gravity: 1.1,
          colors,
          disableForReducedMotion: true,
        });
      }).catch(() => { /* The receipt still appears if animation cannot load. */ });
    }
    const timer = window.setTimeout(onDone, 2600);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      burst?.reset();
    };
  }, [moment, onDone]);

  if (!moment) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1500]" data-celebration={moment}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div role="status" aria-live="polite" className="absolute top-24 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-lg border border-primary/20 bg-background px-4 py-3 text-center text-foreground shadow-lift">
        <PartyPopper aria-hidden="true" className="mr-2 inline size-5 text-primary" />
        <span className="font-semibold">{moment === "arrival" ? "Your fresh veggies are here!" : "All done. Enjoy your veggies!"}</span>
      </div>
    </div>,
    document.body,
  );
}