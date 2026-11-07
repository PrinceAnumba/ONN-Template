// MapLibre runs in a web worker that bundlers don't emit for us. This copies the worker and the
// chunk it imports into each app's static folder, matching the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const root = join(import.meta.dirname, "..", "..", "apps");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

for (const app of ["portal", "admin", "storybook"]) {
  const target = join(root, app, "public", "vendor", "maplibre");
  mkdirSync(target, { recursive: true });
  for (const file of files) copyFileSync(join(dist, file), join(target, file));
}
console.log("[charts] MapLibre worker copied to apps/*/public/vendor/maplibre");
