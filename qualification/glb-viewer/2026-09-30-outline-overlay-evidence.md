# Overlay geometry, selected geography and official front logo

Source baseline: `eb2be95299d687dc047b90b2f9eb381596c85284`.

## Implemented behaviour

- Raster masks are traced into separate contour-bounded relief solids, including letter counters, before conforming to terrain. Background triangles no longer inherit overlay colours from a touched vertex.
- Geographic boundaries come from a same-origin, validated OpenStreetMap/Nominatim lookup. Polygon and MultiPolygon outlines preserve concavities, holes and independent islands.
- The official front logo is optional, uses the existing PNG, supports position/width/rotation and low-clutter automatic placement, and is embedded in GLB with UV coordinates. Out-of-boundary placement blocks export.
- Both the generic shell and canonical v31 shell load the updated controller. The local pinned Three.js triangulator is bundled during every supported build.

## Fresh checks

- `npm run check`: PASS, including the added outline module.
- Focused terrain/worker/mesh/viewer checks: **135/135 PASS**.
- Full Node suite: **262/264 PASS**. The two community failures (`community page exposes governed membership and rider journal flows`; `authenticated header switches from join link to My VYNDI`) also fail on the unchanged source baseline. No community source was modified.
- Original baseline suite: 252/256 PASS. In addition to the two community failures, it has two stale viewer-path assertions. Those assertions now match the already-existing pinned, root-relative local viewer path.
- Native canvas and DOM controller harness, using synthetic elevation/vector tiles and a concave MultiPolygon with a hole and island: circular export **644,312 triangles**, geographic export **715,140 triangles**; both complete their watertight edge checks and generate STL/3MF/OBJ/GLB. Automatic logo placement and out-of-boundary refusal pass through the controller.
- GLB decoding confirms the official PNG and texture coordinates are embedded. Offline orthographic renders were inspected to check actual exported contour boundaries and lettering.

## Verification limits

The controller harness uses synthetic geography and mocked discovery/tile responses; it is not a live Nominatim or production DEM check. It also substitutes the model-viewer custom element, so it does not prove WebGL or AR rendering. Browser access to the local server was blocked and a local Chromium download was unavailable. No Cloudflare deployment, live browser verification, slicer union/repair check or physical print is claimed.

Independent relief solids overlap the terrain by 0.08 mm. Each solid is closed, but the complete export is not a Boolean-unioned single shell. Actual slicer and physical validation remain required, especially for small type and islands.
