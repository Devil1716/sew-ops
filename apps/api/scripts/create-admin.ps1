$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "=== Sew Ops first-time setup ===" -ForegroundColor Cyan
$env:FACTORY_NAME = Read-Host "Factory name"
$env:FACTORY_CODE = Read-Host "Factory code (letters/numbers, e.g. MAIN)"
$env:ADMIN_NAME   = Read-Host "Your full name"
$env:ADMIN_EMAIL  = Read-Host "Your email (you will log in with this)"
$p1 = Read-Host "Password (min 12 characters)" -AsSecureString
$p2 = Read-Host "Repeat password" -AsSecureString

function Plain($s) {
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

$a = Plain $p1
$b = Plain $p2
if ($a -ne $b) {
  Write-Host "Passwords do not match. Run the command again." -ForegroundColor Red
  exit 1
}

$env:ADMIN_PASSWORD = $a
Set-Location (Resolve-Path "$PSScriptRoot/../../..")
npm run create-admin -w @sew-ops/api