import { useDeleteInvoice } from "@/hooks/useDeleteInvoice";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";

function formatShortDate(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return s;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AppliedPaymentsList({ payments }) {
  if (!Array.isArray(payments) || payments.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 list-disc list-inside">
      {payments.map((p) => {
        const parts = [
          formatShortDate(p.payment_date),
          formatCurrencyUGX(p.amount_applied),
        ];
        if (p.payment_method) parts.push(p.payment_method);
        if (p.reference_number) parts.push(`ref ${p.reference_number}`);
        return (
          <li key={p.allocation_id || p.payment_id}>{parts.join(" · ")}</li>
        );
      })}
    </ul>
  );
}

export default function InvoiceDeleteButton({
  invoiceId,
  onDeleted,
  disabled,
}) {
  const { deleteInvoice, isDeleting, error, appliedPayments } =
    useDeleteInvoice();

  const handleDelete = async () => {
    const result = await deleteInvoice(invoiceId);

    if (result.ok) {
      if (onDeleted) {
        onDeleted(invoiceId);
      }
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={disabled || isDeleting}
        className={`px-3 py-1 text-sm rounded ${
          disabled || isDeleting
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
        title="Delete this invoice"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <div className="text-xs text-red-600 max-w-xs">
          <div>{error}</div>
          {appliedPayments.length > 0 ? (
            <div className="mt-1">
              <div className="font-medium">Applied payments:</div>
              <AppliedPaymentsList payments={appliedPayments} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
