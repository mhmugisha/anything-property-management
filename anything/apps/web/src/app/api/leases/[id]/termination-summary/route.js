import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const leaseId = toNumber(id);
    if (!leaseId) {
      return Response.json({ error: "Invalid lease id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const terminationDate = parseDate(searchParams.get("termination_date")) || today;
    const [termYear, termMonth] = terminationDate.split("-").map(Number);
    const termYM = termYear * 100 + termMonth;

    // Lease + tenant + unit + property
    const leaseRows = await sql`
      SELECT
        l.id AS lease_id,
        l.tenant_id,
        l.unit_id,
        l.start_date,
        l.end_date,
        l.status,
        l.monthly_rent,
        l.deposit_amount,
        l.currency,
        t.full_name AS tenant_name,
        u.unit_number,
        p.id AS property_id,
        p.property_name
      FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE l.id = ${leaseId}
      LIMIT 1
    `;

    const lease = leaseRows?.[0] || null;
    if (!lease) {
      return Response.json({ error: "Lease not found" }, { status: 404 });
    }

    const tenantId = Number(lease.tenant_id);

    // Fetch account IDs
    const [prepaymentAcctId, depositPayableAcctId] = await Promise.all([
      getAccountIdByCode("2150"),
      getAccountIdByCode("2200"),
    ]);

    // Invoices that would be auto-voided (after termination month, unpaid)
    const autoVoidRows = await sql(
      `SELECT id, invoice_date, invoice_month, invoice_year, amount, paid_amount,
              (amount - paid_amount) AS outstanding, description, status
       FROM invoices
       WHERE lease_id = $1
         AND invoice_year * 100 + invoice_month > $2
         AND paid_amount = 0
         AND status NOT IN ('void', 'paid')
         AND COALESCE(is_deleted, false) = false
       ORDER BY invoice_year ASC, invoice_month ASC`,
      [leaseId, termYM],
    );

    // Pre-termination unpaid invoices (on or before termination month, outstanding > 0)
    const preTermRows = await sql(
      `SELECT id, invoice_date, invoice_month, invoice_year, amount, paid_amount,
              (amount - paid_amount) AS outstanding, description, status
       FROM invoices
       WHERE lease_id = $1
         AND invoice_year * 100 + invoice_month <= $2
         AND (amount - paid_amount) > 0
         AND status NOT IN ('void', 'paid')
         AND COALESCE(is_deleted, false) = false
       ORDER BY invoice_year ASC, invoice_month ASC`,
      [leaseId, termYM],
    );

    // Security deposit balance (account 2200 for this tenant/lease)
    let depositBalance = 0;
    if (depositPayableAcctId) {
      const depRows = await sql(
        `SELECT
           COALESCE(SUM(CASE WHEN t.credit_account_id = $1 THEN t.amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN t.debit_account_id = $1 THEN t.amount ELSE 0 END), 0)
           AS balance
         FROM transactions t
         LEFT JOIN payments pm
           ON pm.id = t.source_id AND t.source_type = 'security_deposit'
         WHERE (t.debit_account_id = $1 OR t.credit_account_id = $1)
           AND COALESCE(t.is_deleted, false) = false
           AND (
             (t.source_type = 'security_deposit' AND pm.tenant_id = $2)
             OR (t.source_type IN ('security_deposit_adjustment', 'security_deposit_refund', 'security_deposit_forfeiture')
                 AND t.source_id = $3)
           )`,
        [depositPayableAcctId, tenantId, leaseId],
      );
      depositBalance = Number(depRows?.[0]?.balance || 0);
    }

    // Prepayment balance (account 2150 for this tenant)
    let prepaymentBalance = 0;
    if (prepaymentAcctId) {
      const prepRows = await sql(
        `SELECT
           COALESCE(SUM(CASE WHEN t.credit_account_id = $1 THEN t.amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN t.debit_account_id = $1 THEN t.amount ELSE 0 END), 0)
           AS balance
         FROM transactions t
         LEFT JOIN payments pm
           ON pm.id = t.source_id
           AND t.source_type IN ('payment', 'payment_advance')
         LEFT JOIN leases l_src
           ON l_src.id = t.source_id
           AND t.source_type IN ('prepayment_refund', 'prepayment_writeoff')
         WHERE (t.debit_account_id = $1 OR t.credit_account_id = $1)
           AND COALESCE(t.is_deleted, false) = false
           AND (pm.tenant_id = $2 OR l_src.tenant_id = $2)`,
        [prepaymentAcctId, tenantId],
      );
      prepaymentBalance = Number(prepRows?.[0]?.balance || 0);
    }

    // Income accounts (for deduction dropdown)
    const incomeAccounts = await sql`
      SELECT id, account_code, account_name
      FROM chart_of_accounts
      WHERE account_type = 'Income'
        AND COALESCE(is_active, true) = true
      ORDER BY account_code ASC
    `;

    // Asset accounts for refund (cash and bank)
    const assetAccounts = await sql`
      SELECT id, account_code, account_name
      FROM chart_of_accounts
      WHERE account_type = 'Asset'
        AND account_code IN ('1110', '1120')
        AND COALESCE(is_active, true) = true
      ORDER BY account_code ASC
    `;

    const autoVoidInvoices = (autoVoidRows || []).map((r) => ({
      id: Number(r.id),
      invoice_date: r.invoice_date,
      invoice_month: Number(r.invoice_month),
      invoice_year: Number(r.invoice_year),
      amount: Number(r.amount || 0),
      paid_amount: Number(r.paid_amount || 0),
      outstanding: Number(r.outstanding || 0),
      description: r.description,
      status: r.status,
    }));

    const preTermInvoices = (preTermRows || []).map((r) => ({
      id: Number(r.id),
      invoice_date: r.invoice_date,
      invoice_month: Number(r.invoice_month),
      invoice_year: Number(r.invoice_year),
      amount: Number(r.amount || 0),
      paid_amount: Number(r.paid_amount || 0),
      outstanding: Number(r.outstanding || 0),
      description: r.description,
      status: r.status,
    }));

    return Response.json({
      lease: {
        lease_id: Number(lease.lease_id),
        tenant_id: tenantId,
        tenant_name: lease.tenant_name,
        property_name: lease.property_name,
        unit_number: lease.unit_number,
        start_date: lease.start_date,
        end_date: lease.end_date,
        status: lease.status,
        monthly_rent: Number(lease.monthly_rent || 0),
        currency: lease.currency || "UGX",
      },
      termination_date: terminationDate,
      auto_void_invoices: autoVoidInvoices,
      auto_void_count: autoVoidInvoices.length,
      auto_void_total: autoVoidInvoices.reduce((s, r) => s + r.outstanding, 0),
      pre_term_invoices: preTermInvoices,
      pre_term_count: preTermInvoices.length,
      pre_term_outstanding: preTermInvoices.reduce(
        (s, r) => s + r.outstanding,
        0,
      ),
      deposit: {
        balance: depositBalance,
        has_deposit: depositBalance > 0,
      },
      prepayment: {
        balance: prepaymentBalance,
        has_prepayment: prepaymentBalance > 0,
      },
      income_accounts: (incomeAccounts || []).map((a) => ({
        id: Number(a.id),
        account_code: a.account_code,
        account_name: a.account_name,
      })),
      asset_accounts: (assetAccounts || []).map((a) => ({
        id: Number(a.id),
        account_code: a.account_code,
        account_name: a.account_name,
      })),
    });
  } catch (error) {
    console.error("GET /api/leases/[id]/termination-summary error", error);
    return Response.json(
      { error: "Failed to fetch termination summary" },
      { status: 500 },
    );
  }
}
