import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toDateStr(value) {
  // The db driver can return dates as strings or Date objects.
  // Also, some environments throw on Date#toLocaleDateString with certain locales;
  // so we keep date formatting minimal and predictable.
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  if (!s) return null;

  // Common case: 'YYYY-MM-DD' (or an ISO timestamp)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function monthLabel(year, month) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const m = months[(month || 1) - 1] || "";
  return `${m} ${year}`.trim();
}

// NEW: short month names for arrears labels
function shortMonthName(month) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[(month || 1) - 1] || "";
}

// NEW: extract user notes from arrears invoice description
function extractArrearsUserNotes(description) {
  // Description format is "Arrears before lease date. - <user notes>"
  const s = String(description || "");
  const marker = "Arrears before lease date. - ";
  if (s.startsWith(marker)) {
    return s.slice(marker.length).trim();
  }
  // fallback: if it contains " - ", take everything after the first " - "
  const idx = s.indexOf(" - ");
  if (idx >= 0) {
    return s.slice(idx + 3).trim();
  }
  return "";
}

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function computeFeeForGross({ feeType, percent, fixedAmount, gross }) {
  const t = String(feeType || "percent").toLowerCase();
  if (gross <= 0) return 0;
  if (t === "percent") {
    return round2((gross * Number(percent || 0)) / 100);
  }
  if (t === "fixed") {
    return Math.min(Number(fixedAmount || 0), gross);
  }
  return 0;
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const landlordId = toNumber(searchParams.get("landlordId"));
    const propertyId = toNumber(searchParams.get("propertyId"));
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    if (from && !isIsoDate(from)) {
      return Response.json(
        { error: "from must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }
    if (to && !isIsoDate(to)) {
      return Response.json(
        { error: "to must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    // Integer year-month values for period-based filtering of rent invoices.
    // Invoices are often created before the month starts (e.g. Dec 28 for Jan rent),
    // so filtering by invoice_date would silently drop them from the display window.
    let fromYM = null;
    let toYM = null;
    if (from) {
      const [fy, fm] = from.split("-").map(Number);
      fromYM = fy * 100 + fm;
    }
    if (to) {
      const [ty, tm] = to.split("-").map(Number);
      toYM = ty * 100 + tm;
    }

    if (!landlordId || !propertyId) {
      return Response.json(
        { error: "landlordId and propertyId are required" },
        { status: 400 },
      );
    }

    const landlordRows = await sql`
      SELECT id, title, full_name, due_date
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const landlord = landlordRows?.[0] || null;
    if (!landlord)
      return Response.json({ error: "Landlord not found" }, { status: 404 });

    const propertyRows = await sql`
      SELECT id, property_name,
             management_fee_type, management_fee_percent, management_fee_fixed_amount,
             landlord_id
      FROM properties
      WHERE id = ${propertyId}
      LIMIT 1
    `;

    const property = propertyRows?.[0] || null;
    if (!property)
      return Response.json({ error: "Property not found" }, { status: 404 });

    if (Number(property.landlord_id) !== Number(landlordId)) {
      return Response.json(
        { error: "This property is not linked to the selected landlord" },
        { status: 400 },
      );
    }

    // Account 2100 = Due to Landlords — used to determine credit/debit direction
    // for manual_adjustment transactions.
    const acct2100Rows = await sql`
      SELECT id FROM chart_of_accounts WHERE account_code = '2100' LIMIT 1
    `;
    const acct2100Id = Number(acct2100Rows?.[0]?.id) || null;

    const feeType = String(
      property?.management_fee_type || "percent",
    ).toLowerCase();
    const percent = Number(property?.management_fee_percent || 0);
    const fixedAmount = Number(property?.management_fee_fixed_amount || 0);

    // Build opening balance (everything before 'from')
    // openingFrom (date string) is used for payout/deduction/reversal queries.
    // Rent invoices use fromYM (integer) so early-dated invoices aren't misclassified.
    const openingFrom = from ? from : "1900-01-01";

    // Opening credits: net payable for months before from
    // REGULAR rent invoices (lease_id IS NOT NULL) grouped by month
    const openingGroups = fromYM
      ? await sql(
          `
        SELECT
          i.invoice_year,
          i.invoice_month,
          COALESCE(SUM(i.amount), 0)::numeric AS gross_rent
        FROM invoices i
        WHERE i.property_id = $1
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND i.lease_id IS NOT NULL
          AND i.invoice_year * 100 + i.invoice_month < $2
        GROUP BY i.invoice_year, i.invoice_month
      `,
          [propertyId, fromYM],
        )
      : [];

    // Opening credits from ARREARS invoices (lease_id IS NULL) — individual amounts
    const openingArrearsRows = await sql(
      `
        SELECT COALESCE(SUM(i.amount), 0)::numeric AS total
        FROM invoices i
        WHERE i.property_id = $1
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND i.lease_id IS NULL
          AND i.invoice_date < $2::date
      `,
      [propertyId, openingFrom],
    );

    const openingArrearsTotal = Number(openingArrearsRows?.[0]?.total || 0);

    // FIXED: Opening balance calculation
    // 1. Calculate fees ONLY on regular rent (not arrears)
    // 2. Add arrears at FULL amount (no fee deduction)
    const openingCreditsRent = (openingGroups || []).reduce((sum, g) => {
      const gross = Number(g.gross_rent || 0);
      const fee = computeFeeForGross({ feeType, percent, fixedAmount, gross });
      const net = gross - fee;
      return sum + net;
    }, 0);

    // Opening credits = rent (net of fees) + arrears (full amount)
    const openingCredits = openingCreditsRent + openingArrearsTotal;

    const openingDebitsPayoutRows = await sql`
      SELECT COALESCE(SUM(lp.amount), 0) AS total
      FROM landlord_payouts lp
      WHERE lp.landlord_id = ${landlordId}
        AND lp.property_id = ${propertyId}
        AND lp.payout_date < ${openingFrom}::date
        AND COALESCE(lp.is_deleted, false) = false
        AND NOT EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.source_type = 'landlord_payout'
            AND t.source_id = lp.id
            AND COALESCE(t.is_deleted, false) = true
        )
    `;

    const openingDebitsDedRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM landlord_deductions
      WHERE landlord_id = ${landlordId}
        AND property_id = ${propertyId}
        AND deduction_date < ${openingFrom}::date
        AND COALESCE(is_deleted,false) = false
    `;

    // Opening debits from invoice reversals (rent_reversal + mgmt_fee_reversal)
    const openingDebitsReversalsRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions t
      WHERE t.property_id = ${propertyId}
        AND t.source_type IN ('rent_reversal', 'mgmt_fee_reversal')
        AND t.transaction_date < ${openingFrom}::date
        AND COALESCE(t.is_deleted, false) = false
    `;

    const openingDebits =
      Number(openingDebitsPayoutRows?.[0]?.total || 0) +
      Number(openingDebitsDedRows?.[0]?.total || 0) +
      Number(openingDebitsReversalsRows?.[0]?.total || 0);

    // Opening manual_adjustment net (credit to 2100 = more owed to landlord)
    let openingManualAdjNet = 0;
    if (from && acct2100Id) {
      const openingManualAdjRows = await sql(
        `
          SELECT t.amount, t.debit_account_id, t.credit_account_id
          FROM transactions t
          WHERE t.property_id = $1
            AND t.source_type = 'manual_adjustment'
            AND COALESCE(t.is_deleted, false) = false
            AND t.transaction_date < $2::date
        `,
        [propertyId, from],
      );
      for (const t of openingManualAdjRows || []) {
        const amount = Number(t.amount || 0);
        if (Number(t.credit_account_id) === acct2100Id) openingManualAdjNet += amount;
        else if (Number(t.debit_account_id) === acct2100Id) openingManualAdjNet -= amount;
      }
    }

    let openingBalance = openingCredits + openingManualAdjNet - openingDebits;

    // Monthly credits (net payable) for months in range
    // REGULAR rent invoices only (lease_id IS NOT NULL)
    const creditsWhere = [
      "i.property_id = $1",
      "i.status <> 'void'",
      "COALESCE(i.is_deleted, false) = false",
      "COALESCE(i.approval_status, 'approved') = 'approved'",
      "i.lease_id IS NOT NULL",
    ];
    const creditsValues = [propertyId];

    if (fromYM !== null) {
      creditsWhere.push(`i.invoice_year * 100 + i.invoice_month >= $${creditsValues.length + 1}`);
      creditsValues.push(fromYM);
    }

    if (toYM !== null) {
      creditsWhere.push(`i.invoice_year * 100 + i.invoice_month <= $${creditsValues.length + 1}`);
      creditsValues.push(toYM);
    }

    const creditsQuery = `
      SELECT
        i.invoice_year,
        i.invoice_month,
        MIN(i.invoice_date) AS invoice_date,
        COALESCE(SUM(i.amount), 0)::numeric AS gross_rent
      FROM invoices i
      WHERE ${creditsWhere.join(" AND ")}
      GROUP BY i.invoice_year, i.invoice_month
      ORDER BY i.invoice_year ASC, i.invoice_month ASC
    `;

    const creditGroups = await sql(creditsQuery, creditsValues);

    // ARREARS invoices (lease_id IS NULL) — returned as individual lines
    // NOTE: No void filter - arrears should show even after reversal
    const arrearsWhere = [
      "i.property_id = $1",
      "COALESCE(i.is_deleted, false) = false",
      "COALESCE(i.approval_status, 'approved') = 'approved'",
      "i.lease_id IS NULL",
    ];
    const arrearsValues = [propertyId];

    if (from) {
      arrearsWhere.push(`i.invoice_date >= $${arrearsValues.length + 1}::date`);
      arrearsValues.push(from);
    }

    if (to) {
      arrearsWhere.push(`i.invoice_date <= $${arrearsValues.length + 1}::date`);
      arrearsValues.push(to);
    }

    const arrearsQuery = `
      SELECT
        i.id,
        i.invoice_date,
        i.invoice_year,
        i.invoice_month,
        i.description,
        i.amount
      FROM invoices i
      WHERE ${arrearsWhere.join(" AND ")}
      ORDER BY i.invoice_year ASC, i.invoice_month ASC, i.id ASC
    `;

    const arrearsInvoices = await sql(arrearsQuery, arrearsValues);

    // FIXED: Management fees should ONLY be calculated on REGULAR rent (lease_id IS NOT NULL)
    // NOT on arrears. Arrears fees come from landlord_deductions instead.
    // Build fee-per-month map from REGULAR RENT ONLY (not including arrears)
    const rentOnlyWhere = [
      "i.property_id = $1",
      "i.status <> 'void'",
      "COALESCE(i.is_deleted, false) = false",
      "COALESCE(i.approval_status, 'approved') = 'approved'",
      "i.lease_id IS NOT NULL", // ONLY regular rent
    ];
    const rentOnlyValues = [propertyId];

    if (fromYM !== null) {
      rentOnlyWhere.push(
        `i.invoice_year * 100 + i.invoice_month >= $${rentOnlyValues.length + 1}`,
      );
      rentOnlyValues.push(fromYM);
    }

    if (toYM !== null) {
      rentOnlyWhere.push(
        `i.invoice_year * 100 + i.invoice_month <= $${rentOnlyValues.length + 1}`,
      );
      rentOnlyValues.push(toYM);
    }

    const rentOnlyQuery = `
      SELECT
        i.invoice_year,
        i.invoice_month,
        COALESCE(SUM(i.amount), 0)::numeric AS gross_rent
      FROM invoices i
      WHERE ${rentOnlyWhere.join(" AND ")}
      GROUP BY i.invoice_year, i.invoice_month
      ORDER BY i.invoice_year ASC, i.invoice_month ASC
    `;

    const rentOnlyGroups = await sql(rentOnlyQuery, rentOnlyValues);

    // Build fee-per-month map from REGULAR RENT ONLY
    const feePerMonth = new Map();
    for (const g of rentOnlyGroups || []) {
      const key = `${g.invoice_year}-${g.invoice_month}`;
      const gross = Number(g.gross_rent || 0);
      const fee = computeFeeForGross({ feeType, percent, fixedAmount, gross });
      feePerMonth.set(key, fee);
    }

    // Credit rows for REGULAR rent (fee deducted from rent line)
    const creditRows = (creditGroups || []).map((g) => {
      const year = Number(g.invoice_year);
      const month = Number(g.invoice_month);
      const date = new Date(year, month - 1, 1);
      const label = monthLabel(year, month);

      const grossRent = Number(g.gross_rent || 0);
      const key = `${year}-${month}`;
      const monthFee = feePerMonth.get(key) || 0;
      const netPayable = grossRent - monthFee;

      return {
        kind: "credit",
        date:
          toDateStr(date) ||
          `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
        description: `Rent payable for: ${label}`,
        debit: 0,
        credit: netPayable,
      };
    });

    // Credit rows for ARREARS (separate lines, no fee deducted from individual arrears lines)
    const arrearsRows = (arrearsInvoices || []).map((inv) => {
      const month = Number(inv.invoice_month);
      const year = Number(inv.invoice_year);
      const userNotes = extractArrearsUserNotes(inv.description);
      const monthName = shortMonthName(month);
      const arrearsDesc = userNotes
        ? `Arrears for ${monthName} ${year} - ${userNotes}`
        : `Arrears for ${monthName} ${year}`;

      return {
        kind: "credit",
        date:
          toDateStr(inv.invoice_date) ||
          `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
        description: arrearsDesc,
        debit: 0,
        credit: Number(inv.amount || 0),
      };
    });

    // Debits: payouts
    const payoutWhere = [
      "lp.landlord_id = $1",
      "lp.property_id = $2",
      "COALESCE(lp.is_deleted,false) = false",
      `NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.source_type = 'landlord_payout'
          AND t.source_id = lp.id
          AND COALESCE(t.is_deleted, false) = true
      )`,
    ];
    const payoutValues = [landlordId, propertyId];

    if (from) {
      payoutWhere.push(`lp.payout_date >= $${payoutValues.length + 1}::date`);
      payoutValues.push(from);
    }

    if (to) {
      payoutWhere.push(`lp.payout_date <= $${payoutValues.length + 1}::date`);
      payoutValues.push(to);
    }

    const payoutsQuery = `
      SELECT lp.id, lp.payout_date, lp.amount, lp.payment_method, lp.reference_number
      FROM landlord_payouts lp
      WHERE ${payoutWhere.join(" AND ")}
      ORDER BY lp.payout_date ASC, lp.id ASC
    `;

    const payouts = await sql(payoutsQuery, payoutValues);

    const payoutRows = payouts.map((p) => {
      const ref = p.reference_number ? ` (${p.reference_number})` : "";
      return {
        kind: "debit",
        date: toDateStr(p.payout_date),
        description: `Landlord payout - ${p.payment_method}${ref}`,
        debit: Number(p.amount || 0),
        credit: 0,
      };
    });

    // Debits: deductions
    const dedWhere = [
      "landlord_id = $1",
      "property_id = $2",
      "COALESCE(is_deleted,false) = false",
    ];
    const dedValues = [landlordId, propertyId];

    if (from) {
      dedWhere.push(`deduction_date >= $${dedValues.length + 1}::date`);
      dedValues.push(from);
    }

    if (to) {
      dedWhere.push(`deduction_date <= $${dedValues.length + 1}::date`);
      dedValues.push(to);
    }

    const dedQuery = `
      SELECT id, deduction_date, amount, description
      FROM landlord_deductions
      WHERE ${dedWhere.join(" AND ")}
      ORDER BY deduction_date ASC, id ASC
    `;

    const deductions = await sql(dedQuery, dedValues);

    const deductionRows = deductions.map((d) => {
      return {
        kind: "debit",
        date: toDateStr(d.deduction_date),
        description: `Deduction - ${d.description}`,
        debit: Number(d.amount || 0),
        credit: 0,
      };
    });

    // Debits: invoice reversals (rent_reversal ONLY - no mgmt_fee_reversal)
    const reversalsWhere = [
      "property_id = $1",
      "source_type = 'rent_reversal'",
      "COALESCE(t.is_deleted, false) = false",
    ];
    const reversalsValues = [propertyId];

    if (from) {
      reversalsWhere.push(
        `transaction_date >= $${reversalsValues.length + 1}::date`,
      );
      reversalsValues.push(from);
    }

    if (to) {
      reversalsWhere.push(
        `transaction_date <= $${reversalsValues.length + 1}::date`,
      );
      reversalsValues.push(to);
    }

    const reversalsQuery = `
      SELECT
        t.id,
        t.transaction_date,
        t.description,
        t.amount,
        t.source_type,
        t.reference_number
      FROM transactions t
      WHERE ${reversalsWhere.join(" AND ")}
      ORDER BY t.transaction_date ASC, t.id ASC
    `;

    const reversals = await sql(reversalsQuery, reversalsValues);

    const reversalRows = reversals.map((r) => {
      const ref = r.reference_number ? ` (${r.reference_number})` : "";

      return {
        kind: "debit",
        date: toDateStr(r.transaction_date),
        description: `Invoice reversal - ${r.description}${ref}`,
        debit: Number(r.amount || 0),
        credit: 0,
      };
    });

    // manual_adjustment transactions — credit/debit determined by account 2100 side
    const manualAdjWhere = [
      "t.property_id = $1",
      "t.source_type = 'manual_adjustment'",
      "COALESCE(t.is_deleted, false) = false",
    ];
    const manualAdjValues = [propertyId];

    if (from) {
      manualAdjWhere.push(
        `t.transaction_date >= $${manualAdjValues.length + 1}::date`,
      );
      manualAdjValues.push(from);
    }
    if (to) {
      manualAdjWhere.push(
        `t.transaction_date <= $${manualAdjValues.length + 1}::date`,
      );
      manualAdjValues.push(to);
    }

    const manualAdjQuery = `
      SELECT t.id, t.transaction_date, t.description, t.amount,
             t.debit_account_id, t.credit_account_id, t.reference_number
      FROM transactions t
      WHERE ${manualAdjWhere.join(" AND ")}
      ORDER BY t.transaction_date ASC, t.id ASC
    `;

    const manualAdjs = await sql(manualAdjQuery, manualAdjValues);

    const manualAdjRows = (manualAdjs || []).map((t) => {
      const isCredit = acct2100Id && Number(t.credit_account_id) === acct2100Id;
      const ref = t.reference_number ? ` (${t.reference_number})` : "";
      const amount = Number(t.amount || 0);
      return {
        kind: isCredit ? "credit" : "debit",
        date: toDateStr(t.transaction_date),
        description: `Adjustment - ${t.description}${ref}`,
        debit: isCredit ? 0 : amount,
        credit: isCredit ? amount : 0,
      };
    });

    const all = [
      ...creditRows,
      ...arrearsRows,
      ...payoutRows,
      ...deductionRows,
      ...reversalRows,
      ...manualAdjRows,
    ];

    all.sort((a, b) => {
      const ad = String(a.date);
      const bd = String(b.date);
      if (ad < bd) return -1;
      if (ad > bd) return 1;
      // credits first on same date
      if (a.credit > 0 && b.credit === 0) return -1;
      if (a.credit === 0 && b.credit > 0) return 1;
      return 0;
    });

    let balance = openingBalance;
    const rows = all.map((r) => {
      balance = balance + Number(r.credit || 0) - Number(r.debit || 0);
      return {
        ...r,
        balance,
      };
    });

    const summary = rows.reduce(
      (acc, r) => {
        acc.credits += Number(r.credit || 0);
        acc.debits += Number(r.debit || 0);
        return acc;
      },
      { credits: 0, debits: 0 },
    );

    // Cumulative closing balance up to 'to' date (or all time).
    // closingTo (date string) is used for payout/deduction/reversal queries.
    // Rent invoices use toYM so early-dated invoices are attributed to the right period.
    const closingTo = to ? to : "9999-12-31";

    // Cumulative credits up to closingTo
    const closingGroups = await sql(
      `
        SELECT
          i.invoice_year,
          i.invoice_month,
          COALESCE(SUM(i.amount), 0)::numeric AS gross_rent
        FROM invoices i
        WHERE i.property_id = $1
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND i.lease_id IS NOT NULL
          ${toYM !== null ? `AND i.invoice_year * 100 + i.invoice_month <= $2` : ``}
        GROUP BY i.invoice_year, i.invoice_month
      `,
      toYM !== null ? [propertyId, toYM] : [propertyId],
    );

    const closingArrearsRows = await sql(
      `
        SELECT COALESCE(SUM(i.amount), 0)::numeric AS total
        FROM invoices i
        WHERE i.property_id = $1
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND i.lease_id IS NULL
          AND i.invoice_date <= $2::date
      `,
      [propertyId, closingTo],
    );

    const closingArrearsTotal = Number(closingArrearsRows?.[0]?.total || 0);

    const closingCreditsRent = (closingGroups || []).reduce((sum, g) => {
      const gross = Number(g.gross_rent || 0);
      const fee = computeFeeForGross({ feeType, percent, fixedAmount, gross });
      const net = gross - fee;
      return sum + net;
    }, 0);

    const closingCredits = closingCreditsRent + closingArrearsTotal;

    // Cumulative debits up to closingTo
    const closingDebitsPayoutRows = await sql`
      SELECT COALESCE(SUM(lp.amount), 0) AS total
      FROM landlord_payouts lp
      WHERE lp.landlord_id = ${landlordId}
        AND lp.property_id = ${propertyId}
        AND lp.payout_date <= ${closingTo}::date
        AND COALESCE(lp.is_deleted, false) = false
        AND NOT EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.source_type = 'landlord_payout'
            AND t.source_id = lp.id
            AND COALESCE(t.is_deleted, false) = true
        )
    `;

    const closingDebitsDedRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM landlord_deductions
      WHERE landlord_id = ${landlordId}
        AND property_id = ${propertyId}
        AND deduction_date <= ${closingTo}::date
        AND COALESCE(is_deleted,false) = false
    `;

    const closingDebitsReversalsRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions t
      WHERE t.property_id = ${propertyId}
        AND t.source_type IN ('rent_reversal', 'mgmt_fee_reversal')
        AND t.transaction_date <= ${closingTo}::date
        AND COALESCE(t.is_deleted, false) = false
    `;

    const closingDebits =
      Number(closingDebitsPayoutRows?.[0]?.total || 0) +
      Number(closingDebitsDedRows?.[0]?.total || 0) +
      Number(closingDebitsReversalsRows?.[0]?.total || 0);

    // Closing manual_adjustment net (cumulative, all time up to closingTo)
    let closingManualAdjNet = 0;
    if (acct2100Id) {
      const closingManualAdjRows = await sql`
        SELECT t.amount, t.debit_account_id, t.credit_account_id
        FROM transactions t
        WHERE t.property_id = ${propertyId}
          AND t.source_type = 'manual_adjustment'
          AND COALESCE(t.is_deleted, false) = false
          AND t.transaction_date <= ${closingTo}::date
      `;
      for (const t of closingManualAdjRows || []) {
        const amount = Number(t.amount || 0);
        if (Number(t.credit_account_id) === acct2100Id) closingManualAdjNet += amount;
        else if (Number(t.debit_account_id) === acct2100Id) closingManualAdjNet -= amount;
      }
    }

    const closingBalance = closingCredits + closingManualAdjNet - closingDebits;

    return Response.json({
      landlord,
      property,
      filters: { from: from || null, to: to || null },
      opening_balance: openingBalance,
      rows,
      summary: {
        credits: summary.credits,
        debits: summary.debits,
        closing_balance: closingBalance,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/landlord-property-statement error", error);

    const includeDetails =
      process.env.NODE_ENV !== "production" && process.env.ENV !== "production";
    const details = includeDetails
      ? String(error?.message || error)
      : undefined;

    return Response.json(
      {
        error: "Failed to build landlord property statement",
        ...(details ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
