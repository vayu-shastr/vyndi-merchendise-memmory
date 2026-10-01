import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker=readFileSync(new URL("../src/terrain-worker.mjs",import.meta.url),"utf8");

test("/terrain-medal serves the current canonical HTML, never a stale versioned snapshot",()=>{
  assert.match(worker,/assetUrl\.pathname="\/terrain-medal\.html"/);
  assert.doesNotMatch(worker,/assetUrl\.pathname="\/terrain-medal-v31\.html"/);
});
