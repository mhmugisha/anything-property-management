import { Edit } from "lucide-react";

export function AccountsTable({ accounts, isLoading, error }) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading accounts…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">Could not load accounts.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2 pr-3">Code</th>
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Active</th>
            <th className="py-2 pr-3">Edit</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const codeHref = `/accounting/accounts/${a.id}`;
            const editHref = `/accounting/accounts/${a.id}/edit`;

            return (
              <tr key={a.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3 font-medium">
                  <a
                    href={codeHref}
                    className="text-slate-800 hover:text-violet-600"
                    title="View account statement"
                  >
                    {a.account_code}
                  </a>
                </td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span>{a.account_name}</span>
                    {a.is_cash_bank === true ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Bank
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-3">{a.account_type}</td>
                <td className="py-2 pr-3">{a.is_active ? "yes" : "no"}</td>
                <td className="py-2 pr-3">
                  <a
                    href={editHref}
                    className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700"
                    title="Edit account"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
