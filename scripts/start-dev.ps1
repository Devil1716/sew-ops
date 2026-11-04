$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "1/4 Checking Docker..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Open Docker Desktop, wait for 'Engine running', then run this again." -ForegroundColor Red
  return
}

Write-Host "2/4 Starting Postgres and Redis..." -ForegroundColor Cyan
docker compose up -d db redis | Out-Null
$dbReady = $false
$redisReady = $false
for ($i = 0; $i -lt 30; $i++) {
  if ((docker inspect -f '{{.State.Health.Status}}' sewops-db 2>$null) -eq 'healthy') { $dbReady = $true }
  if ((docker compose exec -T redis redis-cli ping 2>$null) -eq 'PONG') { $redisReady = $true }
  if ($dbReady -and $redisReady) { break }
  Start-Sleep -Seconds 2
}
if (-not $dbReady -or -not $redisReady) { Write-Host "Postgres or Redis did not become healthy. Run: docker compose ps" -ForegroundColor Red; return }

Write-Host "3/4 Opening the API and the website in their own windows..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; `$Host.UI.RawUI.WindowTitle='SEW OPS API'; npm run dev:api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; `$Host.UI.RawUI.WindowTitle='SEW OPS WEB'; npm run dev"

Write-Host "4/4 Waiting for the API to answer..." -ForegroundColor Cyan
$up = $false
for ($i = 0; $i -lt 40; $i++) {
  try { $h = Invoke-RestMethod http://localhost:4000/health -TimeoutSec 2; if ($h.status -eq 'ok') { $up = $true; break } } catch { }
  Start-Sleep -Seconds 2
}
if ($up) { Write-Host "READY. Postgres: localhost:5432   Compose Redis: localhost:6380   API: http://localhost:4000/health   Website: http://localhost:3000" -ForegroundColor Green }
else { Write-Host "The API did not answer in time. Look at the 'SEW OPS API' window for a red error." -ForegroundColor Red }
