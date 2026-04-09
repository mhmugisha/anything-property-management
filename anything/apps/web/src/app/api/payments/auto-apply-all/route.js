import { requirePermission } from "@/app/api/utils/staff";
import { autoApplyAdvancePaymentsToOpenInvoices } from "@/app/api/utils/payments/autoApply";

/**
 * POST: Apply all unapplied payments to open invoices for all tenants
 */
export async function POST(request) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    console.log("Starting auto-apply for ALL tenants...");

    const result = await autoApplyAdvancePaymentsToOpenInvoices({
      limit: 500, // Process up to 500 tenants
    });

    if (!result.ok) {
      return Response.json(
        { error: result.error || "Failed to auto-apply payments" },
        { status: 500 },
      );
    }

    console.log(
      `Auto-apply completed: ${result.tenantsProcessed} tenants, ${result.appliedCount} allocations, ${result.appliedAmount} total amount`,
    );

    return Response.json({
      success: true,
      tenantsProcessed: result.tenantsProcessed || 0,
      allocationsCreated: result.appliedCount || 0,
      totalAmountApplied: result.appliedAmount || 0,
      message: `Successfully processed ${result.tenantsProcessed} tenant(s), created ${result.appliedCount} allocation(s) totaling UGX ${(result.appliedAmount || 0).toLocaleString()}`,
    });
  } catch (error) {
    console.error("POST /api/payments/auto-apply-all error", error);
    console.error("Error stack:", error.stack);
    return Response.json(
      { error: error.message || "Failed to auto-apply payments" },
      { status: 500 },
    );
  }
}
