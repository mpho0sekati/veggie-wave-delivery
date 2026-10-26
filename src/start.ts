import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

/**
 * A rejected session must not look like a server crash. `requireSupabaseAuth` is
 * generated code, so its rejections are matched by message here; returning 401
 * keeps an expired login out of the 5xx path that reloads the page.
 */
const AUTH_REJECTION = /^Unauthorized[:\s]/i;

function isAuthRejection(error: unknown) {
  return error instanceof Error && AUTH_REJECTION.test(error.message);
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    if (isAuthRejection(error)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", "x-mdeko-auth": "rejected" },
      });
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
