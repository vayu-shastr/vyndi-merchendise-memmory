import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const worker=readFileSync(new URL("../src/terrain-worker.mjs",import.meta.url),"utf8");
const wrangler=readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

test("standalone security disclosure surfaces are present and routed through the Worker",()=>{
  for(const relative of [
    "../dist/_headers",
    "../dist/.well-known/security.txt",
    "../dist/security-policy.html"
  ]) assert.equal(existsSync(new URL(relative,import.meta.url)),true,relative+" must exist");

  assert.match(worker,/path==="\/\.well-known\/security\.txt"/);
  assert.match(worker,/path==="\/security-policy\.html"/);
  assert.match(wrangler,/\/\.well-known\/security\.txt/);
  assert.match(wrangler,/\/security-policy\.html/);
});

test("security disclosure identifies the vmm canonical service",()=>{
  const securityTxt=readFileSync(new URL("../dist/.well-known/security.txt",import.meta.url),"utf8");
  const policy=readFileSync(new URL("../dist/security-policy.html",import.meta.url),"utf8");
  assert.match(securityTxt,/https:\/\/vmm\.vayushastr\.workers\.dev\/\.well-known\/security\.txt/);
  assert.match(securityTxt,/https:\/\/vmm\.vayushastr\.workers\.dev\/security-policy\.html/);
  assert.match(policy,/vmm\.vayushastr\.workers\.dev/);
});

test("supply-chain security automation is installed",()=>{
  for(const relative of [
    "../.github/dependabot.yml",
    "../.github/workflows/codeql.yml",
    "../.github/workflows/security-baseline.yml"
  ]) assert.equal(existsSync(new URL(relative,import.meta.url)),true,relative+" must exist");
});
