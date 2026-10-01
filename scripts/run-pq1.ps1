$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "VYNDI Terrain Medal PQ1 local qualification" -ForegroundColor Cyan
Write-Host "Repository: $Root"

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm.cmd is not available. Install Node.js 22 or later."
}
$Python = $null
foreach ($candidate in @("py", "python", "python3")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) { $Python = $candidate; break }
}
if (-not $Python) { throw "Python 3.12+ is required for the real GeoTIFF corpus." }

Write-Host "[1/5] Installing exact Node dependencies..."
& npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

Write-Host "[2/5] Installing GeoTIFF corpus tooling..."
if ($Python -eq "py") { & py -3 -m pip install --disable-pip-version-check numpy rasterio }
else { & $Python -m pip install --disable-pip-version-check numpy rasterio }
if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed." }

Write-Host "[3/5] Running syntax and unit tests..."
& npm.cmd run check
if ($LASTEXITCODE -ne 0) { throw "PQ1 syntax check failed." }
& node --test
if ($LASTEXITCODE -ne 0) { throw "PQ1 unit tests failed." }

Write-Host "[4/5] Generating governed artifacts and qualification evidence..."
& npm.cmd run pq1:artifacts
if ($LASTEXITCODE -ne 0) { throw "PQ1 artifact generation failed." }
if ($Python -eq "py") {
    & py -3 qualification/geotiff-corpus/generate-real-corpus.py
    if ($LASTEXITCODE -ne 0) { throw "PQ1 GeoTIFF corpus generation failed." }
    & node scripts/pq1-validate-geotiff.mjs
} else {
    & npm.cmd run pq1:geotiff
}
if ($LASTEXITCODE -ne 0) { throw "PQ1 GeoTIFF validation failed." }
& npm.cmd run pq1:performance
if ($LASTEXITCODE -ne 0) { throw "PQ1 performance qualification failed." }

Write-Host "[5/5] Packaging evidence..."
$EvidenceDir = Join-Path $Root "qualification"
$Zip = Join-Path $Root "PQ1-REPOSITORY-EVIDENCE.zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
$Paths = @(
    (Join-Path $EvidenceDir "validation-artifacts/generated"),
    (Join-Path $EvidenceDir "geotiff-corpus/generated"),
    (Join-Path $EvidenceDir "performance/generated")
) | Where-Object { Test-Path $_ }
Compress-Archive -Path $Paths -DestinationPath $Zip -CompressionLevel Optimal

$Hash = (Get-FileHash $Zip -Algorithm SHA256).Hash
Write-Host ""
Write-Host "PQ1 repository-side qualification completed." -ForegroundColor Green
Write-Host "Evidence: $Zip"
Write-Host "SHA-256: $Hash"
Write-Host "External gates PQ1-03 slicer execution and PQ1-04 physical measurements remain separate."
