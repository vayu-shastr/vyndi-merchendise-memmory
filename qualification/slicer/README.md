# PQ1-03 — Slicer Interoperability

Target slicers:
- Bambu Studio
- OrcaSlicer
- PrusaSlicer
- UltiMaker Cura

Use the **same governed validation artifact set** for every slicer.

For every slicer/version record:

```
Slicer:
Version:
OS:
Terrain Medal commit:
Artifact filename:
Artifact SHA-256:
Imported dimensions:
Objects/parts detected:
Material regions detected:
Repair warnings:
Other warnings/errors:
Slice completed:
Layer count:
Toolpath/G-code generated:
Screenshots/logs:
Verdict: PASS / PARTIAL / FAIL
Reviewer/date:
```

Minimum checks:
- STL scale and geometry;
- 3MF scale, part/material-region integrity and automatic-repair behavior;
- OBJ/MTL import where supported;
- GLB import only where supported/meaningful;
- no missing bodies;
- no unintended part merging;
- no destructive mesh repair;
- successful slice/toolpath generation.

A slicer is qualified only for the exact tested version(s).
