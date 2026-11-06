import { useStaffProfile } from "@/hooks/useStaffProfile";

// True only once the staff profile has loaded and grants payments_receive.
// While loading (or on error) this is false, so recording actions stay hidden
// instead of flashing in and then disappearing. View content is not gated here.
export function useCanRecordPayments() {
  const staffQuery = useStaffProfile(true);
  return (
    staffQuery.isSuccess &&
    staffQuery.data?.permissions?.payments_receive === true
  );
}
