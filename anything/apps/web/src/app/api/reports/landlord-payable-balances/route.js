import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getDueToLandlordsBalance } from "@/app/api/utils/accounting";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const monthParam = toNumber(searchParams.get("month"));
    const yearParam = toNumber(searchParams.get("year"));
    const landlordIdParam = toNumber(searchParams.get("landlordId"));
    const propertyIdParam = toNumber(searchParams.get("propertyId"));

    const now = new Date();
    const month = monthParam || now.getMonth() + 1;
    const year = yearParam || now.getFullYear();

    // Build WHERE conditions for filtering
    const where = ["l.status = 'active'"];
    const values = [];

    if (landlordIdParam) {
      where.push(`l.id = $${values.length + 1}`);
      values.push(landlordIdParam);
    }

    if (propertyIdParam) {
      where.push(`p.id = $${values.length + 1}`);
      values.push(propertyIdParam);
    }

    // Get all properties for active landlords
    const query = `
      SELECT
        l.id AS landlord_id,
        l.full_name AS landlord_name,
        l.due_date,
        p.id AS property_id,
        p.property_name
      FROM landlords l
      LEFT JOIN properties p ON p.landlord_id = l.id
      WHERE ${where.join(" AND ")}
      ORDER BY l.full_name
    `;

    const rows = await sql(query, values);

    // Group by landlord and calculate balances
    const landlordMap = new Map();

    for (const row of rows) {
      const landlordId = row.landlord_id;
      const propertyId = row.property_id;

      if (!landlordId || !propertyId) continue;

      // Calculate balance for this landlord-property combination
      const balance = await getDueToLandlordsBalance({
        landlordId,
        propertyId,
      });

      if (balance <= 0) continue; // Skip if no balance due

      if (!landlordMap.has(landlordId)) {
        landlordMap.set(landlordId, {
          landlord_id: landlordId,
          landlord_name: row.landlord_name,
          due_date: row.due_date,
          amount_due: 0,
        });
      }

      const landlordEntry = landlordMap.get(landlordId);
      landlordEntry.amount_due += Number(balance);
    }

    // Convert to array and format due dates
    let landlords = Array.from(landlordMap.values());

    // Format due dates for the selected month/year
    landlords = landlords.map((l) => {
      let dueDate = null;

      if (l.due_date) {
        // due_date is stored as 2000-01-DD format (anchor date)
        const dueDateObj = new Date(l.due_date);
        const dueDay = dueDateObj.getDate();

        // Create due date for selected month/year
        dueDate = new Date(year, month - 1, dueDay);

        // If the day doesn't exist in this month (e.g., Feb 30), adjust
        if (dueDate.getMonth() !== month - 1) {
          // Set to last day of the month
          dueDate = new Date(year, month, 0);
        }
      }

      return {
        ...l,
        formatted_due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
        due_date_sort: dueDate ? dueDate.getTime() : Number.MAX_SAFE_INTEGER,
      };
    });

    // Sort by due date, then by landlord name
    landlords.sort((a, b) => {
      if (a.due_date_sort !== b.due_date_sort) {
        return a.due_date_sort - b.due_date_sort;
      }
      return String(a.landlord_name || "").localeCompare(
        String(b.landlord_name || ""),
      );
    });

    // Calculate total
    const totalAmountDue = landlords.reduce(
      (sum, l) => sum + Number(l.amount_due || 0),
      0,
    );

    return Response.json({
      month,
      year,
      landlords,
      total_amount_due: totalAmountDue,
    });
  } catch (error) {
    console.error("GET /api/reports/landlord-payable-balances error", error);
    return Response.json(
      { error: "Failed to generate landlord payable balances report" },
      { status: 500 },
    );
  }
}
