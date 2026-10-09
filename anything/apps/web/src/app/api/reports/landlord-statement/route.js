import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getDueToLandlordsBalance } from "@/app/api/utils/accounting";
import { buildLandlordEvents, toDateStr } from "@/app/api/utils/landlordEvents";

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const landlordId = toNumber(searchParams.get("landlordId"));
    const propertyId = toNumber(searchParams.get("propertyId"));
    const from = toDateStr((searchParams.get("from") || "").trim() || null);
    const to = toDateStr((searchParams.get("to") || "").trim() || null);

    if (!landlordId) {
      return Response.json(
        { error: "landlordId is required" },
        { status: 400 },
      );
    }

    // Landlord, every dated event (shared with the balance reports) and the
    // all-time due for one property — the payout overpay cap, not windowed.
    const [landlordRows, { properties, events }, dueToLandlord] =
      await Promise.all([
        sql`SELECT id, full_name, phone, email FROM landlords WHERE id = ${landlordId} LIMIT 1`,
        buildLandlordEvents(landlordId, { propertyId }),
        propertyId
          ? getDueToLandlordsBalance({ landlordId, propertyId })
          : Promise.resolve(null),
      ]);

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    if (propertyId && !properties.some((p) => Number(p.id) === propertyId)) {
      return Response.json(
        { error: "Property not linked to this landlord" },
        { status: 400 },
      );
    }

    // Opening balance = net of every event strictly before `from`.
    // Period rows = events within [from, to].
    let openingBalance = 0;
    let balance = 0;
    let totalCredited = 0;
    let totalDebited = 0;
    const rows = [];

    if (from) {
      for (const e of events) {
        if (e.date < from) openingBalance += e.credit - e.debit;
      }
      balance = openingBalance;
      rows.push({
        id: "opening",
        date: from,
        description: "Opening Balance",
        source_type: "opening_balance",
        kind: "opening",
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: openingBalance,
      });
    }

    for (const e of events) {
      if (from && e.date < from) continue;
      if (to && e.date > to) continue;
      balance += e.credit - e.debit;
      totalCredited += e.credit;
      totalDebited += e.debit;
      rows.push({
        id: e.id,
        date: e.date,
        description: e.description,
        source_type: e.source_type,
        kind: e.credit > 0 ? "credit" : "debit",
        debit: e.debit,
        credit: e.credit,
        balance,
      });
    }

    return Response.json({
      landlord: {
        id: Number(landlord.id),
        full_name: landlord.full_name,
        phone: landlord.phone || null,
        email: landlord.email || null,
      },
      filters: { from: from || null, to: to || null },
      opening_balance: openingBalance,
      rows,
      summary: {
        credits: totalCredited,
        debits: totalDebited,
        closing_balance: balance,
      },
      due_to_landlord: dueToLandlord,
    });
  } catch (error) {
    console.error("GET /api/reports/landlord-statement error", error);
    return Response.json(
      { error: "Failed to build landlord statement" },
      { status: 500 },
    );
  }
}
