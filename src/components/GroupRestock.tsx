import { useState } from "react";
import { Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { estimateGroupRestock } from "@/lib/group-restock";

const rand = (v: number) => `R${Math.round(v).toLocaleString("en-ZA")}`;

export default function GroupRestock() {
  const [spend, setSpend] = useState(400);
  const [traders, setTraders] = useState(100);
  const e = estimateGroupRestock(spend, traders);
  return (
    <section className="border-b py-6" aria-labelledby="restock-title">
      <h2 id="restock-title" className="flex items-center gap-2 text-lg font-semibold">
        <Truck className="size-5 text-primary" />
        Group restock · Joburg Market
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Order tonight with other traders. We buy crates in bulk at City Deep and drop them at your
        stall by 06:30. No 04:00 bakkie trip.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="rs-spend">I spend per day (R)</Label>
          <Input
            id="rs-spend"
            type="number"
            inputMode="numeric"
            min={0}
            value={spend}
            onChange={(ev) => setSpend(Number(ev.target.value) || 0)}
          />
        </div>
        <div>
          <Label htmlFor="rs-traders">Traders in group</Label>
          <Input
            id="rs-traders"
            type="number"
            inputMode="numeric"
            min={1}
            value={traders}
            onChange={(ev) => setTraders(Number(ev.target.value) || 1)}
          />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-primary bg-primary/10 p-3">
          <dt className="text-xs text-muted-foreground">I save per month</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{rand(e.monthlySaving)}</dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Group order per month</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{rand(e.groupMonthlyOrder)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Estimate only: 10% cheaper stock plus 3 saved bakkie trips (R200 each) a week. Mdeko earns
        about {rand(e.mdekoMonthlyFee)}/month from the bulk price gap, never from your R5 sales.
        Coming soon.
      </p>
    </section>
  );
}
