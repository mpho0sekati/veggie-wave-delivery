import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { describeToOrder, type AiOrderLine } from "@/lib/ai-order.functions";
import type { VeggieItem } from "@/lib/veggie-data";

type Props = {
  unframed?: boolean;
  catalog: VeggieItem[];
  onApply: (items: AiOrderLine[], extras: string[]) => void;
};

export default function DescribeOrder({ catalog, onApply, unframed = false }: Props) {
  const run = useServerFn(describeToOrder);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    summary: string;
    items: AiOrderLine[];
    extras: string[];
  } | null>(null);

  const submit = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await run({
        data: {
          description: text.trim(),
          catalog: catalog.map((c) => ({ id: c.id, name: c.name, unit: c.unit })),
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.items.length && !res.extras.length) {
        toast.info("Couldn't find anything to add — try describing it differently");
        return;
      }
      setResult(res);
      onApply(res.items, res.extras);
      toast.success("Your list is ready — check it below");
    } catch {
      toast.error("Couldn't make your list — please pick items below");
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) => catalog.find((c) => c.id === id);

  return (
    <div
      className={
        unframed
          ? "flex flex-col gap-3"
          : "mx-4 mt-6 flex flex-col gap-3 rounded-lg border bg-card p-4"
      }
    >
      <Label htmlFor="describe" className="flex items-center gap-2 font-semibold">
        <Wand2 className="size-4 text-primary" /> Just tell us what you need
      </Label>
      <Textarea
        id="describe"
        rows={2}
        maxLength={500}
        placeholder="e.g. veg for a chakalaka for 6 people, and some fruit for the kids"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button onClick={submit} disabled={busy || text.trim().length < 3}>
        {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
        {busy ? "Making your list…" : "Make my list"}
      </Button>
      {result && (
        <div className="space-y-1 rounded-md bg-secondary p-3 text-sm">
          <p className="text-muted-foreground">{result.summary}</p>
          <ul className="space-y-0.5">
            {result.items.map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span>
                  {l.qty} × {nameOf(l.id)?.name ?? l.id}{" "}
                  <span className="text-muted-foreground">({nameOf(l.id)?.unit})</span>
                </span>
                <span className="text-xs text-muted-foreground">{l.reason}</span>
              </li>
            ))}
          </ul>
          {result.extras.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Also asking traders for: {result.extras.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
