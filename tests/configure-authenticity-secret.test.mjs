import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("authenticity activation avoids Windows .cmd spawning and uses local Wrangler through Node",()=>{
  const src=readFileSync(new URL("../scripts/configure-authenticity-secret.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(src,/npx\.cmd|process\.platform===["']win32["']/);
  assert.match(src,/process\.execPath/);
  assert.match(src,/node_modules[\\/]wrangler[\\/]bin[\\/]wrangler\.js/);
  assert.match(src,/VYNDI_AUTH_SECRET/);
  assert.match(src,/randomBytes\(48\)/);
});
