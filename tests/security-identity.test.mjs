import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("public pages declare the vmm canonical service and official security contact",()=>{
  const home=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");
  const terrain=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  assert.match(home,/rel="canonical" href="https:\/\/vmm\.vayushastr\.workers\.dev\/"/);
  assert.match(terrain,/rel="canonical" href="https:\/\/vmm\.vayushastr\.workers\.dev\/terrain-medal"/);
  for(const html of [home,terrain]){
    assert.match(html,/Official service:/);
    assert.match(html,/vmm\.vayushastr\.workers\.dev/);
    assert.match(html,/info@vayushastr\.com/);
  }
});
