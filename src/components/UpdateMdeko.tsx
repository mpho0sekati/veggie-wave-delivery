import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/track";

/** One tap to drop old saved copies of the app and load the newest version. */
export default function UpdateMdeko() {
  const [busy, setBusy] = useState(false);

  const update = async () => {
    setBusy(true);
    toast.loading("Getting the newest Mdeko…");
    track("app_updated");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.update().then(() => r.unregister())));
      }
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.allSettled(
          names.filter((n) => n !== "osm-tiles").map((n) => caches.delete(n)),
        );
      }
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.set("v", Date.now().toString(36));
      window.location.replace(url.toString());
    }
  };

  return (
    <button
      type="button"
      onClick={update}
      disabled={busy}
      className="flex min-w-14 flex-1 flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-1 transition-colors hover:bg-secondary active:bg-secondary"
    >
      <RefreshCw className={`size-6 text-muted-foreground ${busy ? "animate-spin" : ""}`} />
      <span className="text-[11px] font-medium leading-none text-muted-foreground">Update</span>
      <span aria-hidden className="h-0.5 w-6" />
    </button>
  );
}
