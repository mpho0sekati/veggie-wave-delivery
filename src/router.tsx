import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "./integrations/supabase/client";
import { routeTree } from "./routeTree.gen";

/**
 * A session the server no longer accepts must not keep polling. Auth answers a
 * dead token with 401 "Unauthorized", so the first such failure signs the
 * browser out once — the screens then fall back to the readable signed-out
 * state instead of hammering a call that can never succeed.
 */
const AUTH_REJECTION = /^Unauthorized/i;
let signingOut = false;

export function handleQueryError(error: unknown) {
  if (signingOut || !(error instanceof Error) || !AUTH_REJECTION.test(error.message)) return;
  signingOut = true;
  void supabase.auth.signOut().finally(() => {
    signingOut = false;
  });
  toast.info("Your session expired. Please sign in again.");
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleQueryError }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
