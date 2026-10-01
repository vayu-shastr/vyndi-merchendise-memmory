# PQ1-06 Desktop GLB Viewer Evidence — 2026-09-30

## Evidence source

User-supplied live production screenshot from:

`https://vyndi-ride-stories.vayushastr.workers.dev/terrain-medal`

Runtime fix authority:
- PR #51
- commit `f7f80af887c37bb8e51a1fbf14336c77009190f5`
- Terrain Medal runtime `v25`

## Observed result

The live GLB inspection panel displays:

> GLB rendered · exact governed export is visible.

The viewport is visibly nonblank and contains the generated terrain model with differentiated material/feature colours.

## Sub-check disposition

| Check | Result | Evidence |
|---|---|---|
| Viewer custom element initialized | PASS | real `load` status reached |
| Governed GLB blob accepted | PASS | viewer reports rendered state after generation |
| Visible geometry | PASS | model visible in the GLB inspection viewport |
| Material/feature differentiation | PASS | multiple rendered colours/features visible |
| Desktop browser presentation | PASS | live production screenshot |
| Orbit interaction | PASS | two live production screenshots show the same governed GLB rotated from oblique/front view to near edge-on view |
| Zoom interaction | PASS | live production screenshot shows the same governed GLB at substantially closer magnification than prior views |
| Mobile rendering | NOT YET EVIDENCED | no mobile evidence supplied |
| AR launch/render | NOT YET EVIDENCED | no AR-capable device evidence supplied |

## Gate decision

**PQ1-06: PARTIAL — DESKTOP RENDER + ORBIT + ZOOM PASS**

Do not promote PQ1-06 to full PASS until the remaining mobile/AR checks required by the qualification target are evidenced.

PQ1-06 remains non-blocking for manufacturing qualification.
