// Only public, browser-safe configuration belongs here. Injected values always
// win, including the isolated backend configuration used by draft previews.
const DEFAULT_PUBLIC_ENV = {
  VITE_SUPABASE_URL: "https://soddhyyfvbqfmffrbyum.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_F96wO8O4vhq_ZrVBFtaPzQ_fGwZ2kKt",
};

export function publicEnvDefines(env: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(DEFAULT_PUBLIC_ENV).map(([key, fallback]) => [
      `import.meta.env.${key}`,
      JSON.stringify(env[key]?.trim() || fallback),
    ]),
  );
}