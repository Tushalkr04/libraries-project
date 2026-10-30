$ErrorActionPreference = "Stop"

$projectDirectory = $PSScriptRoot
$appUrl = "http://localhost:3000"
$ready = $false

try {
  try {
    $null = Invoke-RestMethod "$appUrl/api/summary" -TimeoutSec 2
    $ready = $true
  } catch {
    $null = Start-Process `
      -FilePath $env:ComSpec `
      -ArgumentList "/c", "npm start" `
      -WorkingDirectory $projectDirectory `
      -WindowStyle Minimized
  }

  if (-not $ready) {
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
      Start-Sleep -Seconds 1
      try {
        $null = Invoke-RestMethod "$appUrl/api/summary" -TimeoutSec 2
        $ready = $true
        break
      } catch {
        continue
      }
    }
  }

  if (-not $ready) {
    throw "Libraries did not start. Check that Oracle XE is running, then try again."
  }

  Start-Process $appUrl
} catch {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    $_.Exception.Message,
    "Libraries could not start",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}
