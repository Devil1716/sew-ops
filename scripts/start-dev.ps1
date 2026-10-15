$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "1/4 Checking Docker..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Open Docker Desktop, wait for 'Engine running', then run this again." -ForegroundColor Red
  return
}

Write-Host "2/4 Starting the database..." -ForegroundColor Cyan
docker compose up -d db | Out-Null
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  if ((docker inspect -f '{{.State.Health.Status}}' sewops-db 2>$null) -eq 'healthy') { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { Write-Host "Database did not become healthy. Run: docker compose ps" -ForegroundColor Red; return }

Write-Host "3/4 Opening the API and the website in their own windows..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; `$Host.UI.RawUI.WindowTitle='SEW OPS API'; npm run dev:api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; `$Host.UI.RawUI.WindowTitle='SEW OPS WEB'; npm run dev"

Write-Host "4/4 Waiting for the API to answer..." -ForegroundColor Cyan
$up = $false
for ($i = 0; $i -lt 40; $i++) {
  try { $h = Invoke-RestMethod http://localhost:4000/health -TimeoutSec 2; if ($h.status -eq 'ok') { $up = $true; break } } catch { }
  Start-Sleep -Seconds 2
}
if ($up) { Write-Host "READY. API: http://localhost:4000/health   Website: http://localhost:3000" -ForegroundColor Green }
else { Write-Host "The API did not answer in time. Look at the 'SEW OPS API' window for a red error." -ForegroundColor Red }