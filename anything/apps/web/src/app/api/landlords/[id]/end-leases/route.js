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
import {
  countActiveLeasesForLandlord,
  countLivePropertiesForLandlord,
} from "@/app/api/utils/landlordLeases";
import {
  SETTLED_EPSILON,
  evaluateLandlordCloseGate,
  isSettled,
  landlordOwedMessage,
} from "@/app/api/utils/landlordCloseGate";

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

    const body = await request.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const terminationDate = parseDate(body?.termination_date) || today;
    const balanceSettlement = body?.balance_settlement || null;

    const payoutAmount = toNumber(balanceSettlement?.payout_amount) || 0;
    const payoutAccountId = toNumber(balanceSettlement?.payout_account_id);
    const payoutTxnDate =
      parseDate(balanceSettlement?.transaction_date) || terminationDate;

    // ── Close gate: every check runs before any write ─────────────────────
    // 1. no active lease, 2. no live property, 3. net due not negative —
    // the same rules the exit summary reports as close_blockers.
    const [activeLeasesCount, livePropertiesCount, propertyRows] =
      await Promise.all([
        countActiveLeasesForLandlord(landlordId),
        countLivePropertiesForLandlord(landlordId),
        sql`SELECT id FROM properties WHERE landlord_id = ${landlordId} ORDER BY id`,
      ]);

    // Net due from the source tables, per property (payouts are per property).
    const dues = [];
    for (const p of propertyRows || []) {
      const propertyId = Number(p.id);
      const due = Number(
        (await getDueToLandlordsBalance({ landlordId, propertyId })) || 0,
      );
      dues.push({ propertyId, due });
    }
    const netDue = dues.reduce((s, d) => s + d.due, 0);

    const gate = evaluateLandlordCloseGate({
      activeLeasesCount,
      livePropertiesCount,
      netDue,
    });
    if (!gate.can_close) {
      return Response.json(
        {
          error: gate.close_blockers[0],
          close_blockers: gate.close_blockers,
          close_blocker_codes: gate.close_blocker_codes,
          active_lease_count: activeLeasesCount,
          live_properties_count: livePropertiesCount,
          due_to_landlord: netDue,
        },
        { status: 409 },
      );
    }

    const owed = !isSettled(netDue); // gate passed, so owed means > 0

    // Still owing the landlord: only a full payout may close.
    if (owed && payoutAmount <= 0) {
      return Response.json(
        { error: landlordOwedMessage(netDue), due_to_landlord: netDue },
        { status: 409 },
      );
    }
    if (!owed && payoutAmount > 0) {
      return Response.json(
        {
          error:
            "Nothing is owed to this landlord, so there is no payout to record.",
        },
        { status: 409 },
      );
    }

    // Final payout: a real landlord payout per property (landlord_payouts row
    // + Dr 2100 / Cr cash or bank), so getDueToLandlordsBalance drops to zero.
    const payouts = [];
    if (owed) {
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

      if (dues.some((d) => d.due < -SETTLED_EPSILON)) {
        return Response.json(
          {
            error:
              "This landlord owes the agency on at least one property. Settle the per-property balances before closing with a payout.",
          },
          { status: 409 },
        );
      }
      // A payout that wouldn't bring the balance to zero can't close.
      if (Math.abs(payoutAmount - netDue) >= 1) {
        return Response.json(
          { error: landlordOwedMessage(netDue), due_to_landlord: netDue },
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

      // Never mark ended while still owing: re-read the balance the payouts
      // were meant to clear (guards a concurrent change to the dues).
      let remaining = 0;
      for (const { propertyId } of dues) {
        remaining += Number(
          (await getDueToLandlordsBalance({ landlordId, propertyId })) || 0,
        );
      }
      if (!isSettled(remaining)) {
        return Response.json(
          {
            error: `${landlordOwedMessage(remaining)} The landlord was not closed.`,
            due_to_landlord: remaining,
            payouts_recorded: payouts,
          },
          { status: 409 },
        );
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
