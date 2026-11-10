import { useStaffProfile } from "@/hooks/useStaffProfile";

// True only once the staff profile has loaded and grants payroll_manage
// (Accountant + Admin): view salaries/runs/payslips, prepare runs, pay out
// approved runs, record and recover advances. While loading (or on error)
// this is false, so those actions stay hidden instead of flashing in.
export function useCanManagePayroll() {
  const staffQuery = useStaffProfile(true);
  return (
    staffQuery.isSuccess &&
    staffQuery.data?.permissions?.payroll_manage === true
  );
}
