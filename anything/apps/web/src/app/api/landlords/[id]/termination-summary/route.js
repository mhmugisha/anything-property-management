import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getLandlordExitSummary } from "@/app/api/utils/landlordExitSummary";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const landlordRows = await sql`
      SELECT id, title, full_name, phone, COALESCE(status, 'active') AS status
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    // One read-only exit preview, read by the Landlord Exit wizard.
    const exit = await getLandlordExitSummary(landlordId);

    // Cash on Hand / Bank for the payout and collect dropdowns. Always sent:
    // a property can owe Exela (collect) while leases are still active.
    const assetAccountRows = await sql`
      SELECT id, account_code, account_name
      FROM chart_of_accounts
      WHERE account_type = 'Asset'
        AND account_code IN ('1110', '1120')
        AND COALESCE(is_active, true) = true
      ORDER BY account_code ASC
    `;
    const assetAccounts = (assetAccountRows || []).map((a) => ({
      id: Number(a.id),
      account_code: a.account_code,
      account_name: a.account_name,
    }));

    return Response.json({
      landlord: {
        landlord_id: Number(landlord.id),
        full_name: landlord.full_name,
        phone: landlord.phone,
        status: landlord.status,
      },
      asset_accounts: assetAccounts,
      exit,
    });
  } catch (error) {
    console.error("GET /api/landlords/[id]/termination-summary error", error);
    return Response.json(
      { error: "Failed to fetch termination summary" },
      { status: 500 },
    );
  }
}
