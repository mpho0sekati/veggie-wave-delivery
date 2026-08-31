import { TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { catalogWith, formatRand, iconFor, iconKeyFromName } from "@/lib/veggie-data";
import { suggestedPrice, promoteToCatalog } from "@/lib/veggie-store";
import { setStock, type AppState } from "@/lib/veggie-store-supabase";

type Props = { state: AppState; runnerId: string; onAdded?: (itemId: string) => void };

export default function DemandInsights({ state, runnerId, onAdded }: Props) {
  const me = state.runners.find((r) => r.id === runnerId);
  const catalog = catalogWith(state.customItems);
  const online = state.runners.filter((r) => r.online);

  const rows = [...state.demand]
    .sort((a, b) => b.unfilled - a.unfilled || b.requests - a.requests)
    .slice(0, 6)
    .map((d) => {
      const item = d.itemId ? catalog.find((c) => c.id === d.itemId) : null;
      const stockedBy = d.itemId
        ? online.filter((r) => r.stock.some((s) => s.itemId === d.itemId)).length
        : 0;
      const iHaveIt = Boolean(d.itemId && me?.stock.some((s) => s.itemId === d.itemId));
      return { ...d, item, stockedBy, iHaveIt };
    });

  const add = (itemId: string) => {
    if (!me) return;
    const price = suggestedPrice(state, itemId);
    setStock(runnerId, [...me.stock, { itemId, price }]);
    onAdded?.(itemId);
    toast.success(`Added at ${formatRand(price)} — change the price if you want`);
  };

  const promote = (key: string, label: string) => {
    promoteToCatalog(key, 25);
    toast.success(`${label} is now in the catalog — switch it on in your stock`);
  };

  return (
    <Card className="mx-4 mt-4 gap-3 p-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">What&apos;s in demand</h2>
      </div>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          Nothing recorded yet. As people wave, you&apos;ll see here what they ask for most and what
          nobody nearby is selling.
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => {
          const Icon = row.item?.icon ?? iconFor(iconKeyFromName(row.label));
          return (
            <li key={row.key} className="flex items-center gap-3 rounded-2xl border px-3 py-3">
              <Icon className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.requests} wave{row.requests === 1 ? "" : "s"} ·{" "}
                  {row.item
                    ? row.stockedBy === 0
                      ? "nobody nearby sells it"
                      : `${row.stockedBy} trader${row.stockedBy === 1 ? "" : "s"} stocked`
                    : "not in the catalog yet"}
                </p>
              </div>
              {row.item ? (
                row.iHaveIt ? (
                  <Badge variant="secondary">You&apos;re stocked</Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => add(row.item!.id)}>
                    <Sparkles /> Add
                  </Button>
                )
              ) : (
                <Button size="sm" variant="secondary" onClick={() => promote(row.key, row.label)}>
                  <Sparkles /> Add to catalog
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
