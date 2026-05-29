import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureCanCreditAccount, getAccountIdByCode } from "@/app/api/utils/accounting";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const landlordId = toNumber(body?.landlord_id);
    const propertyId = toNumber(body?.property_id);
    const payoutDate = (body?.payout_date || "").trim();
    const amount = toNumber(body?.amount);
    const method = (body?.payment_method || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;
    const notes = (body?.notes || "").trim() || null;

    if (!landlordId || !propertyId || !payoutDate || !amount || !method) {
      return Response.json(
        {
          error:
            "landlord_id, property_id, payout_date, amount, payment_method are required",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // Get landlord name for the transaction description
    const landlordRows = await sql`
      SELECT full_name FROM landlords WHERE id = ${landlordId} LIMIT 1
    `;
    const landlordName = landlordRows?.[0]?.full_name || "Unknown Landlord";

    // FIX: Detect cash vs bank based on method containing "cash" (case-insensitive)
    // This handles both "Cash" and "Cash on Hand"
    const isCash = method.toLowerCase().includes("cash");
    const creditIntent = isCash ? "cash_account" : "bank_account";

    const creditRes = await resolveAccountIntent(creditIntent);
    if (!creditRes.ok) {
      return Response.json(
        { error: `Could not resolve ${creditIntent} account` },
        { status: 500 },
      );
    }

    const creditAccountId = Number(creditRes.accountId);

    // Prevent paying out money that isn't available in the credited Asset account.
    // This checks account 1110 (Cash on Hand) if isCash=true, or 1120 (Bank) otherwise.
    const guard = await ensureCanCreditAccount({
      creditAccountId,
      amount,
    });
    if (!guard.ok) {
      return Response.json(guard.body, { status: guard.status });
    }

    // Prevent overpaying landlords — read from ledger account 2100 (id = 7)
    // to stay consistent with the dashboard's single source of truth.
    const balanceRows = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN credit_account_id = 7 THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN debit_account_id = 7 THEN amount ELSE 0 END), 0)
        AS balance
      FROM transactions
      WHERE COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND (debit_account_id = 7 OR credit_account_id = 7)
    `;
    const due = Number(balanceRows?.[0]?.balance || 0);
    if (amount > due) {
      return Response.json(
        {
          error: `Overpayment blocked. Due to landlords balance is ${due} UGX.`,
        },
        { status: 400 },
      );
    }

    const dupeRows = await sql`
      SELECT id FROM landlord_payouts
      WHERE landlord_id = ${landlordId}
        AND property_id = ${propertyId}
        AND amount = ${amount}
        AND payout_date = ${payoutDate}::date
        AND payment_method = ${method}
        AND COALESCE(is_deleted, false) = false
        AND created_at >= NOW() - INTERVAL '60 seconds'
      LIMIT 1
    `;

    if (dupeRows?.length > 0) {
      return Response.json(
        {
          error:
            "Duplicate payout detected. A payout with identical details was recorded within the last 60 seconds. If this is intentional, wait a moment and try again.",
        },
        { status: 409 },
      );
    }

    const rows = await sql`
      INSERT INTO landlord_payouts (
        landlord_id, property_id, payout_date,
        amount, payment_method, reference_number, notes,
        created_by,
        is_deleted
      )
      VALUES (
        ${landlordId}, ${propertyId}, ${payoutDate}::date,
        ${amount}, ${method}, ${referenceNumber}, ${notes},
        ${perm.staff.id},
        false
      )
      RETURNING *
    `;

    const payout = rows?.[0] || null;

    const desc = `Landlord payout - ${landlordName}`;

    const post = await postAccountingEntryFromIntents({
      transactionDate: payoutDate,
      description: desc,
      referenceNumber: referenceNumber,
      debitIntent: "landlord_liability",
      creditIntent,
      amount,
      currency: "UGX",
      createdBy: perm.staff.id,
      landlordId,
      propertyId,
      sourceType: "landlord_payout",
      sourceId: payout.id,
      auditContext: {
        sourceModule: "property",
        businessEvent: "LANDLORD_PAID",
        sourceEntity: { type: "landlord_payout", id: payout.id },
      },
    });

    if (!post.ok) {
      // postAccountingEntryFromIntents cannot run inside sql.transaction(), so
      // compensate by deleting the orphaned payout row (same pattern as payments/route.js).
      try {
        await sql`DELETE FROM landlord_payouts WHERE id = ${payout.id}`;
      } catch (rollbackErr) {
        console.error(
          "CRITICAL: GL post failed AND compensating delete failed. Manual cleanup required.",
          {
            payoutId: payout.id,
            glError: post.error,
            rollbackError: rollbackErr.message,
          },
        );
      }
      return Response.json(
        {
          error: `Accounting posting failed; payout was rolled back: ${post.error || "unknown error"}`,
        },
        { status: 500 },
      );
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.payout.create",
      entityType: "landlord_payout",
      entityId: payout?.id || null,
      oldValues: null,
      newValues: payout,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about landlord payout
    // Get landlord and property details for notification
    if (payout?.id) {
      const detailsRows = await sql`
        SELECT 
          l.full_name AS landlord_name,
          p.property_name
        FROM landlord_payouts lp
        JOIN landlords l ON l.id = lp.landlord_id
        JOIN properties p ON p.id = lp.property_id
        WHERE lp.id = ${payout.id}
        LIMIT 1
      `;

      const details = detailsRows?.[0];
      if (details) {
        notifyAllAdminsAsync({
          title: "Landlord Payout Recorded",
          message: `Payout of UGX ${Number(amount).toLocaleString()} recorded for ${details.landlord_name} (${details.property_name}) via ${method}. Recorded by ${perm.staff.full_name || "Staff"}`,
          type: "payout",
          reference_id: payout.id,
          reference_type: "landlord_payout",
        });
      }
    }

    // Snapshot save — non-blocking, does not affect payout success
    try {
      const [snYear, snMonth] = payoutDate.split("-").map(Number);
      const snYearMonth = snYear * 100 + snMonth;
      const snMM = String(snMonth).padStart(2, "0");
      const snFirstDay = `${snYear}-${snMM}-01`;
      const snLastDay = `${snYear}-${snMM}-${String(new Date(snYear, snMonth, 0).getDate()).padStart(2, "0")}`;

      const [acct2100Id, propRows] = await Promise.all([
        getAccountIdByCode("2100"),
        sql`SELECT management_fee_type, management_fee_percent, management_fee_fixed_amount FROM properties WHERE id = ${propertyId} LIMIT 1`,
      ]);

      const prop = propRows?.[0] || {};
      const feeType = String(prop.management_fee_type || "percent").toLowerCase();
      const feePercent = Number(prop.management_fee_percent || 0);
      const feeFixed = Number(prop.management_fee_fixed_amount || 0);

      const [invoiceRows, arrearsRows, dedRows, maintRows] = await Promise.all([
        sql`SELECT amount FROM invoices WHERE property_id = ${propertyId} AND invoice_year * 100 + invoice_month = ${snYearMonth} AND status <> 'void' AND COALESCE(is_deleted, false) = false AND lease_id IS NOT NULL`,
        sql`SELECT pia.amount_applied FROM payment_invoice_allocations pia JOIN payments p ON p.id = pia.payment_id JOIN invoices i ON i.id = pia.invoice_id WHERE i.property_id = ${propertyId} AND i.lease_id IS NULL AND COALESCE(i.is_deleted, false) = false AND p.is_reversed = false AND p.payment_date >= ${snFirstDay}::date AND p.payment_date <= ${snLastDay}::date`,
        sql`SELECT id, deduction_date, description, amount FROM landlord_deductions WHERE landlord_id = ${landlordId} AND property_id = ${propertyId} AND COALESCE(is_deleted, false) = false AND deduction_date >= ${snFirstDay}::date AND deduction_date <= ${snLastDay}::date AND LOWER(description) NOT LIKE 'fees on recovered arrears%'`,
        acct2100Id
          ? sql`SELECT id, transaction_date, description, amount FROM transactions WHERE property_id = ${propertyId} AND landlord_id = ${landlordId} AND source_type = 'maintenance' AND debit_account_id = ${acct2100Id} AND COALESCE(is_deleted, false) = false AND transaction_date >= ${snFirstDay}::date AND transaction_date <= ${snLastDay}::date`
          : Promise.resolve([]),
      ]);

      const currentRent = invoiceRows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const recoveredArrears = arrearsRows.reduce((s, r) => s + Number(r.amount_applied || 0), 0);
      const grossRent = currentRent + recoveredArrears;

      let mgmtFee = 0;
      if (feeType === "percent") {
        mgmtFee = Math.round((grossRent * feePercent / 100) * 100) / 100;
      } else if (feeType === "fixed" && grossRent > 0) {
        mgmtFee = Math.min(feeFixed, grossRent);
      }

      const deductionsSum = dedRows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const deductionsJson = dedRows.map((r) => ({ id: r.id, date: r.deduction_date, description: r.description, amount: Number(r.amount || 0) }));

      const maintenanceSum = maintRows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const maintenanceJson = maintRows.map((r) => ({ id: r.id, date: r.transaction_date, description: r.description, amount: Number(r.amount || 0) }));

      const netPayable = grossRent - mgmtFee - deductionsSum - maintenanceSum;
      const txnId = post.transaction?.id || null;

      await sql(
        `INSERT INTO landlord_payment_notes (
          landlord_id, property_id, month, year,
          payout_date, gross_rent, management_fee,
          deductions, maintenance, net_payable,
          amount_paid, payment_account_id, payout_transaction_id, created_by
        ) VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14)
        ON CONFLICT (landlord_id, property_id, month, year) DO UPDATE SET
          payout_date = EXCLUDED.payout_date,
          gross_rent = EXCLUDED.gross_rent,
          management_fee = EXCLUDED.management_fee,
          deductions = EXCLUDED.deductions,
          maintenance = EXCLUDED.maintenance,
          net_payable = EXCLUDED.net_payable,
          amount_paid = EXCLUDED.amount_paid,
          payment_account_id = EXCLUDED.payment_account_id,
          payout_transaction_id = EXCLUDED.payout_transaction_id`,
        [
          landlordId, propertyId, snMonth, snYear,
          payoutDate, grossRent, mgmtFee,
          JSON.stringify(deductionsJson), JSON.stringify(maintenanceJson), netPayable,
          amount, creditAccountId, txnId, perm.staff.id,
        ],
      );
    } catch (snapshotErr) {
      console.error("Payment note snapshot failed (non-blocking):", snapshotErr.message);
    }

    return Response.json({ payout });
  } catch (error) {
    console.error("POST /api/landlords/payouts error", error);
    return Response.json(
      { error: error?.message || "Failed to record landlord payout" },
      { status: 500 },
    );
  }
}
