/**
 * ============================================================================
 * RECEIPT PARSER ADAPTER -- INTEGRATION POINT, NOT A REAL IMPLEMENTATION
 * ============================================================================
 *
 * The Split Expenses task asked for the existing "receipt image -> structured
 * receipt data" functionality to be reused. A full-repo search (source,
 * Supabase migrations, Edge Functions, package.json dependencies, docs)
 * found no such implementation anywhere in Nexali -- no OCR library, no
 * receipt/Excel Edge Function, no receipt-shaped table. Per the task's own
 * explicit fallback ("if the existing receipt parser cannot currently be
 * integrated without backend changes, build the frontend adapter/interface
 * and mock the resulting parsed receipt state... clearly document what must
 * later be connected"), this file IS that adapter: a real async function
 * with the exact input/output contract a real parser should have, backed by
 * a deterministic mock instead of a real OCR/vision call.
 *
 * TO CONNECT A REAL PARSER LATER: replace only the body of
 * parseReceiptImage() (e.g. with a call to a future Supabase Edge Function
 * or third-party OCR/vision API that accepts an image and returns this same
 * ParsedReceiptResult shape). No caller in this codebase
 * (useSplitExpensesState.ts) needs to change -- they only depend on this
 * function's signature and the ParsedReceiptResult type below.
 *
 * The mock is deterministic (never Math.random()) so repeated runs and
 * tests are stable: which of three realistic mock receipts comes back is
 * chosen from a simple hash of the file's name + size, not chance.
 *
 * TESTING HOOK: a file whose name contains "error" or "fail" (case
 * insensitive) makes this mock reject, simulating a real parser failure --
 * intentional, so the Error processing state is reachable without needing
 * a real flaky backend. Document this away once a real parser exists.
 */

export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  totalCents: number;
};

export type ParsedReceiptExtraRow = {
  label: string;
  amountCents: number;
};

export type ParsedReceiptResult = {
  merchant: string | null;
  /** ISO yyyy-mm-dd, or null if the parser could not detect a date. */
  purchaseDate: string | null;
  items: ParsedReceiptItem[];
  extraRows: ParsedReceiptExtraRow[];
  /** The full receipt total (items + extraRows) as printed on the receipt. */
  totalCents: number;
};

const MOCK_TEMPLATES: ParsedReceiptResult[] = [
  {
    merchant: "Trader Joe's",
    purchaseDate: null,
    items: [
      { name: "Milk", quantity: 1, totalCents: 450 },
      { name: "Bread", quantity: 1, totalCents: 320 },
      { name: "Eggs", quantity: 1, totalCents: 500 },
      { name: "Bananas", quantity: 1, totalCents: 210 },
    ],
    extraRows: [],
    totalCents: 1480,
  },
  {
    merchant: "Wendy's",
    purchaseDate: null,
    items: [
      { name: "Baconator", quantity: 1, totalCents: 850 },
      { name: "Fries", quantity: 2, totalCents: 650 },
      { name: "Frosty", quantity: 1, totalCents: 275 },
    ],
    extraRows: [{ label: "Sales Tax", amountCents: 145 }],
    totalCents: 1920,
  },
  {
    merchant: "Corner Coffee",
    purchaseDate: null,
    items: [
      { name: "Latte", quantity: 2, totalCents: 1050 },
      { name: "Croissant", quantity: 1, totalCents: 375 },
    ],
    extraRows: [{ label: "Tip", amountCents: 200 }],
    totalCents: 1625,
  },
];

function hashFile(file: File): number {
  const s = `${file.name}:${file.size}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Today's date, ISO yyyy-mm-dd, in the runtime's local calendar day -- a reasonable mock for "just scanned this receipt". A real parser would instead report the date actually printed on the receipt. */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Long enough to show a real "Processing" state, short enough to keep tests/dev fast. */
const MOCK_PARSE_DELAY_MS = 350;

export async function parseReceiptImage(file: File): Promise<ParsedReceiptResult> {
  await delay(MOCK_PARSE_DELAY_MS);

  if (/error|fail/i.test(file.name)) {
    throw new Error("Couldn't read this receipt image. Try a clearer photo.");
  }

  const template = MOCK_TEMPLATES[hashFile(file) % MOCK_TEMPLATES.length];
  return { ...template, purchaseDate: todayIso(), items: template.items.map((i) => ({ ...i })), extraRows: template.extraRows.map((r) => ({ ...r })) };
}
