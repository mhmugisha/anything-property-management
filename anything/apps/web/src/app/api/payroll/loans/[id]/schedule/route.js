import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const loanId = toNumber(params?.id);
    if (!loanId) {
      return Response.json({ error: "Invalid loan id" }, { status: 400 });
    }

    const rows = await sql(
      `SELECT l.id, l.amount, l.monthly_instalment, l.start_month, l.start_year,
              l.total_instalments, l.paid_instalments, l.recovered_amount,
              l.status, e.full_name AS employee_name
       FROM employee_loans l
       JOIN employees e ON e.id = l.employee_id
       WHERE l.id = $1 LIMIT 1`,
      [loanId],
    );

    const loan = rows?.[0] || null;
    if (!loan) {
      return Response.json({ error: "Loan not found" }, { status: 404 });
    }

    const totalInstalments = Number(loan.total_instalments);
    const paidInstalments = Number(loan.paid_instalments);
    const amount = Number(loan.amount);
    const instalment = Number(loan.monthly_instalment);
    let startMonth = Number(loan.start_month);
    let startYear = Number(loan.start_year);

    const schedule = [];
    let remaining = amount;

    for (let i = 0; i < totalInstalments; i++) {
      const isPaid = i < paidInstalments;
      const instalmentAmount = i === totalInstalments - 1
        ? Math.min(remaining, instalment) // last instalment may be smaller
        : instalment;

      const m = ((startMonth - 1 + i) % 12) + 1;
      const y = startYear + Math.floor((startMonth - 1 + i) / 12);

      schedule.push({
        instalment_number: i + 1,
        month: m,
        year: y,
        month_label: `${MONTH_NAMES[m]} ${y}`,
        amount: Math.min(instalmentAmount, remaining),
        status: isPaid ? "paid" : "pending",
      });

      remaining -= instalmentAmount;
      if (remaining < 0) remaining = 0;
    }

    return Response.json({
      loan: {
        id: Number(loan.id),
        employee_name: loan.employee_name,
        amount,
        monthly_instalment: instalment,
        total_instalments: totalInstalments,
        paid_instalments: paidInstalments,
        recovered_amount: Number(loan.recovered_amount),
        outstanding: amount - Number(loan.recovered_amount),
        status: loan.status,
      },
      schedule,
    });
  } catch (error) {
    console.error("GET /api/payroll/loans/[id]/schedule error", error);
    return Response.json({ error: "Failed to fetch loan schedule" }, { status: 500 });
  }
}
