# PQ1-05 — Scale and Performance

Testing must deliberately approach and exceed the practical operating limit.

Required progression:

`small → normal → large → very large → expected failure`

Record at minimum:

| Case | Raster pixels | DEM MB | CRS | Mesh vertices | Triangles | Peak RAM | Generation time | Export size | UI responsiveness | Outcome |
|---|---:|---:|---|---:|---:|---:|---:|---:|---|---|

Qualification must establish:
- safe operating envelope;
- warning threshold;
- tiling/decimation threshold;
- refusal threshold;
- behavior at memory pressure;
- recovery after a refused/failed job.

The desired failure mode is deterministic and explicit: tile, simplify, warn or refuse. Browser OOM/crash is not an acceptable controlled failure.
