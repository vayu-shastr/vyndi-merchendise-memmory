# PQ1-01 — GeoTIFF Corpus

Store governed real-world raster cases and their expected results here.

Minimum corpus dimensions:
- EPSG:4326;
- EPSG:3857;
- at least three northern UTM zones;
- at least two southern UTM zones;
- coarse and fine raster resolutions;
- explicit NoData;
- clipped edges;
- awkward/non-square extents;
- small and large rasters.

For each case record:
- source/licence;
- filename and checksum;
- CRS;
- dimensions/resolution;
- bounding box;
- NoData representation;
- known checkpoints/elevations;
- generated geometry result;
- expected-vs-generated deviation;
- PASS/PARTIAL/FAIL.

Do not commit third-party rasters when their licence prohibits redistribution; store a retrieval note/checksum instead.
