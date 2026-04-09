// Small helpers for numeric text inputs where we want to show thousands separators
// while still keeping the underlying value clean (no commas).

export function stripThousandsSeparators(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/,/g, "").trim();
}

export function normalizeNumberInput(value, { allowDecimal = true } = {}) {
  const raw = stripThousandsSeparators(value);
  if (!raw) return "";

  // Keep digits (and optionally a single decimal point).
  let out = "";
  let seenDot = false;

  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }

    // If decimals are not allowed (e.g. integer UGX inputs), stop reading at the
    // first dot instead of removing it and keeping the digits after it.
    // Example: "50000.00" should normalize to "50000" (not "5000000").
    if (!allowDecimal && ch === ".") {
      break;
    }

    if (allowDecimal && ch === "." && !seenDot) {
      seenDot = true;
      out += ch;
    }
  }

  return out;
}

export function formatNumberWithCommas(value, { allowDecimal = true } = {}) {
  const normalized = normalizeNumberInput(value, { allowDecimal });
  if (!normalized) return "";

  if (!allowDecimal) {
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const parts = normalized.split(".");
  const intPart = parts[0] || "";
  const decPart = parts.length > 1 ? parts[1] : null;

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decPart === null) {
    return formattedInt;
  }

  return `${formattedInt}.${decPart}`;
}
