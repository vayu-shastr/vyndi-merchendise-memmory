import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wrangler=readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const worker=readFileSync(new URL("../src/terrain-worker.mjs",import.meta.url),"utf8");
const home=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");
const terrain=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
const security=readFileSync(new URL("../SECURITY.md",import.meta.url),"utf8");

test("Cloudflare deployment targets the vmm Worker",()=>{
  assert.match(wrangler,/"name"\s*:\s*"vmm"/);
});

test("standalone public surfaces identify the vmm canonical service",()=>{
  assert.match(home,/rel="canonical" href="https:\/\/vmm\.vayushastr\.workers\.dev\/"/);
  assert.match(terrain,/rel="canonical" href="https:\/\/vmm\.vayushastr\.workers\.dev\/terrain-medal"/);
  assert.match(worker,/service:"https:\/\/vmm\.vayushastr\.workers\.dev"/);
  assert.match(security,/https:\/\/vmm\.vayushastr\.workers\.dev\//);
});

test("VYBES community remains linked to the separate community service",()=>{
  assert.match(home,/https:\/\/vyndi-ride-stories\.vayushastr\.workers\.dev\/community/);
  assert.match(terrain,/https:\/\/vyndi-ride-stories\.vayushastr\.workers\.dev\/community/);
});
