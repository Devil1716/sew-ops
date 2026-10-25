$ErrorActionPreference = "Stop"
$env:ADMIN_EMAIL = "dhanushrpoojari0@gmail.com"
$sec = Read-Host "Admin password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
try { node apps/api/scripts/verify-factory-day.mjs }
finally { Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue }