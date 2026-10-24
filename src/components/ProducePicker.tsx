import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRand, priceFor, type Runner, type VeggieItem } from "@/lib/veggie-data";

type Props = {
  catalog: VeggieItem[];
  quantities: Record<string, number>;
  traders: Runner[];
  onChange: (id: string, delta: number) => void;
};

export default function ProducePicker({ catalog, quantities, traders, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pt-3 min-[420px]:grid-cols-3">
      {catalog.map((item) => {
        const Icon = item.icon;
        const count = quantities[item.id] ?? 0;
        const prices = traders
          .map((trader) => priceFor(trader, item.id))
          .filter((price): price is number => price !== null);
        const priceLabel = prices.length ? `From ${formatRand(Math.min(...prices))}` : item.unit;

        return (
          <div
            key={item.id}
            className={`relative flex min-w-0 flex-col overflow-hidden rounded-lg border ${count ? "border-primary bg-secondary" : "bg-card"}`}
          >
            {count > 0 && (
              <Check className="absolute right-2 top-2 size-4 text-primary" aria-hidden="true" />
            )}
            <Button
              variant="ghost"
              className="h-auto min-h-24 w-full flex-col gap-1 rounded-none px-2 py-3 hover:bg-secondary [&_svg]:size-8"
              aria-label={`Add one ${item.name}`}
              onClick={() => onChange(item.id, 1)}
            >
              <Icon className="text-primary" />
              <span className="w-full whitespace-normal break-words text-center text-sm font-semibold">
                {item.name}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{priceLabel}</span>
              {prices.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
              )}
            </Button>
            <div className="flex h-11 items-center justify-center border-t">
              {count > 0 ? (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 flex-1 rounded-none"
                    aria-label={`Remove one ${item.name}`}
                    onClick={() => onChange(item.id, -1)}
                  >
                    <Minus />
                  </Button>
                  <span
                    className="min-w-8 text-center text-base font-semibold tabular-nums"
                    aria-label={`${count} ${item.name} selected`}
                    aria-live="polite"
                  >
                    {count}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 flex-1 rounded-none text-primary"
                    aria-label={`Add another ${item.name}`}
                    onClick={() => onChange(item.id, 1)}
                  >
                    <Plus />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  className="h-11 w-full rounded-none text-primary"
                  aria-label={`Choose ${item.name}`}
                  onClick={() => onChange(item.id, 1)}
                >
                  <Plus /> Add
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}