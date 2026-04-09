import { AccountForm } from "./AccountForm";
import { AccountsTable } from "./AccountsTable";

export function AccountsTab({
  accountCode,
  accountName,
  accountType,
  onCodeChange,
  onNameChange,
  onTypeChange,
  onCreateAccount,
  createAccountMutation,
  accountsQuery,
  accounts,
  seedAccountsMutation,
}) {
  const accountsArray = Array.isArray(accounts) ? accounts : [];
  const showSeed =
    !accountsQuery.isLoading &&
    !accountsQuery.error &&
    accountsArray.length === 0;

  const seedErrorMessage = seedAccountsMutation?.error
    ? "Could not initialize the chart of accounts."
    : null;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {showSeed ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">
            No accounts found
          </div>
          <div className="mt-1 text-sm text-amber-900/80">
            Your accounting reports and postings need a Chart of Accounts. Click
            below to initialize a standard set of accounts for property
            management.
          </div>

          {seedErrorMessage ? (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {seedErrorMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => seedAccountsMutation.mutate({})}
            disabled={seedAccountsMutation.isPending}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {seedAccountsMutation.isPending
              ? "Initializing..."
              : "Initialize chart of accounts"}
          </button>
        </div>
      ) : null}

      <AccountForm
        accountCode={accountCode}
        accountName={accountName}
        accountType={accountType}
        onCodeChange={onCodeChange}
        onNameChange={onNameChange}
        onTypeChange={onTypeChange}
        onSubmit={onCreateAccount}
        isPending={createAccountMutation.isPending}
        error={createAccountMutation.error}
      />

      <AccountsTable
        accounts={accountsArray}
        isLoading={accountsQuery.isLoading}
        error={accountsQuery.error}
      />
    </div>
  );
}
