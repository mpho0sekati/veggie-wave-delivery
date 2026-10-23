import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type Role = "buyer" | "trader";

export type Session = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  name: string;
  role: Role | null;
};

const EMPTY: Session = { loading: true, userId: null, email: null, name: "", role: null };

/**
 * Signed-in user plus the role stored on their profile row.
 * The role always comes from the database, never from the sign-up form,
 * so a client cannot promote itself to a trader.
 */
export function useSession(): Session {
  const [session, setSession] = useState<Session>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!user) {
        if (!cancelled) setSession({ ...EMPTY, loading: false });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      const { data: savedRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      setSession({
        loading: false,
        userId: user.id,
        email: user.email ?? null,
        name: profile?.name ?? "",
        role: (savedRole?.role as Role | undefined) ?? null,
      });
    };

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setTimeout(() => void load(), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
}
