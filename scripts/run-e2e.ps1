$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$serverScript = Join-Path $root "node_modules\http-server\bin\http-server"
$playwright = Join-Path $root "node_modules\.bin\playwright.cmd"
$server = $null

try {
  $server = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList @($serverScript, "apps/web/out", "-a", "127.0.0.1", "-p", "4173", "-c-1") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    if ($server.HasExited) {
      throw "Static test server exited before becoming ready."
    }
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:4173/" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    throw "Timed out waiting for http://127.0.0.1:4173/"
  }

  & $playwright test @args
  exit $LASTEXITCODE
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
