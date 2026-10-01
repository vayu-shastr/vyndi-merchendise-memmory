# PQ1 Known Limits

This file records qualification limits, not implementation marketing claims.

## GeoTIFF

- A governed real-raster corpus generator now covers EPSG:4326, EPSG:3857, three northern WGS84 UTM zones and two southern WGS84 UTM zones, plus awkward raster dimensions/extents and explicit NoData.
- Those cases are generated from the OSGeo/GDAL `small_world.tif` fixture and validated through the production loader.
- The executable corpus run must still produce reviewed evidence before PQ1-01 is PASS.
- CRS families outside the qualified corpus remain out of scope until separately evidenced.

## Dependencies

- GeoTIFF/proj4 runtime loading is now local; there is no CDN fallback in the production loader.
- Exact dependency versions are pinned and bundled into `dist/vendor` at build/deploy time.
- A clean qualification run still must prove the built artifacts and network-independent runtime behavior before PQ1-02 is PASS.

## Slicers

- One SHA-256 governed coupon artifact set is generated for Bambu Studio, OrcaSlicer, PrusaSlicer and Cura.
- No slicer is qualified merely because its name appears in the manifest or because the file format is syntactically valid.
- Exact tested slicer versions and actual import/slice/toolpath results must be recorded.

## Physical manufacturing

- Recommended minimum feature values remain engineering recommendations until confirmed by controlled prints.
- Printer, nozzle, layer height, material, orientation, wall count and process settings can change the actual printable limit.
- One successful printer/material combination does not qualify another.

## Performance

- Production generation now has deterministic allow/warn/tile/refuse workload behavior instead of uncontrolled browser memory escalation.
- The benchmark runner actually allocates/scans small, normal and large rasters and exercises the guard for very-large/refusal cases without deliberately crashing CI.
- Browser/device-specific memory limits remain qualified only after runtime evidence on the documented target environment.

## GLB/AR

- The exact generated GLB is bound to the interactive viewer with orbit/zoom and supported-device AR paths.
- The viewer runtime loads the local `dist/vendor/model-viewer.min.js` bundle when it is actually deployed. If that asset is absent, the current Worker uses the exact pinned `@google/model-viewer@4.3.1` jsDelivr fallback.
- Viewer status is governed by the real `load` / `error` events; assigning a GLB blob URL alone is not treated as proof of rendering.
- AR availability depends on browser/device support.
- Live desktop evidence now confirms the viewer reaches the real `load` event and visibly renders the governed GLB with differentiated materials/features.
- Live desktop evidence also confirms orbit interaction: the same governed GLB was rotated from an oblique/front view to a near edge-on view.
- Live desktop evidence also confirms zoom interaction: the same governed GLB is shown at substantially closer magnification than prior views.
- Mobile rendering and AR launch/render still require separate evidence before PQ1-06 can be marked full PASS.
- PQ1-06 remains non-blocking for manufacturing release.
