import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { recordAdvancePayment } from "@/app/api/utils/payments/recordAdvancePayment";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function POST(request) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const tenantId = toNumber(body?.tenant_id);
    const propertyId = toNumber(body?.property_id);
    const holdingTransactionId = toNumber(body?.holding_transaction_id);

    const paymentDate = (body?.payment_date || "").trim();
    const amount = toNumber(body?.amount);
    const paymentMethod = (body?.payment_method || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;
    const notes = (body?.notes || "").trim() || null;
    const description = (body?.description || "").trim() || null;

    if (!paymentDate || !amount || !paymentMethod) {
      return Response.json(
        { error: "payment_date, amount, and payment_method are required" },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    if (!tenantId || !propertyId) {
      return Response.json(
        { error: "tenant_id and property_id are required" },
        { status: 400 },
      );
    }

    if (!holdingTransactionId) {
      return Response.json(
        { error: "holding_transaction_id is required" },
        { status: 400 },
      );
    }

    // Validate the originating Holding journal entry: exists, not soft-deleted,
    // approved (or approval not required), and not already allocated.
    const holdingRows = await sql`
      SELECT id, allocated_by_transaction_id, is_deleted, approval_status
      FROM transactions
      WHERE id = ${holdingTransactionId}
      LIMIT 1
    `;

    const holdingTx = holdingRows?.[0] || null;

    if (!holdingTx) {
      return Response.json(
        { error: "Holding transaction not found" },
        { status: 404 },
      );
    }

    if (holdingTx.is_deleted === true) {
      return Response.json(
        { error: "Holding transaction has been deleted" },
        { status: 400 },
      );
    }

    if (holdingTx.approval_status && holdingTx.approval_status !== "approved") {
      return Response.json(
        { error: "Holding transaction is not approved" },
        { status: 400 },
      );
    }

    if (
      holdingTx.allocated_by_transaction_id !== null &&
      holdingTx.allocated_by_transaction_id !== undefined
    ) {
      return Response.json(
        { error: "Holding transaction has already been allocated" },
        { status: 409 },
      );
    }

    // Run the shared advance-payment pipeline.
    // GL: Dr Holding (2500) / Cr Tenant Prepayments (2150).
    const result = await recordAdvancePayment({
      staff: perm.staff,
      ipAddress: perm.ipAddress,
      tenantId,
      propertyId,
      paymentDate,
      amount,
      paymentMethod,
      referenceNumber,
      notes,
      description: description || "Allocated from Holding",
      debitIntent: "holding",
      creditIntent: "tenant_prepayments",
      sourceType: "payment_allocation",
      businessEvent: "HOLDING_ALLOCATED_TO_TENANT",
      labels: {
        flow: "Payment Allocation",
        pending: "Payment Allocation",
      },
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    // Fetch the GL transaction the helper just posted, keyed idempotently on
    // (source_type='payment_allocation', source_id=payment.id).
    const clearingTxRows = await sql`
      SELECT id
      FROM transactions
      WHERE source_type = 'payment_allocation'
        AND source_id = ${result.payment.id}
      LIMIT 1
    `;

    const clearingTxId = clearingTxRows?.[0]?.id
      ? Number(clearingTxRows[0].id)
      : null;

    // Atomically stamp the pointer. If another request raced us to it, log a
    // warning — the payment itself is still valid; only the pointer is stale.
    let pointerStamped = false;
    if (clearingTxId) {
      const markedRows = await sql`
        UPDATE transactions
        SET allocated_by_transaction_id = ${clearingTxId}
        WHERE id = ${holdingTransactionId}
          AND allocated_by_transaction_id IS NULL
        RETURNING id
      `;

      pointerStamped = (markedRows?.length || 0) > 0;

      if (!pointerStamped) {
        console.warn(
          `allocate: holding tx ${holdingTransactionId} was already allocated by another concurrent request; payment ${result.payment.id} succeeded but pointer not stamped`,
        );
      }
    } else {
      console.error(
        `allocate: could not locate payment_allocation GL entry for payment ${result.payment.id}; pointer not stamped`,
      );
    }

    return Response.json({
      payment: result.payment,
      holding_transaction_id: holdingTransactionId,
      cleared_by_transaction_id: clearingTxId,
      pointer_stamped: pointerStamped,
      autoApplied: result.autoApplyResult?.ok
        ? {
            count: result.autoApplyResult.appliedCount || 0,
            amount: result.autoApplyResult.appliedAmount || 0,
          }
        : null,
    });
  } catch (error) {
    console.error("POST /api/payments/allocate error", error);
    return Response.json(
      { error: error.message || "Failed to allocate payment" },
      { status: 500 },
    );
  }
}
