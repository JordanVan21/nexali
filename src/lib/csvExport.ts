import type { TransactionWithCat } from "./transactions";
import { formatInTimeZone } from "./timezone";

const CSV_HEADER = ["Date", "Type", "Category", "Merchant", "Note", "Amount"];

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds a real CSV of the given (already period/category-filtered)
 * transactions -- the same rows the Reports/Transactions pages are
 * currently showing, not a server-generated export. Pure and DOM-free so
 * it's directly unit testable; see downloadCsv for the browser side of
 * triggering a save.
 *
 * The Date column is formatted in `timeZone` (the user's configured
 * `profiles.timezone`), not UTC -- `occurred_at` is stored as a real
 * instant (anchored to noon in the configured timezone, see
 * src/lib/transactionDate.ts), and `.toISOString()`'s UTC calendar date
 * can disagree with the configured timezone's calendar date for any
 * offset beyond a few hours either side of UTC.
 */
export function buildTransactionsCsv(transactions: TransactionWithCat[], timeZone: string): string {
  const rows = transactions.map((tx) => [
    tx.occurred_at ? formatInTimeZone(new Date(tx.occurred_at), timeZone) : "",
    tx.categories?.type ?? "",
    tx.categories?.name ?? "Uncategorized",
    tx.merchant ?? "",
    tx.note ?? "",
    String(tx.amount),
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

/** Triggers a browser download of `content` as a file named `filename`. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
