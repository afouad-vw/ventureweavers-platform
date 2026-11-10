import { describe, expect, it } from "vitest";
import { filterLedger, ledgerCsvRows, nextActions, totals, type LedgerRow } from "./format";

const row = (o: Partial<LedgerRow>): LedgerRow => ({
  kind: "seat", id: "1", member_id: "m", member: "Mona Adel", email: "mona@x.co", item: "Show 01", space: "Outloud",
  method: "bank_transfer", amount_piasters: 45000, status: "paid", reference: "VWB-AAAAAA", created_at: "2026-11-10T08:00:00Z",
  paid_at: "2026-11-10T09:30:00Z", marked_by: null, ...o,
});

describe("payment totals", () => {
  it("sums by status", () => {
    const t = totals([row({}), row({ amount_piasters: 2000000, status: "pending" }), row({ status: "pending", amount_piasters: 100 }), row({ status: "refunded", amount_piasters: 300 }), row({ status: "cancelled" })]);
    expect(t).toEqual({ collected: 45000, pending: 2000100, pendingCount: 2, refunded: 300, transactions: 5 });
  });
});

describe("next actions", () => {
  it("allows only the right moves", () => {
    expect(nextActions({ kind: "request", status: "pending" })).toEqual(["paid", "cancel"]);
    expect(nextActions({ kind: "seat", status: "expired" })).toEqual(["paid", "cancel"]);
    expect(nextActions({ kind: "program", status: "expired" })).toEqual([]);
    expect(nextActions({ kind: "program", status: "paid" })).toEqual(["refund"]);
    expect(nextActions({ kind: "request", status: "refunded" })).toEqual([]);
  });
});

describe("filters and CSV", () => {
  const rows = [row({}), row({ id: "2", member: "Youssef", item: "Growth diagnostic", space: "BRICKR", status: "pending", reference: "VWP-ZZZZZZ" })];
  it("filters by status, space and search", () => {
    expect(filterLedger(rows, "Pending", "All", "").map((r) => r.id)).toEqual(["2"]);
    expect(filterLedger(rows, "All", "Outloud", "").map((r) => r.id)).toEqual(["1"]);
    expect(filterLedger(rows, "All", "All", "vwp-zz").map((r) => r.id)).toEqual(["2"]);
  });
  it("writes EGP with two decimals", () => {
    const csv = ledgerCsvRows([row({ amount_piasters: 45050 })]);
    expect(csv[0][7]).toBe("Amount (EGP)");
    expect(csv[1][7]).toBe("450.50");
    expect(csv[1][10]).toBe("2026-11-10 09:30");
  });
});
