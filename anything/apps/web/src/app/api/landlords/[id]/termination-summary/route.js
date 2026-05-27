import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

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

    // Active tenant lease guard
    const activeLeaseRows = await sql(
      `SELECT
         l.id AS lease_id,
         l.tenant_id,
         t.full_name AS tenant_name,
         p.property_name,
         u.unit_number
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE p.landlord_id = $1
         AND l.status = 'active'
       ORDER BY p.property_name, u.unit_number`,
      [landlordId],
    );

    const activeLeaseTenants = (activeLeaseRows || []).map((r) => ({
      lease_id: Number(r.lease_id),
      tenant_id: Number(r.tenant_id),
      tenant_name: r.tenant_name,
      property_name: r.property_name,
      unit_number: r.unit_number,
    }));

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
      });
    }

    // Balance of account 2100 (Due to Landlords) for this landlord
    let dueToLandlordsBalance = 0;
    const liabilityAcctId = await getAccountIdByCode("2100");

    if (liabilityAcctId) {
      const balRows = await sql(
        `SELECT
           COALESCE(SUM(CASE WHEN credit_account_id = $1 THEN amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN debit_account_id = $1 THEN amount ELSE 0 END), 0)
           AS balance
         FROM transactions
         WHERE (debit_account_id = $1 OR credit_account_id = $1)
           AND landlord_id = $2
           AND COALESCE(is_deleted, false) = false
           AND COALESCE(approval_status, 'approved') = 'approved'`,
        [liabilityAcctId, landlordId],
      );
      dueToLandlordsBalance = Number(balRows?.[0]?.balance || 0);
    }

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
      asset_accounts: (assetAccounts || []).map((a) => ({
        id: Number(a.id),
        account_code: a.account_code,
        account_name: a.account_name,
      })),
    });
  } catch (error) {
    console.error("GET /api/landlords/[id]/termination-summary error", error);
    return Response.json(
      { error: "Failed to fetch termination summary" },
      { status: 500 },
    );
  }
}
