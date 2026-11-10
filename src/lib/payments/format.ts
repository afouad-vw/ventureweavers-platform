/** Payments: shared types and pure helpers for the admin list, My space and the CSV. */

export type PayKind = "seat" | "program" | "request";
export type PayStatus = "pending" | "paid" | "refunded" | "cancelled" | "expired";
export type LedgerRow = {
  kind: PayKind;
  id: string;
  member_id: string;
  member: string;
  email: string | null;
  item: string;
  space: "Outloud" | "TVS" | "BRICKR" | "QuidQuo" | "House";
  method: string;
  amount_piasters: number;
  status: PayStatus;
  reference: string;
  created_at: string;
  paid_at: string | null;
  marked_by: string | null;
};

export const STATUS_FILTERS = ["All", "Paid", "Pending", "Refunded", "Cancelled", "Expired"] as const;
export const KIND_LABEL: Record<PayKind, string> = { seat: "Seat", program: "Program seat", request: "Payment request" };
export const METHOD_LABEL: Record<string, string> = { bank_transfer: "Bank transfer", card: "Card", wallet: "Mobile wallet", fawry: "Fawry", cash: "Cash" };

export const statusLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function statusTone(s: PayStatus): "ok" | "warn" | "draft" | "bad" {
  return s === "paid" ? "ok" : s === "pending" ? "warn" : s === "refunded" ? "bad" : "draft";
}

/** What can happen next to a payment from the admin drawer. Full refunds only. */
export function nextActions(r: Pick<LedgerRow, "kind" | "status">): ("paid" | "cancel" | "refund")[] {
  if (r.status === "pending") return ["paid", "cancel"];
  if (r.status === "expired" && r.kind === "seat") return ["paid", "cancel"];
  if (r.status === "paid") return ["refund"];
  return [];
}

export function totals(rows: Pick<LedgerRow, "status" | "amount_piasters">[]) {
  const sum = (s: PayStatus) => rows.filter((r) => r.status === s).reduce((n, r) => n + r.amount_piasters, 0);
  return {
    collected: sum("paid"),
    pending: sum("pending"),
    pendingCount: rows.filter((r) => r.status === "pending").length,
    refunded: sum("refunded"),
    transactions: rows.length,
  };
}

/** Status chip, space and search filter used by the table and the CSV export. */
export function filterLedger<T extends LedgerRow>(rows: T[], status: string, space: string, q: string): T[] {
  const needle = q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (status === "All" || statusLabel(r.status) === status) &&
      (space === "All" || r.space === space) &&
      (!needle || `${r.member} ${r.email ?? ""} ${r.item} ${r.reference}`.toLowerCase().includes(needle)),
  );
}

/** Rows for the accountant's CSV: amounts in EGP with two decimals. */
export function ledgerCsvRows(rows: LedgerRow[]): string[][] {
  return [
    ["Date", "Member", "Email", "Item", "Kind", "Space", "Method", "Amount (EGP)", "Status", "Reference", "Paid at"],
    ...rows.map((r) => [
      r.created_at.slice(0, 10),
      r.member,
      r.email ?? "",
      r.item,
      KIND_LABEL[r.kind],
      r.space,
      METHOD_LABEL[r.method] ?? r.method,
      (r.amount_piasters / 100).toFixed(2),
      statusLabel(r.status),
      r.reference,
      r.paid_at ? r.paid_at.slice(0, 16).replace("T", " ") : "",
    ]),
  ];
}
