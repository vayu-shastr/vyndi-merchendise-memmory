import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("external event snippets are stripped without assigning untrusted markup to innerHTML",()=>{
  const js=readFileSync(new URL("../dist/app.js",import.meta.url),"utf8");
  const start=js.indexOf("function stripSearchMarkup");
  const end=js.indexOf("async function searchWikidataEntities",start);
  const body=js.slice(start,end);
  assert.doesNotMatch(body,/\.innerHTML\s*=/);
  assert.match(body,/replace\(\/<\[\^>\]\*>\/g/);
});

test("cart rendering escapes customer-provided configuration text",()=>{
  const js=readFileSync(new URL("../dist/app.js",import.meta.url),"utf8");
  const start=js.indexOf("function renderCart");
  const end=js.indexOf("function openCart",start);
  const body=js.slice(start,end);
  assert.match(body,/escapeXml\(String\(item\.configuration\?\.title/);
});
