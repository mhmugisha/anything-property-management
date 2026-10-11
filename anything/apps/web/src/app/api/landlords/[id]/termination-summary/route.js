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

    // One read-only exit preview; the legacy fields below are derived from it
    // so the Close Landlord modal and the exit flow can't drift apart.
    const exit = await getLandlordExitSummary(landlordId);

    const activeLeaseTenants = exit.properties.flatMap((p) =>
      p.active_leases.map((l) => ({
        lease_id: l.lease_id,
        tenant_id: l.tenant_id,
        tenant_name: l.tenant_name,
        property_name: p.property_name,
        unit_number: l.unit_number,
      })),
    );

    if (activeLeaseTenants.length > 0) {
      return Response.json({
        landlord: {
          landlord_id: Number(landlord.id),
          full_name: landlord.full_name,
          phone: landlord.phone,
          status: landlord.status,
        },
        blocked: true,
        active_lease_count: activeLeaseTenants.length,
        active_tenants: activeLeaseTenants,
        message: `This landlord still has ${activeLeaseTenants.length} active tenant lease(s). Please terminate all tenant leases before closing this landlord.`,
        exit,
      });
    }

    // Due to this landlord: getDueToLandlordsBalance (source tables) for each
    // of their properties, summed. The 2100 ledger is out of sync and not used.
    const dueByProperty = exit.properties.map((p) => ({
      property_id: p.property_id,
      property_name: p.property_name,
      due: p.net_due,
    }));
    const dueToLandlordsBalance = exit.net_due;

    // Asset accounts for payout dropdown (Cash on Hand, Bank)
    const assetAccounts = await sql`
      SELECT id, account_code, account_name
      FROM chart_of_accounts
      WHERE account_type = 'Asset'
        AND account_code IN ('1110', '1120')
        AND COALESCE(is_active, true) = true
      ORDER BY account_code ASC
    `;

    return Response.json({
      landlord: {
        landlord_id: Number(landlord.id),
        full_name: landlord.full_name,
        phone: landlord.phone,
        status: landlord.status,
      },
      blocked: false,
      active_lease_count: 0,
      active_tenants: [],
      due_to_landlords_balance: dueToLandlordsBalance,
      due_by_property: dueByProperty,
      asset_accounts: (assetAccounts || []).map((a) => ({
        id: Number(a.id),
        account_code: a.account_code,
        account_name: a.account_name,
      })),
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
