import QuickLinkTile from "@/components/QuickLinkTile";

export function FinancialStatementsLink() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-slate-800">
        Financial statements
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        Profit & Loss, Balance Sheet, and Trial Balance are available in the
        Accounting module.
      </p>
      <div className="mt-4 inline-block">
        <QuickLinkTile href="/accounting">Go to Accounting</QuickLinkTile>
      </div>
    </div>
  );
}
