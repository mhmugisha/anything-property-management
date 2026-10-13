import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import {
  getAccountIdByCode,
  getDueToLandlordsByProperty,
} from "@/app/api/utils/accounting";

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

const BASIS = "credit − debit, not deleted, approved only";

// Read-only: GL account 2100 (Due to Landlords) vs the trusted source figure
// (getDueToLandlordsByProperty), per landlord, all-time.
//
// GL side is on the trial-balance basis. A 2100 row belongs to
// COALESCE(t.landlord_id, property's landlord); rows with neither go to the
// unattributable bucket, so Σ landlords + unattributable = the whole 2100
// ledger (totals.gl_2100 sums every group, unrounded). Source side sums the per-property dues by landlord, so its total
// equals getTotalDueToLandlords.
export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  if (perm.staff?.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const acct2100 = await getAccountIdByCode("2100");
    if (!acct2100) {
      return Response.json(
        { error: "Account 2100 not configured" },
        { status: 500 },
      );
    }

    // One aggregate over every live 2100 row, by landlord key and source
    // type. The ::int form nets a row with 2100 on both sides to zero.
    // Approved rows feed the GL figures; the rest are reported as pending.
    const [dueByProperty, glRows] = await Promise.all([
      getDueToLandlordsByProperty(),
      sql`
        WITH r AS (
          SELECT
            COALESCE(t.landlord_id, p.landlord_id) AS landlord_key,
            COALESCE(t.source_type, '(none)') AS source_type,
            t.property_id,
            t.landlord_id AS txn_landlord_id,
            p.landlord_id AS property_landlord_id,
            COALESCE(t.approval_status, 'approved') = 'approved' AS approved,
            (t.credit_account_id = ${acct2100})::int * t.amount
              - (t.debit_account_id = ${acct2100})::int * t.amount AS net
          FROM transactions t
          LEFT JOIN properties p ON p.id = t.property_id
          WHERE (t.debit_account_id = ${acct2100} OR t.credit_account_id = ${acct2100})
            AND COALESCE(t.is_deleted, false) = false
        )
        SELECT
          landlord_key,
          source_type,
          COALESCE(SUM(net) FILTER (WHERE approved), 0)::numeric AS gl_2100,
          COALESCE(SUM(net) FILTER (WHERE approved AND property_id IS NULL), 0)::numeric AS no_property_gl,
          COALESCE(SUM(net) FILTER (WHERE NOT approved), 0)::numeric AS pending_gl,
          COUNT(*) FILTER (WHERE approved)::int AS approved_count,
          COUNT(*) FILTER (
            WHERE approved
              AND txn_landlord_id IS NOT NULL
              AND property_landlord_id IS NOT NULL
              AND txn_landlord_id <> property_landlord_id
          )::int AS mismatch_count
        FROM r
        GROUP BY landlord_key, source_type
      `,
    ]);

    const blank = () => ({
      gl_2100: 0,
      source_due: 0,
      no_property_gl: 0,
      pending_gl: 0,
      mismatch_count: 0,
    });
    const byLandlord = new Map();
    const entry = (id) => {
      if (!byLandlord.has(id)) byLandlord.set(id, blank());
      return byLandlord.get(id);
    };

    // Source side.
    let sourceTotal = 0;
    for (const r of dueByProperty || []) {
      entry(Number(r.landlordId)).source_due += r.due;
      sourceTotal += r.due;
    }

    // GL side.
    const unattributable = { gl_2100: 0, count: 0, by_source_type: [] };
    let glTotal = 0;
    for (const r of glRows || []) {
      const gl = Number(r.gl_2100 || 0);
      glTotal += gl;
      if (r.landlord_key === null || r.landlord_key === undefined) {
        unattributable.gl_2100 += gl;
        unattributable.count += Number(r.approved_count || 0);
        if (Number(r.approved_count || 0) > 0) {
          unattributable.by_source_type.push({
            source_type: r.source_type,
            amount: round2(gl),
            count: Number(r.approved_count || 0),
          });
        }
        continue;
      }
      const e = entry(Number(r.landlord_key));
      e.gl_2100 += gl;
      e.no_property_gl += Number(r.no_property_gl || 0);
      e.pending_gl += Number(r.pending_gl || 0);
      e.mismatch_count += Number(r.mismatch_count || 0);
    }
    unattributable.gl_2100 = round2(unattributable.gl_2100);
    unattributable.by_source_type.sort(
      (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
    );

    const ids = [...byLandlord.keys()];
    const nameRows = ids.length
      ? await sql`
          SELECT id, full_name, COALESCE(status, 'active') AS status
          FROM landlords
          WHERE id = ANY(${ids})
        `
      : [];
    const names = new Map((nameRows || []).map((l) => [Number(l.id), l]));

    const landlords = ids
      .map((id) => {
        const e = byLandlord.get(id);
        const l = names.get(id);
        return {
          landlord_id: id,
          name: l?.full_name ?? null,
          status: l?.status ?? null,
          gl_2100: round2(e.gl_2100),
          source_due: round2(e.source_due),
          gap: round2(e.gl_2100 - e.source_due),
          no_property_gl: round2(e.no_property_gl),
          pending_gl: round2(e.pending_gl),
          mismatch_count: e.mismatch_count,
        };
      })
      .sort(
        (a, b) =>
          Math.abs(b.gap) - Math.abs(a.gap) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      );

    return Response.json({
      landlords,
      unattributable,
      totals: {
        gl_2100: round2(glTotal),
        source_due: round2(sourceTotal),
        gap: round2(glTotal - sourceTotal),
      },
      basis: BASIS,
    });
  } catch (error) {
    console.error("GET /api/reports/landlord-gl-reconciliation error", error);
    return Response.json(
      { error: "Failed to build GL 2100 reconciliation" },
      { status: 500 },
    );
  }
}
