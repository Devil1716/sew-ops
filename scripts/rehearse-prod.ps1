# Rehearse production on THIS computer: the same images, the same front door, the same database setup as the real server.
#   .\scripts\rehearse-prod.ps1            build + start (restores your latest backup so you can sign in)
#   .\scripts\rehearse-prod.ps1 -Test      run the factory-day and security checks against it
#   .\scripts\rehearse-prod.ps1 -Down      stop it and delete its data
param([switch]$Test, [switch]$Down, [switch]$NoBackup)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$envFile = "deploy/.env.rehearsal"
$compose = @("compose", "-p", "sewops-rehearsal", "--env-file", $envFile, "-f", "deploy/docker-compose.prod.yml")
function DC { & docker @compose @args }
function Http($path) { ("" + (curl.exe -k -s -o NUL -w "%{http_code}" ("https://localhost:8443" + $path))).Trim() }

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker is not running. Open Docker Desktop first." -ForegroundColor Red; return }

if ($Down) {
  if (Test-Path $envFile) { DC --profile tools down -v; Write-Host "Rehearsal stopped and its data removed." -ForegroundColor Yellow } else { Write-Host "Nothing to stop." }
  return
}

if ($Test) {
  if ((Http "/health") -ne "200") { Write-Host "The rehearsal is not running. Start it first: .\scripts\rehearse-prod.ps1" -ForegroundColor Red; return }
  $sec = Read-Host "Admin password (the admin of the restored backup)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $env:ADMIN_EMAIL = "dhanushrpoojari0@gmail.com"
  $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:API_BASE = "https://localhost:8443/v1"
  $env:WEB_ORIGIN = "https://localhost:8443"
  $env:NODE_TLS_REJECT_UNAUTHORIZED = "0"   # the rehearsal certificate is self-made; this is only for this local test
  try {
    Write-Host "`n=== factory day through the front door ===" -ForegroundColor Cyan
    node apps/api/scripts/verify-factory-day.mjs; $c1 = $LASTEXITCODE
    Write-Host "`n=== security probes through the front door ===" -ForegroundColor Cyan
    node apps/api/scripts/verify-security.mjs; $c2 = $LASTEXITCODE
  } finally {
    Remove-Item Env:ADMIN_PASSWORD, Env:ADMIN_EMAIL, Env:API_BASE, Env:WEB_ORIGIN, Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
  }
  Write-Host ""
  if ($c1 -eq 0 -and $c2 -eq 0) { Write-Host "REHEARSAL TESTS PASSED" -ForegroundColor Green } else { Write-Host "REHEARSAL TESTS FAILED: send me the FAIL lines" -ForegroundColor Red }
  Write-Host "(the test data lives only in the rehearsal database; .\scripts\rehearse-prod.ps1 -Down deletes it)" -ForegroundColor Gray
  return
}

function RandHex($bytes) { $b = New-Object byte[] $bytes; $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($b); -join ($b | ForEach-Object { $_.ToString("x2") }) }
if (-not (Test-Path $envFile)) {
  $lines = @("POSTGRES_USER=sewops", ("POSTGRES_PASSWORD=" + (RandHex 24)), "POSTGRES_DB=sewops", ("JWT_ACCESS_SECRET=" + (RandHex 48)), "SITE_ADDRESS=localhost", "PUBLIC_ORIGIN=https://localhost:8443", "HTTP_PORT=8080", "HTTPS_PORT=8443", "ALLOW_LOCALHOST_ORIGIN=true")
  [IO.File]::WriteAllText((Join-Path $root $envFile), (($lines -join "`n") + "`n"))
  Write-Host "created $envFile (random secrets, for this rehearsal only)" -ForegroundColor Green
}

function WaitHealthy($service, $tries) {
  for ($i = 0; $i -lt $tries; $i++) {
    $id = ("" + (DC ps -q $service)).Trim()
    if ($id) { $s = ("" + (docker inspect -f '{{.State.Health.Status}}' $id 2>$null)).Trim(); if ($s -eq "healthy") { return $true } }
    Start-Sleep -Seconds 3
  }
  return $false
}

Write-Host "1/6 Building the images (the first time takes 5 to 15 minutes)..." -ForegroundColor Cyan
DC --profile tools build
if ($LASTEXITCODE -ne 0) { Write-Host "`nThe image build FAILED. Paste me the red lines above (the last 40 lines are enough)." -ForegroundColor Red; return }

Write-Host "2/6 Starting the database..." -ForegroundColor Cyan
DC up -d db
if (-not (WaitHealthy "db" 40)) { Write-Host "Database did not become healthy." -ForegroundColor Red; return }

Write-Host "3/6 Applying every database migration to an EMPTY database (this is what a new server does)..." -ForegroundColor Cyan
DC run --rm migrate
if ($LASTEXITCODE -ne 0) { Write-Host "Migrations FAILED. Paste me the output above." -ForegroundColor Red; return }

$dump = if (Test-Path "backups") { Get-ChildItem "backups" -Filter "sewops_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 } else { $null }
if ($dump -and -not $NoBackup) {
  Write-Host ("4/6 Restoring your latest backup (" + $dump.Name + ") so you can sign in...") -ForegroundColor Cyan
  $dbId = ("" + (DC ps -q db)).Trim()
  docker cp $dump.FullName ($dbId + ":/tmp/restore.dump") | Out-Null
  DC exec -T db psql -U sewops -d postgres -c "DROP DATABASE IF EXISTS sewops WITH (FORCE);" | Out-Null
  DC exec -T db psql -U sewops -d postgres -c "CREATE DATABASE sewops;" | Out-Null
  DC exec -T db pg_restore -U sewops -d sewops --no-owner --no-privileges /tmp/restore.dump
  $users = ("" + (DC exec -T db psql -U sewops -d sewops -t -A -c "SELECT count(*) FROM users;")).Trim()
  Write-Host ("   people in the restored database: " + $users)
  DC run --rm migrate
} else { Write-Host "4/6 No backup restored (empty database: there is no admin to sign in with yet)." -ForegroundColor Yellow }

Write-Host "5/6 Starting the API, the website and the front door..." -ForegroundColor Cyan
DC up -d
$ok = (WaitHealthy "api" 40) -and (WaitHealthy "web" 40)
if (-not $ok) { Write-Host "API or website is not healthy. Run: docker compose -p sewops-rehearsal --env-file deploy/.env.rehearsal -f deploy/docker-compose.prod.yml logs --tail 60 api web   and paste the output." -ForegroundColor Red; return }

Write-Host "6/6 Checking through the front door..." -ForegroundColor Cyan
for ($i = 0; $i -lt 20 -and (Http "/health") -ne "200"; $i++) { Start-Sleep -Seconds 3 }
$good = $true
foreach ($c in @(@("/health", "200"), @("/login", "200"), @("/v1/auth/me", "401"))) {
  $code = Http $c[0]
  if ($code -eq $c[1]) { Write-Host ("  [OK]   " + $c[0] + " answered " + $code) -ForegroundColor Green } else { Write-Host ("  [FAIL] " + $c[0] + " answered " + $code + " (expected " + $c[1] + ")") -ForegroundColor Red; $good = $false }
}
if ($good) {
  Write-Host "`nREHEARSAL IS UP: https://localhost:8443/login" -ForegroundColor Green
  Write-Host "Your browser will warn about the certificate (it is self-made): click Advanced, then Proceed to localhost." -ForegroundColor Gray
  Write-Host "Next: .\scripts\rehearse-prod.ps1 -Test    Stop and wipe: .\scripts\rehearse-prod.ps1 -Down" -ForegroundColor Gray
}