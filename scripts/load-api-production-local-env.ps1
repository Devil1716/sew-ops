param(
  [string]$Path = "apps/api/.env.production.local"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root $Path
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  throw "Missing $envPath. Copy apps/api/env.production.local.example and fill in local values first."
}

foreach ($line in Get-Content -LiteralPath $envPath) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
  if ($trimmed -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    throw "Invalid environment line in $envPath. Expected KEY=VALUE."
  }
  $name = $Matches[1]
  $value = $Matches[2].Trim()
  if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

if ($env:NODE_ENV -ne 'production') {
  throw "The local production env file must keep NODE_ENV=production."
}
