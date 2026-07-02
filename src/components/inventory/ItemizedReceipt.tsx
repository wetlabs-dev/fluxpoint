import { formatMoney, money } from "@/domains/public/public-utils";

type ReceiptItem = { id: string; name: string; itemType: string; quantity: number; unit: string | null; purchasePrice: unknown };

const groups = [
  { key: "livestock", label: "Livestock", types: ["FISH", "INVERT", "CORAL"] },
  { key: "plants", label: "Plants", types: ["PLANT"] },
  { key: "equipment", label: "Equipment", types: ["EQUIPMENT"] },
  { key: "substrate", label: "Substrate & hardscape", types: ["SUBSTRATE", "HARDSCAPE"] },
  { key: "consumables", label: "Consumables", types: ["BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE"] },
  { key: "other", label: "Other", types: ["OTHER"] }
];

export function ItemizedReceipt({ items }: { items: ReceiptItem[] }) {
  const rows = groups.map((group) => {
    const entries = items.filter((item) => group.types.includes(item.itemType) && money(item.purchasePrice) > 0);
    const total = entries.reduce((sum, item) => sum + money(item.purchasePrice) * Number(item.quantity || 0), 0);
    return { ...group, entries, total };
  }).filter((group) => group.entries.length);
  const grandTotal = rows.reduce((sum, group) => sum + group.total, 0);
  if (!rows.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No unit prices recorded for this tank yet.</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-muted/45 p-4">
        <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Itemized receipt</div><div className="font-display text-3xl text-primary">{formatMoney(grandTotal)}</div></div>
        <div className="text-sm text-muted-foreground">Unit price × quantity. Vendors and private notes stay private.</div>
      </div>
      <div className="divide-y divide-border">
        {rows.map((group) => {
          const percent = grandTotal ? group.total / grandTotal * 100 : 0;
          return (
            <section key={group.key} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div><h4 className="font-semibold text-primary">{group.label}</h4><p className="text-xs text-muted-foreground">{group.entries.length} line item(s) · {percent.toFixed(1)}% of total</p></div>
                <div className="font-mono text-lg font-semibold">{formatMoney(group.total)}</div>
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, percent)}%` }} /></div>
              <div className="space-y-1 text-sm">
                {group.entries.map((item) => {
                  const unit = money(item.purchasePrice);
                  const total = unit * Number(item.quantity || 0);
                  return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md bg-muted/35 px-3 py-2"><span className="truncate">{item.name} <span className="text-muted-foreground">× {item.quantity} {item.unit || ""}</span></span><span className="font-mono">{formatMoney(total)} <span className="text-xs text-muted-foreground">({formatMoney(unit)} ea.)</span></span></div>;
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
