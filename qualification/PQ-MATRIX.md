# PQ1 Qualification Matrix

Baseline source: Terrain Medal PQ1 closure implementation.

| Gate | Target | Current verified state | Blocking manufacturing? | PASS evidence |
|---|---|---|---|---|
| PQ1-01 GeoTIFF | Real-world CRS/raster robustness | **IMPLEMENTED / EXECUTION EVIDENCE PENDING** — governed OSGeo/GDAL-derived corpus generator + production-loader validator covers EPSG:4326, EPSG:3857, 3 northern UTM zones, 2 southern UTM zones, awkward dimensions/extents and explicit NoData | YES | Generated corpus + `evidence.json` from the production loader |
| PQ1-02 Offline dependencies | Deterministic/offline runtime | **IMPLEMENTED / EXECUTION EVIDENCE PENDING** — browser path now loads local `dist/vendor/geotiff-proj4.mjs`; exact geotiff/proj4 pins; no CDN fallback | YES | Vendor build + syntax/unit test + network-free runtime proof |
| PQ1-03 Slicer interoperability | Manufacturing handoff | **OPEN / UNVALIDATED — EXTERNAL** — one governed STL/3MF/GLB coupon set and machine-readable evidence schema are ready | YES | Same SHA-256 governed artifacts opened/sliced in Bambu Studio, OrcaSlicer, PrusaSlicer and Cura with versions, warnings/errors and generated toolpath evidence |
| PQ1-04 Physical validation | Printed geometry agrees with digital assumptions | **OPEN / UNVALIDATED — EXTERNAL** — governed coupon + measurement CSV are ready | YES | Real printed coupon/terrain specimen with requested/exported/slicer/measured values and deviations |
| PQ1-05 Scale/performance | Large-job reliability | **IMPLEMENTED / EXECUTION EVIDENCE PENDING** — explicit allow/warn/tile/refuse guard + benchmark evidence runner | YES | Small → normal → large actual allocations plus deterministic very-large tiling/refusal evidence; browser envelope confirmation |
| PQ1-06 GLB viewer | Visual/AR delivery | **PARTIAL — DESKTOP RENDER + ORBIT + ZOOM PASS** — live production screenshots confirm real viewer load state, visible governed GLB geometry/material differentiation, drag-orbit interaction and substantial zoom-in magnification; mobile and AR remain unproven | NO | Desktop render/orbit/zoom evidence plus remaining mobile/AR evidence |

## Release states

- **Engineering-capable:** implementation exists and internal checks pass.
- **Manufacturing-validation candidate:** current state; one or more blocking evidence gates are not PASS.
- **Production-qualified:** PQ1-01 through PQ1-05 PASS for a documented operating envelope.
- **Presentation-qualified:** PQ1-06 PASS in addition to manufacturing qualification.

## Evidence authority

Repository implementation is not equivalent to qualification PASS. A gate becomes PASS only when its executable/external evidence is present and reviewed.

## Prohibited shortcut

Generating a validation ZIP, producing a test harness, opening one model successfully, or obtaining one successful print is not sufficient to qualify the full operating envelope.
