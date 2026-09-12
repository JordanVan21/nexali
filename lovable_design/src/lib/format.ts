export function formatCurrency(amount: number, opts: { signed?: boolean } = {}) {
  const { signed = true } = opts;
  const abs = Math.abs(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  if (!signed) return abs;
  return `${amount < 0 ? "-" : "+"}${abs}`;
}

export function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
