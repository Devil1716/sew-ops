# Optional: a nightly backup at 02:00 on this computer (Docker Desktop must be running then).
param([switch]$Remove)
$name = "SewOps nightly backup"
if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Nightly backup removed." -ForegroundColor Yellow
  return
}
$script = Join-Path $PSScriptRoot "backup-db.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"" + $script + "`"")
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description "Sew Ops database backup" -Force | Out-Null
Write-Host "Scheduled: every day at 02:00 (or at the next start if the computer was off). Remove with: .\scripts\schedule-backup.ps1 -Remove" -ForegroundColor Green