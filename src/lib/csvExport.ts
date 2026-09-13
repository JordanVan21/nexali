import type { TransactionWithCat } from "./transactions";

const CSV_HEADER = ["Date", "Type", "Category", "Merchant", "Note", "Amount"];

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds a real CSV of the given (already period/category-filtered)
 * transactions — the same rows the Reports page is currently showing, not
 * a server-generated export. Pure and DOM-free so it's directly unit
 * testable; see downloadCsv for the browser side of triggering a save.
 */
export function buildTransactionsCsv(transactions: TransactionWithCat[]): string {
  const rows = transactions.map((tx) => [
    tx.created_at ? new Date(tx.created_at).toISOString().slice(0, 10) : "",
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
