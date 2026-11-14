# Starts or stops the project-local PostgreSQL instance (data in .pgdata, port 5433).
# It is separate from any PostgreSQL service installed on this machine.
#   powershell -File scripts/local-db.ps1 start
#   powershell -File scripts/local-db.ps1 stop
param([Parameter(Mandatory = $true)][ValidateSet("start", "stop", "status")][string]$Action)

$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root ".pgdata"
$bin = (Get-ChildItem "C:\Program Files\PostgreSQL" -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName + "\bin"

if (-not (Test-Path $data)) {
  Write-Error "No .pgdata folder. Create the instance once with: initdb -D .pgdata -U inspectflow -A trust -E UTF8"
  exit 1
}

switch ($Action) {
  "start"  { & "$bin\pg_ctl.exe" -D $data -o "-p 5433 -c listen_addresses=127.0.0.1" -l (Join-Path $data "server.log") start }
  "stop"   { & "$bin\pg_ctl.exe" -D $data stop }
  "status" { & "$bin\pg_ctl.exe" -D $data status }
}
