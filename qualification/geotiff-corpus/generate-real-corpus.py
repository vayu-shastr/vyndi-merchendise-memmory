#!/usr/bin/env python3
"""Build a governed real-raster GeoTIFF qualification corpus from the OSGeo/GDAL small_world fixture."""
from __future__ import annotations
import hashlib, json, math, urllib.request
from pathlib import Path
import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"qualification"/"geotiff-corpus"/"generated"
OUT.mkdir(parents=True,exist_ok=True)
SOURCE_URL="https://raw.githubusercontent.com/OSGeo/gdal/master/autotest/gdrivers/data/small_world.tif"
SOURCE=OUT/"source-small_world.tif"

CASES=[
  {"id":"wgs84-india-awkward","crs":"EPSG:4326","bbox":[75.15,9.85,79.35,13.62],"size":[137,91],"nodata":True},
  {"id":"webmercator-india","crs":"EPSG:3857","bbox":[75.15,9.85,79.35,13.62],"size":[151,97]},
  {"id":"utm43n-india","crs":"EPSG:32643","bbox":[72.2,8.0,78.8,15.0],"size":[163,101]},
  {"id":"utm31n-france","crs":"EPSG:32631","bbox":[-2.5,43.0,5.5,50.0],"size":[149,107]},
  {"id":"utm18n-us","crs":"EPSG:32618","bbox":[-79.5,37.0,-71.5,44.0],"size":[157,103]},
  {"id":"utm34s-south-africa","crs":"EPSG:32734","bbox":[16.0,-35.5,27.0,-27.5],"size":[161,109]},
  {"id":"utm56s-australia","crs":"EPSG:32756","bbox":[146.0,-39.5,154.0,-31.0],"size":[155,99]},
]

def sha256(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def download_source():
    if not SOURCE.exists():
        urllib.request.urlretrieve(SOURCE_URL,SOURCE)

def build_case(src, case):
    w,h=case["size"]
    dst_crs=case["crs"]
    left,bottom,right,top=transform_bounds("EPSG:4326",dst_crs,*case["bbox"],densify_pts=21)
    dst_transform=from_bounds(left,bottom,right,top,w,h)
    src_data=src.read(1)
    dst=np.zeros((h,w),dtype=np.float32)
    reproject(
        source=src_data,
        destination=dst,
        src_transform=src.transform,
        src_crs=src.crs,
        dst_transform=dst_transform,
        dst_crs=dst_crs,
        resampling=Resampling.bilinear,
        dst_nodata=-9999.0,
    )
    nodata=-9999.0
    if case.get("nodata"):
        # Deliberate internal hole to qualify NoData repair without changing georeferencing.
        y0,y1=max(1,h//3),min(h-1,h//3+7)
        x0,x1=max(1,w//2),min(w-1,w//2+9)
        dst[y0:y1,x0:x1]=nodata
    path=OUT/f'{case["id"]}.tif'
    profile={
      "driver":"GTiff","height":h,"width":w,"count":1,"dtype":"float32",
      "crs":dst_crs,"transform":dst_transform,"nodata":nodata,
      "compress":"deflate","tiled":False,
    }
    with rasterio.open(path,"w",**profile) as out: out.write(dst,1)
    finite=dst[dst!=nodata]
    lon=(case["bbox"][0]+case["bbox"][2])/2
    lat=(case["bbox"][1]+case["bbox"][3])/2
    return {
      "id":case["id"],"filename":path.name,"sha256":sha256(path),"crs":dst_crs,
      "width":w,"height":h,"wgs84Bounds":case["bbox"],"projectedBounds":[left,bottom,right,top],
      "nodata":nodata,"validCount":int(finite.size),
      "min":float(np.min(finite)) if finite.size else None,
      "max":float(np.max(finite)) if finite.size else None,
      "controlPoint":{"lat":lat,"lon":lon},
      "source":"OSGeo/GDAL autotest/gdrivers/data/small_world.tif",
      "sourceUrl":SOURCE_URL,
    }

def main():
    download_source()
    with rasterio.open(SOURCE) as src:
        if str(src.crs)!="EPSG:4326":
            raise RuntimeError(f"Unexpected source CRS {src.crs}; expected EPSG:4326")
        cases=[build_case(src,c) for c in CASES]
    manifest={
      "schema":"vyndi.pq1.geotiff-corpus/v1",
      "source":{"url":SOURCE_URL,"sha256":sha256(SOURCE),"crs":"EPSG:4326"},
      "cases":cases,
      "qualificationIntent":"Real-raster reprojections covering geographic, Web Mercator, northern UTM and southern UTM CRSs with awkward extents and explicit NoData.",
    }
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"cases":len(cases),"manifest":str(OUT/"manifest.json")},indent=2))

if __name__=="__main__": main()
