import { useState } from "react";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { catalogWith, formatRand, type CustomItem, type StockLine } from "@/lib/veggie-data";
import { setStock } from "@/lib/veggie-store";

type Props = {
  runnerId: string;
  stock: StockLine[];
  customItems: CustomItem[];
  highlightItemId?: string | null;
};

export default function StockEditor({ runnerId, stock, customItems, highlightItemId }: Props) {
  const catalog = catalogWith(customItems);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const lineFor = (id: string) => stock.find((s) => s.itemId === id) ?? null;

  const toggle = (id: string, on: boolean, fallback: number) => {
    const next = on
      ? [...stock, { itemId: id, price: fallback }]
      : stock.filter((s) => s.itemId !== id);
    setStock(runnerId, next);
  };

  const commitPrice = (id: string, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a price in Rands");
      return;
    }
    setStock(
      runnerId,
      stock.map((s) => (s.itemId === id ? { ...s, price: Math.round(value * 100) / 100 } : s)),
    );
    setDraft((prev) => ({ ...prev, [id]: "" }));
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
                  />
                </div>
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
