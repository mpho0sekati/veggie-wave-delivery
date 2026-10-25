import { describe, expect, it } from "vitest";
import { transformSync } from "rolldown/utils";
import { publicEnvDefines } from "./public-env";

describe("startup public configuration", () => {
  it("provides the connected backend when build variables are missing", () => {
    const defines = publicEnvDefines({});
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_URL"])).toBe(
      "https://soddhyyfvbqfmffrbyum.supabase.co",
    );
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"])).toBe(
      "sb_publishable_F96wO8O4vhq_ZrVBFtaPzQ_fGwZ2kKt",
    );
  });

  it("preserves injected backend settings and excludes private variables", () => {
    expect(publicEnvDefines({
      VITE_SUPABASE_URL: "https://draft.example.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_draft",
      SUPABASE_SERVICE_ROLE_KEY: "must-not-be-bundled",
    })).toEqual({
      "import.meta.env.VITE_SUPABASE_URL": '"https://draft.example.test"',
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '"sb_publishable_draft"',
    });
  });

  it("resolves generated bracket-access variables in the production compiler", () => {
    const defines = publicEnvDefines({});
    const env = Object.fromEntries(Object.entries(defines).map(([key, value]) => [
      key.replace("import.meta.env.", ""), JSON.parse(value),
    ]));
    const result = transformSync("startup.js", `globalThis.config = [
      import.meta.env["VITE_SUPABASE_URL"],
      import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
    ];`, { define: { ...defines, "import.meta.env": JSON.stringify(env) } });
    const target: { config?: string[] } = {};
    new Function("globalThis", result.code)(target);
    expect(target.config).toEqual([env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY]);
  });
});