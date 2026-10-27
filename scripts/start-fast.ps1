$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "1/5 Checking Docker..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker is not running. Open Docker Desktop, wait for 'Engine running', then run this again." -ForegroundColor Red; return }

Write-Host "2/5 Starting the database..." -ForegroundColor Cyan
docker compose up -d db | Out-Null
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  if ((docker inspect -f '{{.State.Health.Status}}' sewops-db 2>$null) -eq 'healthy') { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { Write-Host "Database did not become healthy. Run: docker compose ps" -ForegroundColor Red; return }

Write-Host "3/5 Checking the website port..." -ForegroundColor Cyan
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "Something is already running on port 3000 (probably a SEW OPS WEB window). Close it, then run this again." -ForegroundColor Red
  return
}

Write-Host "4/5 Building the website for production (1 to 3 minutes)..." -ForegroundColor Cyan
$pkg = Get-Content (Join-Path $root "apps/web/package.json") -Raw | ConvertFrom-Json
if (-not $pkg.scripts.build -or -not $pkg.scripts.start) { Write-Host "apps/web/package.json has no build/start script. Tell me." -ForegroundColor Red; return }
npm run build -w @sew-ops/web
if ($LASTEXITCODE -ne 0) { Write-Host "`nThe production build FAILED. Paste me the red lines above." -ForegroundColor Red; return }

Write-Host "5/5 Starting the API and the fast website..." -ForegroundColor Cyan
$apiUp = $false
try { $h = Invoke-RestMethod http://localhost:4000/health -TimeoutSec 2; $apiUp = ($h.status -eq "ok") } catch { }
if (-not $apiUp) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; `$Host.UI.RawUI.WindowTitle='SEW OPS API'; npm run dev:api"
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; `$Host.UI.RawUI.WindowTitle='SEW OPS WEB (fast)'; npm run start -w @sew-ops/web"

$up = $false
for ($i = 0; $i -lt 40; $i++) {
  try { if ((Invoke-WebRequest http://localhost:3000/login -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { $up = $true; break } } catch { }
  Start-Sleep -Seconds 2
}
if (-not $up) { Write-Host "The website did not answer. Look at the 'SEW OPS WEB (fast)' window." -ForegroundColor Red; return }
$ms = [int](Measure-Command { Invoke-WebRequest http://localhost:3000/login -UseBasicParsing | Out-Null }).TotalMilliseconds
Write-Host ("READY (fast mode). Website: http://localhost:3000   login page answered in " + $ms + " ms") -ForegroundColor Green
Write-Host "Back to dev mode later: close all SEW OPS windows, then run .\scripts\start-dev.ps1" -ForegroundColor Gray