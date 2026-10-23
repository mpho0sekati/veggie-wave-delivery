import { useState } from "react";
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
  stock: StockLine[];
  customItems: CustomItem[];
  highlightItemId?: string | null;
  onSaved?: () => void;
};

export default function StockEditor({
  runnerId,
  stock,
  customItems,
  highlightItemId,
  onSaved,
}: Props) {
  const catalog = catalogWith(customItems);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const lineFor = (id: string) => stock.find((s) => s.itemId === id) ?? null;

  const toggle = async (id: string, on: boolean, fallback: number) => {
    try {
      await saveTraderStock(
        runnerId,
        id,
        lineFor(id)?.price ?? fallback,
        on,
        lineFor(id)?.quantity ?? 1,
      );
      onSaved?.();
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
      await saveTraderStock(
        runnerId,
        id,
        Math.round(value * 100) / 100,
        true,
        lineFor(id)?.quantity ?? 1,
      );
      onSaved?.();
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
          const on = Boolean(line);
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
                  per {item.unit} · market {formatRand(item.price)}
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
                        commitPrice(item.id, e.currentTarget.value);
                      }
                    }}
                  />
                </div>
              )}
              {on && (
                <Input
                  className="h-9 w-16"
                  type="number"
                  min="1"
                  aria-label={`Quantity for ${item.name}`}
                  defaultValue={line?.quantity ?? 1}
                  key={`${item.id}-${line?.quantity}`}
                  onBlur={async (e) => {
                    const quantity = Number(e.target.value);
                    if (!Number.isInteger(quantity) || quantity < 1) {
                      toast.error("Enter a quantity of at least 1");
                      return;
                    }
                    try {
                      await saveTraderStock(
                        runnerId,
                        item.id,
                        line?.price ?? item.price,
                        true,
                        quantity,
                      );
                      onSaved?.();
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
        {stock.length} of {catalog.length} items in stock
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
}
