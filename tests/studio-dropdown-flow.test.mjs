import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");
const v3=readFileSync(new URL("../dist/ride-stories-v3.html",import.meta.url),"utf8");
const v4=readFileSync(new URL("../dist/ride-stories-v4.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../dist/app.js",import.meta.url),"utf8");
const theme=readFileSync(new URL("../dist/my-road-my-glory-theme.css",import.meta.url),"utf8");

for(const surface of [html,v3,v4]){
  test("creator exposes compact dropdown choice groups",()=>{
    for(const key of ["layout","map","frame","mount","format","colour"]){
      assert.match(surface,new RegExp('data-studio-dropdown="'+key+'"'));
    }
    assert.match(surface,/id="studioHoverPreview"/);
    assert.match(surface,/class="studio-select-trigger"/);
    assert.doesNotMatch(surface,/class="studio-choice-row"/);
  });
}

test("hover preview is temporary and selection is committed directly to live preview",()=>{
  assert.match(js,/function showStudioOptionPreview/);
  assert.match(js,/mouseenter/);
  assert.match(js,/focusin|focus/);
  const start=js.indexOf("function commitStudioDropdownChoice");
  const end=js.indexOf("$$('.studio-select').forEach",start);
  const body=js.slice(start,end);
  for(const setter of ["setStudioLayout","setStudioMapStyle","setStudioFrame","setStudioMount","setStudioSize","setStudioRouteColour"]){
    assert.match(body,new RegExp(setter+"\\("));
  }
  assert.match(body,/dropdown\.open=false/);
});

test("studio controller has no corrupted triple-dollar selector",()=>{
  assert.doesNotMatch(js,/\$\$\$\(/);
  assert.match(js,/\$\$\('\.studio-select'\)\.forEach/);
  assert.match(js,/\$\$\('\.studio-select-option'\)\.forEach/);
});

test("one creator remains the source of product configuration",()=>{
  assert.match(html,/class="memento-options legacy-memento-controls" hidden/);
  assert.doesNotMatch(html,/id="shopGrid"/);
  assert.match(html,/id="finish"/);
  assert.match(html,/class="finish-section/);
  assert.doesNotMatch(html,/<section class="club /);
  assert.doesNotMatch(html,/<section class="closing"/);
});

test("creator workflow guidance and event finder are one integrated workspace",()=>{
  const studioStart=html.indexOf('<section class="studio parallax-section" id="stories">');
  const integratedEnd=html.indexOf("<!-- /integrated-studio -->",studioStart);
  assert.ok(studioStart>=0);
  assert.ok(integratedEnd>studioStart);
  const workspace=html.slice(studioStart,integratedEnd);
  assert.match(workspace,/id="event-finder"/);
  assert.match(workspace,/class="studio-workflow-strip"/);
  assert.match(workspace,/class="studio-event-panel"/);
  assert.doesNotMatch(html,/<section class="shop-how /);
  assert.doesNotMatch(html,/<section class="event-finder /);
});

test("finish section combines order and community without another catalogue",()=>{
  assert.match(html,/FINISH \+ ORDER/);
  assert.match(html,/One creator\.[\s\S]*One final piece\./);
  assert.match(html,/Open VYNDI Community/);
  assert.match(html,/id="addConfiguredToCart"/);
  assert.match(html,/community-channels/);
  assert.doesNotMatch(html,/data-shop-filter=/);
});

test("icon-led compact orientation keeps live preview as the primary anchor",()=>{
  assert.match(html,/class="experience-rail"/);
  assert.match(theme,/\.studio-selector-grid/);
  assert.match(theme,/\.studio-hover-preview/);
  assert.match(theme,/\.studio-integrated-flow/);
  assert.match(theme,/\.studio-workflow-strip/);
  assert.match(theme,/\.studio-event-panel/);
  assert.match(theme,/LIVE PREVIEW/);
});

test("all public shells load the repaired live-preview controller",()=>{
  for(const surface of [html,v3,v4]){
    assert.match(surface,/app\.js\?v=20261001-ui-audit-4/);
    assert.doesNotMatch(surface,/app\.js\?v=20261001-live-preview-2/);
  }
});

test("studio control wiring exists before default selections initialise",()=>{
  const wiring=js.indexOf("$$('.studio-select-option').forEach");
  const init=js.indexOf("setStudioLayout('route');");
  assert.ok(wiring>=0);
  assert.ok(init>wiring);
});


test("every studio option has a visible live-preview effect in all layout combinations",()=>{
  for(const layout of ["photo-medal","complete","double-photo","double-medal"]){
    assert.match(theme,new RegExp("size-portrait\\.layout-"+layout+"|layout-"+layout+"\\.size-portrait"));
    assert.match(theme,new RegExp("size-landscape\\.layout-"+layout+"|layout-"+layout+"\\.size-landscape"));
  }
  for(const style of ["standard","paper","graphite","night"]){
    assert.match(theme,new RegExp("map-"+style+"[^\\n]*studio-map-embed|studio-map\\.map-"+style+"[\\s\\S]{0,180}studio-map-embed"));
  }
  assert.match(theme,/\.studio-map-empty::after/);
  assert.match(theme,/background:\s*var\(--route-preview,\s*var\(--route\)\)/);
});

test("selection confirmation remains visible without a GPX",()=>{
  assert.match(js,/document\.body\.dataset\.studioRouteColour/);
  assert.match(js,/studioMapEmpty\?\.style\.setProperty\("--route-preview"/);
});

