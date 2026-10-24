import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

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
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        manifest: {
          name: "Mdeko · Veggie Wave",
          short_name: "Veggie Wave",
          description:
            "Raise your hand and nearby veggie traders bring fresh fruit and veg you need",
          theme_color: "#10b981",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait-primary",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%2310b981' width='192' height='192'/><text x='50%' y='50%' font-size='120' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>🌱</text></svg>",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%2310b981' width='192' height='192'/><text x='50%' y='50%' font-size='120' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>🌱</text></svg>",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "maskable",
            },
            {
              src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect fill='%2310b981' width='512' height='512'/><text x='50%' y='50%' font-size='300' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>🌱</text></svg>",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
          categories: ["shopping", "food"],
          screenshots: [
            {
              src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 540 720'><rect fill='%23f0fdf4' width='540' height='720'/><text x='270' y='360' font-size='100' text-anchor='middle' dominant-baseline='central'>Veggie Wave</text></svg>",
              sizes: "540x720",
              type: "image/svg+xml",
              form_factor: "narrow",
            },
          ],
          shortcuts: [
            {
              name: "Buyer Mode",
              short_name: "Buy",
              description: "Browse nearby traders and raise your hand for veggies",
              url: "/?mode=buyer",
              icons: [
                {
                  src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect fill='%2310b981' width='96' height='96'/><text x='48' y='48' font-size='60' text-anchor='middle' dominant-baseline='central'>👋</text></svg>",
                  sizes: "96x96",
                  type: "image/svg+xml",
                },
              ],
            },
            {
              name: "Trader Mode",
              short_name: "Sell",
              description: "Accept waves and deliver to nearby buyers",
              url: "/runner?mode=trader",
              icons: [
                {
                  src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect fill='%2310b981' width='96' height='96'/><text x='48' y='48' font-size='60' text-anchor='middle' dominant-baseline='central'>🛒</text></svg>",
                  sizes: "96x96",
                  type: "image/svg+xml",
                },
              ],
            },
          ],
          share_target: {
            action: "/share",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              title: "title",
              text: "text",
              url: "url",
            },
          },
        },
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
