import { useStaffProfile } from "@/hooks/useStaffProfile";

// True only once the staff profile has loaded and the role is Admin — the
// same role_name check the pages and the server's requireAdmin use. While
// loading (or on error) this is false, so admin-only actions stay hidden
// instead of flashing in. The server enforces the rule either way.
export function useIsAdmin() {
  const staffQuery = useStaffProfile(true);
  return staffQuery.isSuccess && staffQuery.data?.role_name === "Admin";
}
