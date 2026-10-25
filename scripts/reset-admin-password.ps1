# Emergency use: you forgot the admin password. Needs access to this computer and the database container.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker is not running. Open Docker Desktop first." -ForegroundColor Red; exit 1 }
if (-not (docker ps --filter "name=sewops-db" -q)) { Write-Host "The database container is not running. Run .\scripts\start-dev.ps1 first." -ForegroundColor Red; exit 1 }

$email = (Read-Host "Admin email to reset").Trim().ToLower()
if ($email -notmatch "^[^@\s']+@[^@\s']+\.[^@\s']+$") { Write-Host "That does not look like an email address." -ForegroundColor Red; exit 1 }
$p1 = Read-Host "New password (12+ characters)" -AsSecureString
$p2 = Read-Host "Type it again" -AsSecureString
$a = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
$b = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
if ($a -ne $b) { Write-Host "The two passwords do not match." -ForegroundColor Red; exit 1 }
if ($a.Length -lt 12) { Write-Host "Use at least 12 characters." -ForegroundColor Red; exit 1 }

# hash it with the same library the API uses
$env:NEW_ADMIN_PASSWORD = $a
Push-Location (Join-Path $root "apps/api")
$hash = node -e "const { hash } = require('@node-rs/argon2'); hash(process.env.NEW_ADMIN_PASSWORD).then(h => process.stdout.write(h))"
Pop-Location
Remove-Item Env:NEW_ADMIN_PASSWORD -ErrorAction SilentlyContinue
if (-not $hash -or -not $hash.StartsWith('$argon2')) { Write-Host "Could not create the password hash." -ForegroundColor Red; exit 1 }

$col = ("" + (docker exec sewops-db psql -U sewops -d sewops -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name ILIKE '%password%hash%' LIMIT 1;")).Trim()
if (-not $col) { Write-Host "Could not find the password column. Tell me." -ForegroundColor Red; exit 1 }

$sql = "UPDATE users SET $col = '$hash', failed_login_count = 0, locked_until = NULL WHERE role = 'admin' AND lower(email) = '$email' RETURNING id;"
$userId = ("" + ($sql | docker exec -i sewops-db psql -U sewops -d sewops -t -A)).Trim() -replace "UPDATE \d+", ""
$userId = $userId.Trim()
if (-not $userId) { Write-Host "No admin account has that email. Nothing was changed." -ForegroundColor Red; exit 1 }
Write-Host "Password changed." -ForegroundColor Green

# sign out every existing session of that admin
$table = ("" + (docker exec sewops-db psql -U sewops -d sewops -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('auth_sessions','sessions') ORDER BY table_name LIMIT 1;")).Trim()
if ($table) {
  $null = "UPDATE $table SET revoked_at = now() WHERE user_id = '$userId' AND revoked_at IS NULL;" | docker exec -i sewops-db psql -U sewops -d sewops 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Host "Old sessions signed out." -ForegroundColor Green } else { Write-Host "Could not sign out old sessions; they expire on their own within 15 minutes." -ForegroundColor Yellow }
}

# prove the new password works (if the API is running)
try {
  $body = @{ email = $email; password = $a } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "http://localhost:4000/v1/auth/login" -Method Post -ContentType "application/json" -Body $body -UseBasicParsing
  Write-Host ("Login check: OK (HTTP " + $r.StatusCode + "). The new password works.") -ForegroundColor Green
} catch { Write-Host "Could not confirm by logging in (is the API running?). Try signing in on the website." -ForegroundColor Yellow }
$a = $null; $b = $null
Write-Host "Note: this emergency tool is not written to the audit log. Note down that you used it." -ForegroundColor Gray