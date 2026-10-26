import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { catalogWith, formatRand, type CustomItem, type StockLine } from "@/lib/veggie-data";
import { saveTraderStock } from "@/lib/use-marketplace";

type Props = {
  runnerId: string;
  stock: (StockLine & { available?: boolean })[];
  customItems: CustomItem[];
  highlightItemId?: string | null;
  onSaved?: () => void | Promise<unknown>;
  onSavingChange?: (saving: boolean) => void;
};

export type StockEditorHandle = { flush: () => Promise<void> };

const StockEditor = forwardRef<StockEditorHandle, Props>(function StockEditor(
  { runnerId, stock, customItems, highlightItemId, onSaved, onSavingChange },
  ref,
) {
  const catalog = catalogWith(customItems);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const failed = useRef(false);
  const latest = useRef(stock);
  if (!saving) latest.current = stock;

  useImperativeHandle(ref, () => ({
    flush: async () => {
      await pending.current;
      if (failed.current) throw new Error("Stock changes could not be saved");
    },
  }));

  const save = (
    id: string,
    patch: { price?: number; quantity?: number; available?: boolean },
    fallback: number,
  ) => {
    setSaving(true);
    onSavingChange?.(true);
    const task = pending.current.then(async () => {
      const old = latest.current.find((line) => line.itemId === id);
      const next = {
        itemId: id,
        price: old?.price ?? fallback,
        quantity: old?.quantity ?? 1,
        available: old?.available ?? Boolean(old),
        ...patch,
      };
      await saveTraderStock(runnerId, id, next.price, next.available, next.quantity);
      latest.current = [...latest.current.filter((line) => line.itemId !== id), next];
      failed.current = false;
      await onSaved?.();
    });
    pending.current = task.catch(() => {
      failed.current = true;
      toast.error("Could not save stock — change the item to try again");
    });
    const settled = pending.current;
    void settled.then(() => {
      if (pending.current !== settled) return;
      setSaving(false);
      onSavingChange?.(false);
    });
    return task;
  };

  const lineFor = (id: string) => stock.find((s) => s.itemId === id) ?? null;

  const toggle = async (id: string, on: boolean, fallback: number) => {
    try {
      await save(
        id,
        { available: on, ...(on && (lineFor(id)?.quantity ?? 0) === 0 ? { quantity: 1 } : {}) },
        fallback,
      );
    } catch {
      toast.error("Could not save stock");
    }
  };
  const commitPrice = async (id: string, raw: string) => {
    const value = Number(raw.trim());
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid price in Rands");
      return;
    }
    try {
      await save(id, { price: Math.round(value * 100) / 100 }, value);
      setDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Price saved");
    } catch {
      toast.error("Could not save price");
    }
  };

  return (
    <Card className="mx-4 mt-4 gap-3 p-5">
      <div className="flex items-center gap-2">
        <Store className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">My stock today</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Switch on what you have and set your own price. Switched off means buyers won&apos;t see it
        from you.
      </p>
      <ul className="divide-y">
        {catalog.map((item) => {
          const Icon = item.icon;
          const line = lineFor(item.id);
          const on = Boolean(line && line.available !== false);
          const value = draft[item.id] ?? (line ? String(line.price) : "");
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 py-3 ${
                highlightItemId === item.id ? "-mx-2 rounded-xl bg-secondary px-2" : ""
              }`}
            >
              <Icon className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {line?.quantity === 0 && on
                    ? "Sold out · add quantity"
                    : `per ${item.unit} · market ${formatRand(item.price)}`}
                </p>
              </div>
              {on && (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R</span>
                  <Input
                    className="h-9 w-16"
                    inputMode="decimal"
                    aria-label={`Your price for ${item.name}`}
                    value={value}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    onBlur={(e) => commitPrice(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </div>
              )}
              {on && (
                <Input
                  className="h-9 w-16"
                  type="number"
                  min="0"
                  aria-label={`Quantity for ${item.name}`}
                  defaultValue={line?.quantity ?? 1}
                  key={`${item.id}-${line?.quantity}`}
                  onBlur={async (e) => {
                    const quantity = Number(e.target.value);
                    if (!Number.isInteger(quantity) || quantity < 0) {
                      toast.error("Enter a quantity of 0 or more");
                      return;
                    }
                    try {
                      await save(item.id, { quantity }, item.price);
                    } catch {
                      toast.error("Could not save quantity");
                    }
                  }}
                />
              )}
              <Switch
                aria-label={`I sell ${item.name}`}
                checked={on}
                onCheckedChange={(next) => toggle(item.id, next, item.price)}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {saving
          ? "Saving stock…"
          : `${stock.filter((line) => line.available !== false && (line.quantity ?? 0) > 0).length} of ${catalog.length} items in stock · changes saved automatically`}
      </p>
      {stock.length === 0 && (
        <Button
          variant="secondary"
          onClick={() => toast.info("Switch on at least one item so buyers can wave you")}
        >
          Nothing in stock yet
        </Button>
      )}
    </Card>
  );
});

export default StockEditor;
