import { JournalTable } from "./JournalTable";

export function JournalTab({
  // Journal table props
  journalQuery,
  transactions,
  accountOptions,
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Journal Log</h2>
      </div>

      <JournalTable
        transactions={transactions}
        isLoading={journalQuery.isLoading}
        error={journalQuery.error}
        accountOptions={accountOptions}
      />
    </div>
  );
}
