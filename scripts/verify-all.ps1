$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$started = Get-Date

Write-Host "Checking that the API is running..." -ForegroundColor Cyan
$healthy = $false
try { $h = Invoke-RestMethod http://localhost:4000/health -TimeoutSec 5; $healthy = ($h.status -eq "ok" -and $h.database -eq "up") } catch { }
if (-not $healthy) { Write-Host "The API is not healthy. Run .\scripts\start-dev.ps1 first." -ForegroundColor Red; exit 1 }

$sec = Read-Host "Admin password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$env:ADMIN_EMAIL = "dhanushrpoojari0@gmail.com"
$env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)

function Clean-TestData { powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts/cleanup-test-data.ps1") | Out-Null }
Clean-TestData   # start from a clean slate
$rows = @()
function Show-Row($r) {
  $mark = if ($r.Ok) { "[PASS]" } else { "[FAIL]" }
  $color = if ($r.Ok) { "Green" } else { "Red" }
  Write-Host ("{0} {1,-40} {2,-14} {3,4}s" -f $mark, $r.Name, $r.Detail, $r.Secs) -ForegroundColor $color
}
function Seconds($t) { [int](((Get-Date) - $t).TotalSeconds) }

try {
  foreach ($ws in @("@sew-ops/api", "@sew-ops/web")) {
    $t = Get-Date
    Write-Host ("Type check " + $ws + " ...") -ForegroundColor Cyan
    $out = npm run typecheck -w $ws 2>&1 | Out-String
    $good = ($LASTEXITCODE -eq 0)
    $r = [pscustomobject]@{ Name = ("typecheck " + $ws); Ok = $good; Detail = $(if ($good) { "clean" } else { "errors" }); Secs = (Seconds $t) }
    $rows += $r; Show-Row $r
    if (-not $good) { ($out -split "`n" | Select-Object -Last 15) -join "`n" | Write-Host }
  }

  $scripts = Join-Path $root "apps/api/scripts"
  $files = @(Get-ChildItem $scripts -Filter "verify-*.mjs" | Where-Object { $_.Name -ne "verify-security.mjs" } | Sort-Object Name)
  $files += Get-Item (Join-Path $scripts "verify-security.mjs")   # last: it triggers login rate limiting

  foreach ($f in $files) {
    $t = Get-Date
    Write-Host ("Running " + $f.Name + " ...") -ForegroundColor Cyan
    $attempt = 0
    do {
      $attempt++
      $out = & node $f.FullName 2>&1 | Out-String
      $code = $LASTEXITCODE
      $limited = ($code -ne 0) -and ($out -match '429|Too Many')
      if ($limited -and $attempt -eq 1) { Write-Host "  rate limit hit; waiting 65 seconds, then trying once more..." -ForegroundColor Yellow; Start-Sleep -Seconds 65 }
    } while ($limited -and $attempt -eq 1)
    $pass = ([regex]::Matches($out, '(?m)^PASS')).Count
    $fail = ([regex]::Matches($out, '(?m)^FAIL')).Count
    $good = ($code -eq 0) -and ($fail -eq 0) -and ($pass -gt 0)
    $r = [pscustomobject]@{ Name = $f.Name; Ok = $good; Detail = ("{0} checks" -f $pass); Secs = (Seconds $t) }
    $rows += $r; Show-Row $r
    if (-not $good) { ($out -split "`n" | Where-Object { $_ -match '^(FAIL|SCRIPT ERROR)' } | Select-Object -First 8) -join "`n" | Write-Host -ForegroundColor Red }
    Clean-TestData   # every suite gets a clean factory
  }
}
finally {
  Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ADMIN_EMAIL -ErrorAction SilentlyContinue
}

Write-Host "`nCleaning up the test data these checks created..." -ForegroundColor Cyan
$sql = "DELETE FROM factory_settings WHERE key = 'alert_types'; DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TEST-%' OR email = 'test.manager@example.com' OR email LIKE 'test.mgr.%@example.com'); DELETE FROM notifications WHERE entity_type = 'issue' AND entity_id IN (SELECT id::text FROM issues WHERE machine_id IN (SELECT id FROM machines WHERE code LIKE 'TEST-%')); DELETE FROM quality_checks WHERE work_order_id IN (SELECT id FROM work_orders WHERE order_number LIKE 'TEST-%'); DELETE FROM downtime_events WHERE machine_id IN (SELECT id FROM machines WHERE code LIKE 'TEST-%'); DELETE FROM issues WHERE machine_id IN (SELECT id FROM machines WHERE code LIKE 'TEST-%'); DELETE FROM production_events WHERE machine_id IN (SELECT id FROM machines WHERE code LIKE 'TEST-%') AND reverses_event_id IS NOT NULL; DELETE FROM production_events WHERE machine_id IN (SELECT id FROM machines WHERE code LIKE 'TEST-%'); DELETE FROM work_order_assignments WHERE work_order_id IN (SELECT id FROM work_orders WHERE order_number LIKE 'TEST-%'); DELETE FROM work_orders WHERE order_number LIKE 'TEST-%'; DELETE FROM operator_assignments WHERE machine_id IN (SELECT id FROM machines WHERE code LIKE 'TEST-%'); DELETE FROM machines WHERE code LIKE 'TEST-%'; DELETE FROM lines WHERE code LIKE 'TEST-%'; DELETE FROM shifts WHERE name LIKE 'TEST%'; DELETE FROM users WHERE employee_code LIKE 'TEST-%' OR email = 'test.manager@example.com' OR email LIKE 'test.mgr.%@example.com'; DELETE FROM user_factories WHERE factory_id IN (SELECT id FROM factories WHERE code LIKE 'TEST-%'); DELETE FROM factories WHERE code LIKE 'TEST-%';"
docker exec sewops-db psql -U sewops -d sewops -c $sql | Out-Null
$people = docker exec sewops-db psql -U sewops -d sewops -t -A -c "SELECT string_agg(name || ' (' || role || ')', ', ') FROM users;"
Write-Host ("People left in the database: " + $people)

$failedCount = @($rows | Where-Object { -not $_.Ok }).Count
Write-Host "`n=== RESULT ===" -ForegroundColor Cyan
$rows | ForEach-Object { Show-Row $_ }
$minutes = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
if ($failedCount -eq 0) { Write-Host ("EVERYTHING PASSED (" + $rows.Count + " suites, " + $minutes + " min).") -ForegroundColor Green }
else { Write-Host ($failedCount.ToString() + " suite(s) FAILED (" + $minutes + " min). Send me the red lines.") -ForegroundColor Red; exit 1 }
Write-Host "Logins from this computer may be rate-limited for about a minute." -ForegroundColor Gray