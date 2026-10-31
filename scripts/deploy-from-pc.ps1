# Deploy WITHOUT GitHub: uploads your COMMITTED code, builds on the server, deploys with a health check and automatic rollback.
#   .\scripts\deploy-from-pc.ps1 -Server 203.0.113.10
#   .\scripts\deploy-from-pc.ps1 -Server 203.0.113.10 -Follow <release>     (re-attach after a dropped connection)
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$User = "deploy",
  [string]$Key = (Join-Path $env:USERPROFILE ".ssh\sewops_deploy"),
  [string]$Follow = ""
)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path $Key)) { Write-Host ("SSH key not found: " + $Key) -ForegroundColor Red; return }
$sshOpts = @("-i", $Key, "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=8", "-o", "ConnectTimeout=20")
$target = $User + "@" + $Server
function Remote([string]$cmd) { & ssh @sshOpts $target $cmd }

$null = Remote "echo connected"
if ($LASTEXITCODE -ne 0) { Write-Host ("Cannot connect to " + $target + ". Check the IP, the key, and that the server is on.") -ForegroundColor Red; return }

$tag = $Follow
if (-not $tag) {
  $dirty = git status --porcelain
  if ($dirty) { Write-Host "Note: uncommitted changes are NOT deployed (only what you committed):" -ForegroundColor Yellow; $dirty }
  $sha = (git rev-parse --short=12 HEAD).Trim()
  $tag = $sha + "-" + (Get-Date -Format "MMddHHmm")
  $tar = Join-Path $env:TEMP ("sewops-" + $tag + ".tar.gz")
  Write-Host ("Packing the committed code (" + $sha + ")...") -ForegroundColor Cyan
  git archive --format=tar.gz -o $tar HEAD
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tar)) { Write-Host "git archive failed." -ForegroundColor Red; return }
  Write-Host ("Uploading {0:N1} MB..." -f ((Get-Item $tar).Length / 1MB)) -ForegroundColor Cyan
  $uploaded = $false
  for ($i = 1; $i -le 4 -and -not $uploaded; $i++) {
    & scp @sshOpts $tar ($target + ":/opt/sewops/incoming-" + $tag + ".tar.gz")
    if ($LASTEXITCODE -eq 0) { $uploaded = $true } else { Write-Host "upload failed, retrying..." -ForegroundColor Yellow; Start-Sleep -Seconds 5 }
  }
  Remove-Item $tar -ErrorAction SilentlyContinue
  if (-not $uploaded) { Write-Host "The upload failed 4 times: check your internet connection and run this again." -ForegroundColor Red; return }

  Remote ("mkdir -p /opt/sewops/src/${tag} && tar -xzf /opt/sewops/incoming-${tag}.tar.gz -C /opt/sewops/src/${tag} && rm -f /opt/sewops/incoming-${tag}.tar.gz && echo RUNNING > /opt/sewops/src/${tag}/STATUS && chmod +x /opt/sewops/src/${tag}/deploy/*.sh")
  if ($LASTEXITCODE -ne 0) { Write-Host "Could not unpack the code on the server (was server-setup run?)." -ForegroundColor Red; return }
  Remote ("cd /opt/sewops/src/${tag} && (nohup setsid bash deploy/remote-build.sh ${tag} > /dev/null 2>&1 < /dev/null &)")
  Write-Host ("Build started on the server (release " + $tag + ").") -ForegroundColor Green
  Write-Host ("If your connection drops the build keeps going. Re-attach with: .\scripts\deploy-from-pc.ps1 -Server " + $Server + " -Follow " + $tag) -ForegroundColor Gray
}

Write-Host "Following the build (the first one takes 8 to 20 minutes)..." -ForegroundColor Cyan
$seen = 0
$status = ""
$deadline = (Get-Date).AddMinutes(60)
while ((Get-Date) -lt $deadline) {
  $out = Remote ("tail -n +" + ($seen + 1) + " /opt/sewops/src/${tag}/build.log 2>/dev/null; echo '@@STATUS'; cat /opt/sewops/src/${tag}/STATUS 2>/dev/null")
  if ($LASTEXITCODE -ne 0) { Write-Host "(connection hiccup, retrying...)" -ForegroundColor Yellow; Start-Sleep -Seconds 10; continue }
  $lines = @($out)
  $idx = [array]::IndexOf($lines, '@@STATUS')
  if ($idx -lt 0) { Start-Sleep -Seconds 8; continue }
  if ($idx -gt 0) { $lines[0..($idx - 1)] | ForEach-Object { Write-Host $_ }; $seen += $idx }
  if ($lines.Count -gt ($idx + 1)) { $status = ("" + $lines[$idx + 1]).Trim() }
  if ($status -eq "OK" -or $status -eq "FAILED") { break }
  Start-Sleep -Seconds 8
}

Write-Host ""
if ($status -eq "OK") {
  Write-Host "DEPLOY OK" -ForegroundColor Green
  $origin = (("" + (Remote "grep '^PUBLIC_ORIGIN=' /opt/sewops/.env")).Trim()) -replace "^PUBLIC_ORIGIN=", ""
  if ($origin) {
    $code = ("" + (curl.exe -s -o NUL -w "%{http_code}" ($origin + "/health"))).Trim()
    if ($code -eq "200") { Write-Host ("Public check: " + $origin + "/health answered 200 (live, valid certificate)") -ForegroundColor Green }
    else { Write-Host ("Public check: " + $origin + "/health answered " + $code + ". DNS or the certificate may still be settling: try again in a few minutes.") -ForegroundColor Yellow }
  }
} elseif ($status -eq "FAILED") {
  Write-Host "DEPLOY FAILED. The last lines of the server log:" -ForegroundColor Red
  Remote ("tail -n 60 /opt/sewops/src/${tag}/build.log")
  Write-Host "(If the log says 'rolling back', the previous version is running again.) Paste me the lines above." -ForegroundColor Gray
} else {
  Write-Host ("Still running after 60 minutes. Re-attach later with: .\scripts\deploy-from-pc.ps1 -Server " + $Server + " -Follow " + $tag) -ForegroundColor Yellow
}