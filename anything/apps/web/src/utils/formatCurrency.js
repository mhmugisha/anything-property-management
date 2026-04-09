export function formatCurrencyUGX(amount) {
  const n = Number(amount || 0);
  // Use en-US for reliable comma separators in production
  // We intentionally do NOT show a currency prefix (some browsers show "USh").
  // UGX is shown in headers instead (e.g. "Total Rent (UGX)").
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true, // Explicitly enable thousand separators
  }).format(n);
}
