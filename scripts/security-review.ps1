$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$script:ok = 0; $script:fix = 0; $script:todo = 0
function Ok($m)   { Write-Host ("  [OK]   " + $m) -ForegroundColor Green; $script:ok++ }
function Fix($m)  { Write-Host ("  [FIX]  " + $m) -ForegroundColor Red; $script:fix++ }
function Todo($m) { Write-Host ("  [TODO] " + $m) -ForegroundColor Yellow; $script:todo++ }
function EnvValue($file, $key) {
  $p = Join-Path $root $file
  if (-not (Test-Path $p)) { return $null }
  foreach ($line in Get-Content $p) {
    if ($line -match '^\s*#') { continue }
    if ($line -match ('^\s*' + [regex]::Escape($key) + '\s*=\s*(.*)$')) { return $Matches[1].Trim().Trim('"').Trim("'") }
  }
  return $null
}

Write-Host "`n1. Secrets and git" -ForegroundColor Cyan
$tracked = @(git ls-files | Where-Object { $_ -match '(^|/)\.env(\.[A-Za-z]+)?$' -and $_ -notmatch '\.example$' })
if ($tracked.Count -eq 0) { Ok ".env files are not tracked by git" } else { Fix ("tracked by git: " + ($tracked -join ", ")) }
$everCommitted = @(git log --all --oneline -- "apps/api/.env" "apps/web/.env.local" ".env" 2>$null)
if ($everCommitted.Count -eq 0) { Ok "no .env file was ever committed (history is clean)" } else { Fix "a .env file is in git history: tell me, the secrets must be replaced" }
$leak = @(git grep -l -I -E "(JWT_[A-Z_]*SECRET|POSTGRES_PASSWORD)\s*=\s*[A-Za-z0-9+/=_-]{16,}" -- . ":(exclude)*.example" 2>$null)
if ($leak.Count -eq 0) { Ok "no secret values written into tracked files" } else { Fix ("secret-looking values in: " + ($leak -join ", ")) }
git check-ignore -q backups/x.dump
if ($LASTEXITCODE -eq 0) { Ok "database backups are ignored by git" } else { Fix "backups/ is not in .gitignore" }

Write-Host "`n2. Settings for going live" -ForegroundColor Cyan
$secret = EnvValue "apps/api/.env" "JWT_ACCESS_SECRET"
if ($secret -and $secret.Length -ge 32) { Ok ("login secret is long enough (" + $secret.Length + " characters)") } else { Fix "JWT_ACCESS_SECRET is missing or shorter than 32 characters" }
$cors = EnvValue "apps/api/.env" "CORS_ORIGIN"
if ($cors -and $cors.StartsWith("https://")) { Ok "CORS_ORIGIN uses https" } else { Todo ("CORS_ORIGIN is '" + $cors + "' (fine now; must be your https website address at deployment)") }
$nodeEnv = EnvValue "apps/api/.env" "NODE_ENV"
if ($nodeEnv -eq "production") { Ok "NODE_ENV is production" } else { Todo "NODE_ENV is not 'production' here (the host sets it at deployment)" }
$fixtures = EnvValue "apps/web/.env.local" "NEXT_PUBLIC_USE_FIXTURES"
if ($fixtures -eq "true") { Todo "NEXT_PUBLIC_USE_FIXTURES=true (demo data switch: must be false in production)" } else { Ok "demo-data switch is off" }
$apiBase = EnvValue "apps/web/.env.local" "NEXT_PUBLIC_API_BASE_URL"
if ($apiBase -and $apiBase.StartsWith("https://")) { Ok "the website talks to the API over https" } else { Todo ("NEXT_PUBLIC_API_BASE_URL is '" + $apiBase + "' (must be https at deployment)") }

Write-Host "`n3. Known vulnerabilities in the libraries we ship" -ForegroundColor Cyan
$v = $null
try { $raw = npm audit --omit=dev --json 2>$null; $v = (($raw -join "`n") | ConvertFrom-Json).metadata.vulnerabilities } catch { }
if (-not $v) { Todo "could not run npm audit (offline?). Try later: npm audit --omit=dev" }
else {
  Write-Host ("  critical {0}, high {1}, moderate {2}, low {3}" -f $v.critical, $v.high, $v.moderate, $v.low) -ForegroundColor Gray
  if ($v.critical -gt 0) { Fix "critical vulnerabilities: run npm audit --omit=dev and send me the output" } else { Ok "no critical vulnerabilities" }
  if ($v.high -gt 0) { Todo "high vulnerabilities: run npm audit --omit=dev and send me the output" } else { Ok "no high vulnerabilities" }
}

Write-Host "`n4. Live probes against the running API" -ForegroundColor Cyan
$healthy = $false
try { $h = Invoke-RestMethod http://localhost:4000/health -TimeoutSec 5; $healthy = ($h.status -eq "ok") } catch { }
if (-not $healthy) { Todo "API not running: start it with .\scripts\start-dev.ps1 and run this again" }
else {
  $sec = Read-Host "Admin password" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $env:ADMIN_EMAIL = "dhanushrpoojari0@gmail.com"
  $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  try { node apps/api/scripts/verify-security.mjs; if ($LASTEXITCODE -eq 0) { $script:ok++ } else { $script:fix++ } }
  finally { Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue }
}

Write-Host "`n=== RESULT ===" -ForegroundColor Cyan
Write-Host ("OK: " + $ok + "   FIX: " + $fix + "   TODO before deployment: " + $todo)
if ($fix -eq 0) { Write-Host "Nothing needs fixing now. TODO items are deployment settings, not bugs." -ForegroundColor Green }
else { Write-Host "Send me the [FIX] and FAIL lines above." -ForegroundColor Red }