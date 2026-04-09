import { useDeleteInvoice } from "@/hooks/useDeleteInvoice";

export default function InvoiceDeleteButton({
  invoiceId,
  onDeleted,
  disabled,
}) {
  const { deleteInvoice, isDeleting, error } = useDeleteInvoice();

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
        <span className="text-xs text-red-600" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
