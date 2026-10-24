$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker is not running. Open Docker Desktop first." -ForegroundColor Red; exit 1 }
if (-not (docker ps --filter "name=sewops-db" -q)) { Write-Host "The database container is not running. Run .\scripts\start-dev.ps1 first." -ForegroundColor Red; exit 1 }

$dir = Join-Path $root "backups"
$latest = if (Test-Path $dir) { Get-ChildItem $dir -Filter "sewops_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 } else { $null }
if (-not $latest) { Write-Host "No backup found. Run .\scripts\backup-db.ps1 first." -ForegroundColor Red; exit 1 }
Write-Host ("Testing the restore of " + $latest.Name + " (" + $latest.LastWriteTime + ")") -ForegroundColor Cyan

function Sql($db, $sql) { (("" + (docker exec sewops-db psql -U sewops -d $db -t -A -c $sql 2>$null)).Trim()) }
function CountOf($db, $table) { $v = Sql $db ("SELECT count(*) FROM " + $table + ";"); if ($v -match '^\d+$') { [int]$v } else { -1 } }

$scratch = "sewops_restore_test"
docker cp "$($latest.FullName)" sewops-db:/tmp/restore.dump | Out-Null
$null = Sql "postgres" ("DROP DATABASE IF EXISTS " + $scratch + ";")
$null = Sql "postgres" ("CREATE DATABASE " + $scratch + ";")

$restoreOut = docker exec sewops-db pg_restore -U sewops -d $scratch --no-owner --no-privileges /tmp/restore.dump 2>&1 | Out-String
$restoreOk = ($LASTEXITCODE -eq 0)

$tables = @("users","factories","lines","machines","shifts","work_orders","work_order_assignments","operator_assignments","production_events","issues","downtime_events","quality_checks","notifications","audit_logs","factory_settings","_prisma_migrations")
$missing = @()
Write-Host ("{0,-26} {1,10} {2,10}" -f "table", "live now", "restored") -ForegroundColor Gray
foreach ($t in $tables) {
  $live = CountOf "sewops" $t
  $back = CountOf $scratch $t
  if ($back -lt 0) { $missing += $t }
  Write-Host ("{0,-26} {1,10} {2,10}" -f $t, $live, $(if ($back -lt 0) { "MISSING" } else { $back }))
}
$users = CountOf $scratch "users"
$factories = CountOf $scratch "factories"
$migrations = CountOf $scratch "_prisma_migrations"

$null = Sql "postgres" ("DROP DATABASE IF EXISTS " + $scratch + ";")
docker exec sewops-db rm -f /tmp/restore.dump

Write-Host ""
$ok = $restoreOk -and ($missing.Count -eq 0) -and ($users -ge 1) -and ($factories -ge 1) -and ($migrations -ge 1)
if ($ok) {
  Write-Host ("RESTORE TEST PASSED: the backup rebuilds a complete database (" + $users + " users, " + $factories + " factory/ies, " + $migrations + " migrations).") -ForegroundColor Green
  Write-Host "  'live now' can be higher than 'restored': that is just activity since the backup was taken." -ForegroundColor Gray
} else {
  Write-Host "RESTORE TEST FAILED." -ForegroundColor Red
  if (-not $restoreOk) { Write-Host "pg_restore reported errors:"; ($restoreOut -split "`n" | Select-Object -First 15) -join "`n" | Write-Host }
  if ($missing.Count -gt 0) { Write-Host ("Missing tables: " + ($missing -join ", ")) }
  exit 1
}