# PQ1 Execution Proof

Baseline closure commit: `5c4023bfc79bfeb841afa1e0125de72b4c20e32f`

## Hosted execution

A verification PR was opened after the PQ1 workflow was present on `main`, but no GitHub Actions run was created for its head commit. No PASS is claimed from a nonexistent run.

## Local execution fallback

Windows users can execute the same repository-side qualification locally:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-pq1.ps1
```

The runner:
- installs exact Node dependencies;
- builds local GeoTIFF/proj4 and GLB viewer bundles;
- runs syntax and unit tests;
- generates the governed STL/3MF/GLB coupon artifacts;
- generates and validates the real multi-CRS GeoTIFF corpus;
- runs the scale/performance evidence suite;
- packages the generated evidence into `PQ1-REPOSITORY-EVIDENCE.zip` with a SHA-256 digest.

PQ1-03 actual named-slicer execution and PQ1-04 physical measurements remain external evidence gates.
