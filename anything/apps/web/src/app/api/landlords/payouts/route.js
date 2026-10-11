import { requirePermission } from "@/app/api/utils/staff";
import { recordLandlordPayout } from "@/app/api/utils/landlordPayouts";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const landlordId = toNumber(body?.landlord_id);
    const propertyId = toNumber(body?.property_id);
    const payoutDate = (body?.payout_date || "").trim();
    const amount = toNumber(body?.amount);
    const method = (body?.payment_method || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;
    const notes = (body?.notes || "").trim() || null;

    const result = await recordLandlordPayout({
      landlordId,
      propertyId,
      payoutDate,
      amount,
      method,
      referenceNumber,
      notes,
      staff: perm.staff,
      ipAddress: perm.ipAddress,
    });
    if (!result.ok) {
      return Response.json(result.body, { status: result.status });
    }

    return Response.json({ payout: result.payout });
  } catch (error) {
    console.error("POST /api/landlords/payouts error", error);
    return Response.json(
      { error: error?.message || "Failed to record landlord payout" },
      { status: 500 },
    );
  }
}
