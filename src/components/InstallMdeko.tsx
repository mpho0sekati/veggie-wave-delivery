import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallMdeko() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const update = () => setInstalled(standalone.matches || navigatorWithStandalone.standalone === true);
    update();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", complete);
    standalone.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", complete);
      standalone.removeEventListener("change", update);
    };
  }, []);

  const install = async () => {
    if (!prompt) {
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setOpen(false);
    } catch {
      setOpen(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  };

  if (installed) return null;

  return (
    <>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => void install()}
        aria-label="Install Mdeko"
        title="Install Mdeko on your phone"
        className="h-auto min-w-14 flex-1 flex-col gap-1 rounded-xl px-1 pt-2 pb-1 text-muted-foreground [&_svg]:size-6"
      >
        <Download />
        <span className="text-[11px] leading-none font-medium">Install</span>
        <span aria-hidden className="h-0.5 w-6" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <Smartphone className="size-9 text-primary" />
          <DialogTitle>Install Mdeko</DialogTitle>
          <DialogDescription>Keep Mdeko on your home screen.</DialogDescription>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>Open veggie-wave-delivery.lovable.app in {ios ? "Safari" : "Chrome or your phone’s browser"}.</li>
            <li>{ios ? <span>Tap <Share className="inline size-4" aria-hidden /> Share, then <strong>Add to Home Screen</strong>.</span> : <span>Open the browser menu, then tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>}</li>
            <li>Tap <strong>{ios ? "Add" : "Install or Add"}</strong>.</li>
          </ol>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}