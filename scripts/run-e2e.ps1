$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$vite = Join-Path $root "node_modules\vite\bin\vite.js"
$playwright = Join-Path $root "node_modules\.bin\playwright.cmd"
$server = $null
$previousViteE2e = $env:VITE_E2E

try {
  $env:VITE_E2E = "1"
  $server = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList @($vite, "--host", "0.0.0.0", "--port", "3000", "--strictPort") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/app.html" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    throw "Timed out waiting for http://127.0.0.1:3000/app.html"
  }

  & $playwright test @args
  exit $LASTEXITCODE
} finally {
  $env:VITE_E2E = $previousViteE2e
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
