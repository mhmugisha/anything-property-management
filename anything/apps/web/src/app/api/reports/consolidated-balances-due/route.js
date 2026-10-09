import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { buildLandlordEvents } from "@/app/api/utils/landlordEvents";

// Column totals for a set of landlord events (shared with the statement and
// getDueToLandlordsBalance), so an all-time balance_due equals the helper.
//   balance_due = rent − fees − deductions − maintenance − payouts + adjustments
function summarize(events) {
  const t = {
    rent_total: 0,
    management_fees: 0,
    other_deductions: 0,
    maintenance: 0,
    adjustments: 0,
    payouts: 0,
  };
  for (const e of events) {
    switch (e.source_type) {
      case "rent_billed":
        t.rent_total += e.credit - e.debit;
        break;
      case "management_fee":
        t.management_fees += e.debit - e.credit;
        break;
      case "landlord_deduction":
        t.other_deductions += e.debit - e.credit;
        break;
      case "maintenance_charge":
        t.maintenance += e.debit - e.credit;
        break;
      case "landlord_payout":
        t.payouts += e.debit - e.credit;
        break;
      default:
        // balance_adjustment (signed) and anything unrecognised
        t.adjustments += e.credit - e.debit;
        break;
    }
  }
  return withTotals(t);
}

function withTotals(t) {
  const total_deductions =
    t.management_fees + t.other_deductions + t.maintenance;
  return {
    ...t,
    total_deductions,
    balance_due: t.rent_total - total_deductions - t.payouts + t.adjustments,
  };
}

function sumRows(rows) {
  const t = {
    rent_total: 0,
    management_fees: 0,
    other_deductions: 0,
    maintenance: 0,
    adjustments: 0,
    payouts: 0,
  };
  for (const r of rows) {
    for (const k of Object.keys(t)) t[k] += Number(r[k] || 0);
  }
  return withTotals(t);
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const landlordIdParam = searchParams.get("landlordId");
    const landlordId = landlordIdParam ? Number(landlordIdParam) : null;
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const fromDate = from || "1900-01-01";
    const toDate = to || "9999-12-31";
    const inWindow = (e) => e.date >= fromDate && e.date <= toDate;

    // MODE 1: Show all landlords (when no landlordId is provided)
    if (!landlordId) {
      const landlordsRows = await sql`
        SELECT id, full_name
        FROM landlords
        ORDER BY full_name
      `;

      const landlords = await Promise.all(
        (landlordsRows || []).map(async (landlord) => {
          const { events } = await buildLandlordEvents(Number(landlord.id));
          return {
            landlord_id: landlord.id,
            landlord_name: landlord.full_name,
            ...summarize(events.filter(inWindow)),
          };
        }),
      );

      return Response.json({
        mode: "all_landlords",
        filters: { from: from || null, to: to || null },
        landlords,
        totals: sumRows(landlords),
      });
    }

    // MODE 2: Show properties for a specific landlord
    const [landlordRows, { properties: propertyRows, events }] =
      await Promise.all([
        sql`
          SELECT id, full_name, phone, email
          FROM landlords
          WHERE id = ${landlordId}
          LIMIT 1
        `,
        buildLandlordEvents(landlordId),
      ]);

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    const windowed = events.filter(inWindow);
    const byProperty = new Map();
    for (const e of windowed) {
      const pid = e.property_id === null ? null : Number(e.property_id);
      if (!byProperty.has(pid)) byProperty.set(pid, []);
      byProperty.get(pid).push(e);
    }

    const sortedProps = [...propertyRows].sort((a, b) =>
      String(a.property_name || "").localeCompare(
        String(b.property_name || ""),
      ),
    );
    const owned = new Set(sortedProps.map((p) => Number(p.id)));

    const properties = sortedProps.map((p) => ({
      property_id: p.id,
      property_name: p.property_name,
      ...summarize(byProperty.get(Number(p.id)) || []),
    }));

    // Landlord-level entries (no property, or a property they no longer own)
    // still count toward the landlord's balance, as on the statement.
    const unassigned = [];
    for (const [pid, list] of byProperty) {
      if (pid === null || !owned.has(pid)) unassigned.push(...list);
    }
    if (unassigned.length) {
      properties.push({
        property_id: null,
        property_name: "Unassigned / landlord-level",
        ...summarize(unassigned),
      });
    }

    return Response.json({
      mode: "single_landlord",
      landlord,
      filters: { from: from || null, to: to || null },
      properties,
      totals: sumRows(properties),
    });
  } catch (error) {
    console.error("GET /api/reports/consolidated-balances-due error", error);
    return Response.json(
      { error: "Failed to build consolidated balances due report" },
      { status: 500 },
    );
  }
}
