import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const landlordRows = await sql`
      SELECT id, full_name, COALESCE(status, 'active') AS status
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;
    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    // Guard: block if any active tenant leases remain
    const activeLeaseRows = await sql(
      `SELECT l.id
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE p.landlord_id = $1 AND l.status = 'active'
       LIMIT 1`,
      [landlordId],
    );
    if (activeLeaseRows?.length > 0) {
      return Response.json(
        {
          error:
            "This landlord still has active tenant leases. Please terminate all tenant leases before closing this landlord.",
        },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const terminationDate = parseDate(body?.termination_date) || today;
    const balanceSettlement = body?.balance_settlement || null;

    const dueToLandlordsAcctId = await getAccountIdByCode("2100");

    const payoutAmount = toNumber(balanceSettlement?.payout_amount) || 0;
    const payoutAccountId = toNumber(balanceSettlement?.payout_account_id);
    const payoutTxnDate =
      parseDate(balanceSettlement?.transaction_date) || terminationDate;

    const txOps = (txn) => {
      const ops = [
        // Mark landlord as ended
        txn(
          `UPDATE landlords
           SET status = 'ended',
               end_date = CASE WHEN end_date IS NULL OR end_date > $1::date THEN $1::date ELSE end_date END
           WHERE id = $2`,
          [terminationDate, landlordId],
        ),
      ];

      // GL: settle remaining Due to Landlords balance
      // DR 2100 (Due to Landlords) / CR payout_account_id (Cash/Bank)
      if (dueToLandlordsAcctId && payoutAmount > 0 && payoutAccountId) {
        ops.push(
          txn(
            `INSERT INTO transactions (
               transaction_date, description, reference_number,
               debit_account_id, credit_account_id,
               amount, currency, created_by,
               source_type, source_id, landlord_id, approval_status
             ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7,
                       'landlord_balance_payout', $8, $9, 'approved')`,
            [
              payoutTxnDate,
              `Final balance payout - ${landlord.full_name}`,
              `LDL-CLOSE-${landlordId}`,
              dueToLandlordsAcctId,
              payoutAccountId,
              payoutAmount,
              perm.staff.id,
              landlordId,
              landlordId,
            ],
          ),
        );
      }

      return ops;
    };

    await sql.transaction(txOps);

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.close",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: { status: landlord.status },
      newValues: {
        status: "ended",
        termination_date: terminationDate,
        payout_amount: payoutAmount,
      },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      success: true,
      landlord_id: landlordId,
      termination_date: terminationDate,
      balance_paid_out: payoutAmount > 0 && !!payoutAccountId,
      payout_amount: payoutAmount,
    });
  } catch (error) {
    console.error("POST /api/landlords/[id]/end-leases error", error);
    return Response.json(
      { error: "Failed to close landlord" },
      { status: 500 },
    );
  }
}
