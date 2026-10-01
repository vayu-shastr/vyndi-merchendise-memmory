import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("model-viewer runtime is generated on every supported deployment path", async () => {
  const pkg=JSON.parse(await readFile(new URL("../package.json", import.meta.url),"utf8"));
  const wrangler=await readFile(new URL("../wrangler.jsonc", import.meta.url),"utf8");
  const vendorBuilder=await readFile(new URL("../scripts/build-vendor.mjs", import.meta.url),"utf8");
  const currentRuntime=await readFile(new URL("../dist/terrain-medal-v31.js", import.meta.url),"utf8");

  assert.equal(pkg.scripts.postinstall,"npm run build:vendor");
  assert.match(wrangler,/"build"\s*:\s*\{[\s\S]*"command"\s*:\s*"npm run build:vendor"/);
  assert.match(vendorBuilder,/model-viewer\.min\.js/);
  assert.match(currentRuntime,/const MODEL_VIEWER_LOCAL="\/vendor\/model-viewer\.min\.js\?v=4\.3\.1"/);
});
