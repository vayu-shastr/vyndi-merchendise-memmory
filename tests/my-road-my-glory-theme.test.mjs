import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["../dist/index.html","../dist/ride-stories-v3.html","../dist/ride-stories-v4.html"]) {
  test(file+" uses My Road My Glory as the visible product theme",()=>{
    const html=readFileSync(new URL(file,import.meta.url),"utf8");
    assert.match(html,/MY ROAD\s*[—-]\s*MY GLORY/i);
    assert.match(html,/Powered by VYNDI Ride Stories/i);
    assert.match(html,/assets\/vayu-official\.png/);
    assert.doesNotMatch(html,/assets\/mrmg-mark\.svg/);
    const footer=html.slice(html.indexOf("<footer"));
    const beforeFooter=html.slice(0,html.indexOf("<footer"));
    assert.match(beforeFooter,/MY ROAD\s*[—-]\s*MY GLORY/i);
    assert.match(footer,/Vāyú Shastr Pvt Ltd/i);
    assert.match(beforeFooter,/vayu-official\.png/i);
  });
}

test("Terrain Medal uses My Road My Glory product identity before final attribution",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const footer=html.slice(html.indexOf("<footer"));
  const beforeFooter=html.slice(0,html.indexOf("<footer"));
  assert.match(beforeFooter,/MY ROAD\s*[—-]\s*MY GLORY/i);
  assert.match(beforeFooter,/Powered by VYNDI Ride Stories/i);
  assert.match(beforeFooter,/MY ROAD\s*[—-]\s*MY GLORY/i);
  assert.match(footer,/Vāyú Shastr Pvt Ltd/i);
});

test("app copy no longer exposes Vayu as the active Ride Stories brand",()=>{
  const js=readFileSync(new URL("../dist/app.js",import.meta.url),"utf8");
  assert.match(js,/My Road — My Glory/);
  assert.match(js,/Powered by VYNDI Ride Stories/);
  assert.doesNotMatch(js,/brand:'Vāyú Shastr Pvt Ltd \/ VYNDI'/);
  assert.doesNotMatch(js,/original Vāyú presentation/);
});
