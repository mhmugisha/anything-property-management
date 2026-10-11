import sql from "@/app/api/utils/sql";
import {
  hasPermission,
  requirePermission,
  writeAuditLog,
} from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getDueToLandlordsBalance,
} from "@/app/api/utils/accounting";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
import { recordLandlordPayout } from "@/app/api/utils/landlordPayouts";

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

    const payoutAmount = toNumber(balanceSettlement?.payout_amount) || 0;
    const payoutAccountId = toNumber(balanceSettlement?.payout_account_id);
    const payoutTxnDate =
      parseDate(balanceSettlement?.transaction_date) || terminationDate;

    // Final payout: a real landlord payout per property (landlord_payouts row
    // + Dr 2100 / Cr cash or bank), so getDueToLandlordsBalance drops to zero.
    // Only for a positive balance owed to the landlord, paid in full.
    const payouts = [];
    if (payoutAmount > 0) {
      // Same permission as recording a payout directly.
      if (!hasPermission(perm.permissions, "accounting")) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      // The payout helper picks cash or bank from the method, so map the
      // chosen account onto the method that resolves to that same account.
      const [cashRes, bankRes] = await Promise.all([
        resolveAccountIntent("cash_account"),
        resolveAccountIntent("bank_account"),
      ]);
      let method = null;
      if (cashRes.ok && Number(cashRes.accountId) === payoutAccountId) {
        method = "Cash on Hand";
      } else if (bankRes.ok && Number(bankRes.accountId) === payoutAccountId) {
        method = "Bank Account - Operating";
      }
      if (!method) {
        return Response.json(
          { error: "Choose Cash on Hand or the operating bank account" },
          { status: 400 },
        );
      }

      const propertyRows = await sql`
        SELECT id FROM properties
        WHERE landlord_id = ${landlordId}
        ORDER BY id
      `;
      const dues = [];
      for (const p of propertyRows || []) {
        const propertyId = Number(p.id);
        const due = Number(
          (await getDueToLandlordsBalance({ landlordId, propertyId })) || 0,
        );
        dues.push({ propertyId, due });
      }
      const netDue = dues.reduce((s, d) => s + d.due, 0);

      if (netDue <= 0) {
        return Response.json(
          {
            error:
              "Nothing is owed to this landlord, so there is no payout to record.",
          },
          { status: 409 },
        );
      }
      if (dues.some((d) => d.due < -0.005)) {
        return Response.json(
          {
            error:
              "This landlord owes the agency on at least one property. Settle the per-property balances before closing with a payout.",
          },
          { status: 409 },
        );
      }
      if (Math.abs(payoutAmount - netDue) >= 1) {
        return Response.json(
          {
            error: `Closing pays out the full balance. Due to this landlord is now ${netDue} UGX.`,
            due_to_landlord: netDue,
          },
          { status: 409 },
        );
      }

      // Check funds for the whole payout up front, so it can't stop halfway
      // for lack of cash.
      const guard = await ensureCanCreditAccount({
        creditAccountId: payoutAccountId,
        amount: netDue,
      });
      if (!guard.ok) return Response.json(guard.body, { status: guard.status });

      for (const { propertyId, due } of dues) {
        // Whole cents, never above the due (the helper blocks overpayment).
        const amount = Math.floor(due * 100) / 100;
        if (amount <= 0) continue;
        const result = await recordLandlordPayout({
          landlordId,
          propertyId,
          payoutDate: payoutTxnDate,
          amount,
          method,
          referenceNumber: `LDL-CLOSE-${landlordId}`,
          notes: "Final balance payout on landlord close",
          staff: perm.staff,
          ipAddress: perm.ipAddress,
        });
        if (!result.ok) {
          // Payouts already recorded stand (each is complete on its own); the
          // landlord stays open, and a retry pays only what is still due.
          return Response.json(
            {
              ...result.body,
              error: `Payout for property ${propertyId} failed: ${result.body?.error || "unknown error"}. The landlord was not closed.`,
              payouts_recorded: payouts,
            },
            { status: result.status },
          );
        }
        payouts.push({
          property_id: propertyId,
          payout_id: Number(result.payout.id),
          amount,
        });
      }
    }
    const paidOut = payouts.reduce((s, p) => s + p.amount, 0);

    await sql`
      UPDATE landlords
      SET status = 'ended',
          end_date = CASE WHEN end_date IS NULL OR end_date > ${terminationDate}::date
                          THEN ${terminationDate}::date ELSE end_date END
      WHERE id = ${landlordId}
    `;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.close",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: { status: landlord.status },
      newValues: {
        status: "ended",
        termination_date: terminationDate,
        payout_amount: paidOut,
        payouts,
      },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      success: true,
      landlord_id: landlordId,
      termination_date: terminationDate,
      balance_paid_out: payouts.length > 0,
      payout_amount: paidOut,
      payouts,
    });
  } catch (error) {
    console.error("POST /api/landlords/[id]/end-leases error", error);
    return Response.json(
      { error: "Failed to close landlord" },
      { status: 500 },
    );
  }
}
