# Terrain Medal Production Qualification — PQ1

## Purpose

PQ1 converts Terrain Medal from a feature-complete engineering capability into a production-qualified manufacturing pipeline **within a documented operating envelope**.

## Scope freeze

Effective with PQ1, feature expansion is frozen. New feature work is permitted only when qualification testing exposes:

1. a defect;
2. a safety/integrity problem;
3. a qualification-blocking interoperability gap; or
4. a missing diagnostic required to produce objective evidence.

UI embellishment, new fabrication features, new export formats and unrelated capability expansion are out of scope until the blocking manufacturing gates close.

## Gate order

1. PQ1-01 — real GeoTIFF corpus
2. PQ1-02 — offline dependency bundling
3. PQ1-03 — slicer interoperability
4. PQ1-04 — physical-print validation
5. PQ1-05 — scale/performance envelope
6. PQ1-06 — GLB visual/AR viewer

PQ1-06 is a presentation/consumption gate and **does not block manufacturing qualification**.

## Manufacturing qualification blockers

Manufacturing qualification requires PQ1-01 through PQ1-05 to PASS. PQ1-03 and PQ1-04 specifically require evidence generated outside the browser/software implementation itself.

## Evidence rule

No gate may be marked PASS from implementation presence alone.

For every test run, record:
- software version/commit;
- operating system/browser;
- source artifact and SHA-256 where practical;
- input parameters;
- expected result;
- observed result;
- warnings/errors;
- evidence path;
- PASS / PARTIAL / FAIL;
- reviewer/date.

## Qualification language

Approved release language is limited to:

> Production-qualified within the documented slicer versions, printer/process combinations, CRS/raster corpus and measured operating envelope.

Do not claim universal slicer, printer, CRS or raster compatibility.
