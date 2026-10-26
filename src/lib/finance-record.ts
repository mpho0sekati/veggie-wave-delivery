import type { ExportRecord, MoneyProfile } from "./finance.functions";

// CSV is a portable, user-controlled record, not a bank submission.
function cell(value: string | number): string {
  const text = String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function createLenderRecordCsv(
  record: ExportRecord | null,
  profile: MoneyProfile | null,
): string | null {
  if (!record && !profile) return null;
  const rows: Array<Array<string | number>> = [
    ["Mdeko financial record"],
    ["Purpose", "For your own lender review; not sent to FNB"],
    ["Notice", "Not a bank statement, bank credit score or loan approval"],
    ["Scope", record ? "Latest 100 completed orders" : "Account summary and latest completed orders only; full record unavailable"],
    ["Completed orders", record?.totalOrders ?? profile?.totalOrders ?? 0],
    ["Recorded order value (ZAR)", record?.totalTraded ?? profile?.totalTraded ?? 0],
    ["Recorded savings (ZAR)", record?.savingsBalance ?? profile?.savingsJar.balance ?? 0],
    [],
    ["Date", "Type", "Description", "Amount (ZAR)", "Reference"],
  ];
  if (record) {
    for (const transaction of record.transactions) {
      rows.push([transaction.date, transaction.type === "credit" ? "Sale" : "Purchase", transaction.description, transaction.amount, transaction.reference]);
    }
  } else if (profile) {
    for (const order of profile.recentOrders) {
      rows.push([order.createdAt, order.role === "trader" ? "Sale" : "Purchase", "Completed Mdeko order", order.amount, order.id]);
    }
  }
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}