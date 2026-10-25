import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { publicEnvDefines } from "./config/public-env";

const netlifyPreset = process.env["NITRO_PRESET"] === "netlify" ? "netlify" : undefined;
const netlifyNitro = netlifyPreset ? { nitro: { preset: netlifyPreset } } : {};

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  ...netlifyNitro,
  vite: {
    optimizeDeps: {
      exclude: ["react-dom", "react"],
    },
    plugins: [
      {
        name: "mdeko-public-startup-config",
        config(_config, { mode }) {
          return { define: publicEnvDefines(loadEnv(mode, process.cwd(), "VITE_")) };
        },
      },
      VitePWA({
        injectRegister: null,
        devOptions: { enabled: false },
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        manifest: false, // The root head links the single public/manifest.json.
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
          globIgnores: ["**/node_modules/**/*"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
              handler: "CacheFirst",
              options: {
                cacheName: "osm-tiles",
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: {
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
              },
            },
          ],
        },
      }),
    ],
  },
});
