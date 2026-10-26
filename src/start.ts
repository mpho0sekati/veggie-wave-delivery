import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

/**
 * A session whose token has run out can never be fixed by retrying, so it must
 * not travel the 5xx path — that path is what reloads the page. The token is
 * only decoded here, never verified: verification stays the auth layer's job.
 */
function tokenExpired(token: string, now = Date.now()) {
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = Number(JSON.parse(json).exp);
    return Number.isFinite(exp) && exp * 1000 <= now;
  } catch {
    return false;
  }
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (bearer && tokenExpired(bearer)) {
    // Plain text on purpose: a JSON body would be handed back to the caller as a
    // successful result instead of being raised as an error the app can react to.
    return new Response("Unauthorized", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8", "x-mdeko-auth": "expired" },
    });
  }
  try {
    const result = await next();
    // A token for a removed account passes the expiry check but is rejected by
    // auth; answer it as a rejected sign-in (401), never as a server crash.
    const response =
      (result as { response?: Response }).response ?? (result as unknown as Response);
    if (bearer && response instanceof Response && response.status >= 500) {
      const text = await response
        .clone()
        .text()
        .catch(() => "");
      if (/Unauthorized/i.test(text)) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "content-type": "text/plain; charset=utf-8", "x-mdeko-auth": "rejected" },
        });
      }
    }
    return result;
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  // Attaches the Supabase bearer token to every server function call so
  // protected handlers get context.userId / context.supabase.
  functionMiddleware: [attachSupabaseAuth],
}));
