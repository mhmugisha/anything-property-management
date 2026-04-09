import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const landlordId = searchParams.get("landlordId");
    const propertyId = searchParams.get("propertyId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    let query = `
      SELECT 
        t.id as tenant_id,
        t.full_name as tenant_name,
        t.phone,
        u.unit_number,
        l.monthly_rent,
        p.property_name,
        p.id as property_id,
        ll.id as landlord_id,
        ll.full_name as landlord_name
      FROM tenants t
      LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active'
      LEFT JOIN units u ON u.id = l.unit_id
      LEFT JOIN properties p ON p.id = u.property_id
      LEFT JOIN landlords ll ON ll.id = p.landlord_id
      WHERE t.status = 'active'
    `;

    const params = [];
    let paramIndex = 1;

    if (landlordId) {
      query += ` AND ll.id = $${paramIndex}`;
      params.push(Number(landlordId));
      paramIndex++;
    }

    if (propertyId) {
      query += ` AND p.id = $${paramIndex}`;
      params.push(Number(propertyId));
      paramIndex++;
    }

    if (fromDate) {
      query += ` AND l.start_date >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      query += ` AND l.start_date <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }

    query += ` ORDER BY ll.full_name, p.property_name, u.unit_number`;

    const rows = await sql(query, params);

    return Response.json({ tenants: rows });
  } catch (error) {
    console.error("Error fetching all tenants report:", error);
    return Response.json(
      { error: "Failed to fetch all tenants report" },
      { status: 500 },
    );
  }
}
