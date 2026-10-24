param([int]$Keep = 14)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker is not running. Open Docker Desktop first." -ForegroundColor Red; exit 1 }
if (-not (docker ps --filter "name=sewops-db" -q)) { Write-Host "The database container is not running. Run .\scripts\start-dev.ps1 first." -ForegroundColor Red; exit 1 }

$dir = Join-Path $root "backups"
New-Item -ItemType Directory -Force $dir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$file = Join-Path $dir ("sewops_" + $stamp + ".dump")

docker exec sewops-db sh -c "pg_dump -U sewops -d sewops -Fc -f /tmp/sewops.dump"
if ($LASTEXITCODE -ne 0) { Write-Host "pg_dump failed." -ForegroundColor Red; exit 1 }
$items = [int](("" + (docker exec sewops-db sh -c "pg_restore --list /tmp/sewops.dump | wc -l")).Trim())
docker cp sewops-db:/tmp/sewops.dump "$file" | Out-Null
docker exec sewops-db rm -f /tmp/sewops.dump

if (-not (Test-Path $file)) { Write-Host "The backup file was not created." -ForegroundColor Red; exit 1 }
$size = (Get-Item $file).Length
if ($size -lt 20000 -or $items -lt 20) {
  Write-Host ("The backup looks too small (" + $size + " bytes, " + $items + " items). Do not trust it.") -ForegroundColor Red
  exit 1
}

Get-ChildItem $dir -Filter "sewops_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item -Force

Write-Host ("Backup saved: " + $file) -ForegroundColor Green
Write-Host ("  {0:N0} KB, {1} database objects. The newest {2} backups are kept." -f ($size / 1KB), $items, $Keep)
Write-Host "  Reminder: this folder is on THIS computer. Copy it somewhere else regularly (cloud drive or USB)." -ForegroundColor Yellow