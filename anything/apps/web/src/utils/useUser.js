import * as React from "react";
import { useSession } from "@hono/auth-js/react";

const useUser = () => {
  const { data: session, status } = useSession();
  const id = session?.user?.id;
  const [user, setUser] = React.useState(session?.user ?? null);
  const fetchUser = React.useCallback(async (session) => { return session?.user; }, []);
  const refetchUser = React.useCallback(() => {
    if (id) { fetchUser(session).then(setUser); } else { setUser(null); }
  }, [fetchUser, id]);
  React.useEffect(refetchUser, [refetchUser]);
  return { user, data: session?.user || null, loading: status === "loading", refetch: refetchUser };
};

export { useUser };
export default useUser;
