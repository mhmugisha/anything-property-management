export function ordinalDay(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  const mod10 = num % 10;
  if (mod10 === 1) return `${num}st`;
  if (mod10 === 2) return `${num}nd`;
  if (mod10 === 3) return `${num}rd`;
  return `${num}th`;
}

export function formatCurrencyUGX(amount) {
  const n = Number(amount || 0);
  // Use en-US for reliable comma separators in production
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true, // Explicitly enable thousand separators
  }).format(n);
}

export function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";

  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

export function monthLabelFromRange(from, to) {
  if (!from || !to) return "";
  const a = new Date(from);
  const b = new Date(to);
  const sameMonth =
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (!sameMonth) return "";
  return a.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
