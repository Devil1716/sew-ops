# Share the real production stack from THIS PC through a free public https link (Cloudflare quick tunnel).
# No account and no money. The link works while this PC is on, online, and Docker is running. It changes on every start.
#   .\scripts\demo-link.ps1           start (or show the current link)
#   .\scripts\demo-link.ps1 -Stop     stop everything (the data is kept)
#   .\scripts\demo-link.ps1 -Fresh    stop, DELETE the demo database, start again from your latest backup
param([switch]$Stop, [switch]$Fresh)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$envFile = "deploy/.env.demo"
$tools = Join-Path $root "tools"
$exe = Join-Path $tools "cloudflared.exe"
$pidFile = Join-Path $tools "cloudflared.pid"
$linkFile = Join-Path $tools "demo-link.txt"
$logFile = Join-Path $tools "cloudflared.log"
$compose = @("compose", "-p", "sewops-demo", "--env-file", $envFile, "-f", "deploy/docker-compose.prod.yml")
function DC { & docker @compose @args }
function Fail([string]$m) { Write-Host ""; Write-Host $m -ForegroundColor Red; exit 1 }
function StopTunnel {
  if (Test-Path $pidFile) {
    $p = [int](Get-Content $pidFile -ErrorAction SilentlyContinue)
    if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
  }
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
function RandHex($bytes) { $b = New-Object byte[] $bytes; $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($b); -join ($b | ForEach-Object { $_.ToString("x2") }) }
function WaitHealthy($service, $tries) {
  for ($i = 0; $i -lt $tries; $i++) {
    $id = ("" + (DC ps -q $service)).Trim()
    if ($id) { $s = ("" + (docker inspect -f '{{.State.Health.Status}}' $id 2>$null)).Trim(); if ($s -eq "healthy") { return $true } }
    Start-Sleep -Seconds 3
  }
  return $false
}

docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker is not running. Open Docker Desktop, wait for 'Engine running', then run this again." }

if ($Stop -or $Fresh) {
  StopTunnel
  Remove-Item $linkFile -ErrorAction SilentlyContinue
  if (Test-Path $envFile) { if ($Fresh) { DC --profile tools down -v } else { DC --profile tools down } }
  if ($Fresh) { Write-Host "Demo stopped and its database deleted." -ForegroundColor Yellow } else { Write-Host "Demo stopped (the data is kept)." -ForegroundColor Yellow; return }
}

if ((Test-Path $linkFile) -and (Test-Path $pidFile)) {
  $alive = Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue
  if ($alive) { Write-Host ("Already running. Link: " + (Get-Content $linkFile -Raw).Trim()) -ForegroundColor Green; return }
}

if (-not (Test-Path $envFile)) {
  $lines = @("POSTGRES_USER=sewops", ("POSTGRES_PASSWORD=" + (RandHex 24)), "POSTGRES_DB=sewops", ("JWT_ACCESS_SECRET=" + (RandHex 48)), "SITE_ADDRESS=:80", "PUBLIC_ORIGIN=https://placeholder.invalid", "HTTP_PORT=8080", "HTTPS_PORT=8443", "ALLOW_LOCALHOST_ORIGIN=false", "TRUST_PROXY_HOPS=2")
  [IO.File]::WriteAllText((Join-Path $root $envFile), (($lines -join "`n") + "`n"))
  Write-Host "created deploy/.env.demo (random secrets for this demo only)" -ForegroundColor Green
}
if ((Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) -and -not ("" + (DC ps -q caddy)).Trim()) {
  Fail "Port 8080 is already in use (the rehearsal stack?). Run .\scripts\rehearse-prod.ps1 -Down, or close whatever uses it, then run this again."
}

New-Item -ItemType Directory -Force $tools | Out-Null
if (-not (Test-Path $exe)) {
  Write-Host "Downloading the free Cloudflare tunnel tool (about 40 MB, only once)..." -ForegroundColor Cyan
  try { Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $exe -UseBasicParsing }
  catch { Fail "Could not download cloudflared. Check your internet, or save cloudflared-windows-amd64.exe (from the cloudflare/cloudflared releases page on GitHub) as tools\cloudflared.exe and run this again." }
}

Write-Host "1/6 Opening the public tunnel..." -ForegroundColor Cyan
StopTunnel
Remove-Item $logFile -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath $exe -ArgumentList @("tunnel", "--url", "http://localhost:8080", "--no-autoupdate") -RedirectStandardError $logFile -RedirectStandardOutput (Join-Path $tools "cloudflared.out.log") -WindowStyle Hidden -PassThru
$proc.Id | Set-Content $pidFile
$origin = ""
for ($i = 0; $i -lt 40 -and -not $origin; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $logFile) {
    $txt = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
    if ($txt) { $m = [regex]::Match($txt, 'https://[a-z0-9-]+\.trycloudflare\.com'); if ($m.Success) { $origin = $m.Value } }
  }
}
if (-not $origin) { StopTunnel; Fail "The tunnel did not give a link within 80 seconds. Check your internet connection and try again." }
$e = [IO.File]::ReadAllText((Join-Path $root $envFile))
[IO.File]::WriteAllText((Join-Path $root $envFile), [regex]::Replace($e, '(?m)^PUBLIC_ORIGIN=.*$', ('PUBLIC_ORIGIN=' + $origin)))
Write-Host ("   link: " + $origin) -ForegroundColor Green

Write-Host "2/6 Building the app images (first time 5 to 15 minutes; later runs are quick)..." -ForegroundColor Cyan
DC --profile tools build
if ($LASTEXITCODE -ne 0) { StopTunnel; Fail "The image build FAILED. Paste me the last 40 lines above." }

Write-Host "3/6 Starting the database and applying migrations..." -ForegroundColor Cyan
$firstRun = [string]::IsNullOrWhiteSpace(("" + (docker volume ls -q --filter "name=sewops-demo_pgdata")))
DC up -d db
if (-not (WaitHealthy "db" 40)) { StopTunnel; Fail "The database did not become healthy." }
DC run --rm migrate
if ($LASTEXITCODE -ne 0) { StopTunnel; Fail "Migrations FAILED. Paste me the output above." }

if ($firstRun) {
  Write-Host "4/6 First run: loading your latest backup (so your admin and demo users exist)..." -ForegroundColor Cyan
  $dump = if (Test-Path "backups") { Get-ChildItem "backups" -Filter "sewops_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 } else { $null }
  if (-not $dump) { StopTunnel; Fail "No backup found in the backups folder. Run .\scripts\backup-db.ps1 first." }
  $dbId = ("" + (DC ps -q db)).Trim()
  docker cp $dump.FullName ($dbId + ":/tmp/restore.dump") | Out-Null
  DC exec -T db psql -U sewops -d postgres -c "DROP DATABASE IF EXISTS sewops WITH (FORCE);" | Out-Null
  DC exec -T db psql -U sewops -d postgres -c "CREATE DATABASE sewops;" | Out-Null
  DC exec -T db pg_restore -U sewops -d sewops --no-owner --no-privileges /tmp/restore.dump
  DC run --rm migrate | Out-Null
} else { Write-Host "4/6 Using the existing demo database (your data from last time is still there)." -ForegroundColor Cyan }

Write-Host "5/6 Starting the app..." -ForegroundColor Cyan
DC up -d --force-recreate api
DC up -d
if (-not ((WaitHealthy "api" 40) -and (WaitHealthy "web" 40))) { Fail "The API or the website is not healthy. Run: docker compose -p sewops-demo --env-file deploy/.env.demo -f deploy/docker-compose.prod.yml logs --tail 60 api web   and paste me the output." }

Write-Host "6/6 Checking the public link..." -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  $code = ("" + (curl.exe -s -o NUL -w "%{http_code}" ($origin + "/health"))).Trim()
  if ($code -eq "200") { $ok = $true } else { Start-Sleep -Seconds 4 }
}
Set-Content -Path $linkFile -Value $origin
Write-Host ""
if ($ok) { Write-Host "LIVE. Open this on ANY device:" -ForegroundColor Green } else { Write-Host "The tunnel is up but the link did not answer yet (DNS can take a minute). Try this on your phone in a minute:" -ForegroundColor Yellow }
Write-Host ("   " + $origin + "/login") -ForegroundColor White
Write-Host "Manager: demo.manager@example.com / Demo-Manager-123456      Operator (at /operator-login): machine DEMO-M1, PIN 493817" -ForegroundColor Gray
Write-Host "Keep this PC on, online and awake (Settings > Power > Screen and sleep > Never while plugged in). Stop: .\scripts\demo-link.ps1 -Stop" -ForegroundColor Gray