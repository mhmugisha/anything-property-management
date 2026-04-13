import * as React from "react";
import { useSession } from "@hono/auth-js/react";

const useUser = () => {
  const { data: session, status } = useSession();

  const user = session?.user || null;

  return {
    user,
    data: user,
    loading: status === "loading",
    refetch: () => {},
  };
};

export { useUser };
export default useUser;
