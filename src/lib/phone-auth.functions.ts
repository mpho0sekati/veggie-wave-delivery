import { createServerFn } from "@tanstack/react-start";
import { cellIdentity, isValidPin, normaliseSaCell } from "@/lib/phone-auth";

type Input = { cell: string; pin: string; name?: string; role?: "buyer" | "trader" };

async function secretFor(msisdn: string, pin: string): Promise<string> {
  // The real sign-in secret is derived on the server, so the 4-digit PIN alone
  // can't be used against the sign-in service directly.
  const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${msisdn}:${pin}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function validate(input: Input): Input & { msisdn: string } {
  const msisdn = normaliseSaCell(String(input?.cell ?? ""));
  if (!msisdn) throw new Error("BAD_CELL");
  if (!isValidPin(String(input?.pin ?? ""))) throw new Error("BAD_PIN");
  if (input.role && input.role !== "buyer" && input.role !== "trader") throw new Error("BAD_ROLE");
  return { ...input, msisdn, name: input.name?.trim().slice(0, 60) };
}

async function signIn(msisdn: string, pin: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (i, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(i, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: cellIdentity(msisdn),
    password: await secretFor(msisdn, pin),
  });
  if (error || !data.session) return null;
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

/** Sign in with cell + PIN. Returns tokens, or { error } when they don't match. */
export const cellSignIn = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const session = await signIn(data.msisdn, data.pin);
    return session ? { session } : { error: "NO_MATCH" as const };
  });

/** Create a cell + PIN account (instant, no email) and sign in. */
export const cellSignUp = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    if (!data.name) return { error: "NO_NAME" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: cellIdentity(data.msisdn),
      password: await secretFor(data.msisdn, data.pin),
      email_confirm: true,
      user_metadata: { phone: data.msisdn, name: data.name },
    });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return { error: taken ? ("TAKEN" as const) : ("FAILED" as const) };
    }
    const session = await signIn(data.msisdn, data.pin);
    return session ? { session } : { error: "FAILED" as const };
  });
