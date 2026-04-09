import { InvoicePaymentForm } from "./InvoicePaymentForm";
import { UpfrontPaymentForm } from "./UpfrontPaymentForm";

export function PaymentFormCard({
  invoiceForm,
  upfrontForm,
  invProperties,
  invTenants,
  dueInvoices,
  upfProperties,
  upfTenants,
  invPropertiesLoading,
  invTenantsLoading,
  dueInvoicesLoading,
  upfPropertiesLoading,
  upfTenantsLoading,
  onSubmitInvoice,
  onSubmitUpfront,
  onCancel,
  isSaving,
  error,
  onClearError,
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <InvoicePaymentForm
          form={invoiceForm}
          properties={invProperties}
          tenants={invTenants}
          dueInvoices={dueInvoices}
          propertiesLoading={invPropertiesLoading}
          tenantsLoading={invTenantsLoading}
          invoicesLoading={dueInvoicesLoading}
          onSubmit={onSubmitInvoice}
          onCancel={onCancel}
          isSaving={isSaving}
          error={error}
          onClearError={onClearError}
        />

        <UpfrontPaymentForm
          form={upfrontForm}
          properties={upfProperties}
          tenants={upfTenants}
          propertiesLoading={upfPropertiesLoading}
          tenantsLoading={upfTenantsLoading}
          onSubmit={onSubmitUpfront}
          onCancel={onCancel}
          isSaving={isSaving}
          error={error}
          onClearError={onClearError}
        />
      </div>
    </div>
  );
}
