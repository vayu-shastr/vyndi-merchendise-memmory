# Terrain Medal PQ1 Qualification Report

**Status:** REPOSITORY-SIDE CLOSURE IMPLEMENTED — manufacturing-validation candidate  
**Authority:** Evidence in this `qualification/` tree  
**Baseline:** PQ1 closure branch / PR #48

## Executive status

| Gate | Status | Evidence reference | Decision |
|---|---|---|---|
| PQ1-01 GeoTIFF corpus | IMPLEMENTED / RUN PENDING | `qualification/geotiff-corpus/generate-real-corpus.py`, `scripts/pq1-validate-geotiff.mjs` | not yet qualified |
| PQ1-02 Offline dependencies | IMPLEMENTED / RUN PENDING | local vendor bundler + no-CDN production loader | not yet qualified |
| PQ1-03 Slicer interoperability | OPEN / EXTERNAL | governed coupon artifacts + slicer evidence schema | not qualified |
| PQ1-04 Physical validation | OPEN / EXTERNAL | governed coupon + measurement template | not qualified |
| PQ1-05 Scale/performance | IMPLEMENTED / RUN PENDING | workload guard + `scripts/pq1-performance.mjs` | not yet qualified |
| PQ1-06 GLB viewer | PARTIAL — DESKTOP RENDER + ORBIT + ZOOM PASS, non-blocking | `qualification/glb-viewer/2026-09-30-desktop-render-evidence.md` | desktop rendering, orbit and zoom interaction qualified; mobile/AR still open |

## Repository-side closure

The codebase now contains the complete machinery needed to execute PQ1-01, PQ1-02 and PQ1-05 and to inspect PQ1-06. It also produces a single governed artifact set for PQ1-03 and PQ1-04 so external evidence cannot drift between slicer and print tests.

The GitHub PR head did not receive an Actions run while the PQ1 workflow existed only on the proposed branch. Therefore this report does **not** convert implementation readiness into PASS.

## Manufacturing release decision

**NOT YET PRODUCTION-QUALIFIED.**

The remaining non-software evidence is:
1. actual slicer execution in Bambu Studio, OrcaSlicer, PrusaSlicer and Cura;
2. real physical prints with measured results;
3. executable PQ1 repository evidence run and review.

Manufacturing qualification shall be granted only after PQ1-01 through PQ1-05 are PASS and all evidence identifies the tested operating envelope.

## Evidence integrity

Each evidence item shall identify source commit, artifact checksum, tool/version, environment, expected result, observed result, deviations, warnings/errors, final disposition and review date.

## Final release statement template

> Terrain Medal is production-qualified within the documented CRS/raster corpus, browser/resource envelope, slicer versions, printer/process combinations and measured feature limits recorded in PQ1.

Do not broaden this statement beyond the evidence.
