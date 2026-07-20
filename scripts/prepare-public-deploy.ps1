$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$public = Join-Path $root "public"
$distIndex = Join-Path $dist "index.html"
$publicAssets = Join-Path $public "assets"
$sourceStyles = Join-Path $root "src\styles"
$publicStyles = Join-Path $public "styles"

if (-not (Test-Path $distIndex)) {
  throw "Missing Vite build output: $distIndex"
}

if (Test-Path $publicAssets) {
  Remove-Item -LiteralPath $publicAssets -Recurse -Force
}

Copy-Item -Path (Join-Path $dist "*") -Destination $public -Recurse -Force

if (Test-Path $publicStyles) {
  Remove-Item -LiteralPath $publicStyles -Recurse -Force
}

Copy-Item -LiteralPath $sourceStyles -Destination $publicStyles -Recurse -Force

$spaRoutes = @(
  "account",
  "home",
  "modules",
  "past-papers",
  "past-papers\exams",
  "past-papers\review",
  "past-papers\session",
  "quiz",
  "quizzes",
  "results",
  "settings",
  "setup",
  "subtopics",
  "types",
  "update-password",
  "year",
  "JAK2V617F",
  "JAK2V617F\access-control",
  "JAK2V617F\stats"
)

foreach ($route in $spaRoutes) {
  $routeDir = Join-Path $public $route
  New-Item -ItemType Directory -Force -Path $routeDir | Out-Null
  Copy-Item -LiteralPath $distIndex -Destination (Join-Path $routeDir "index.html") -Force
}

$redirects = @"
/admin/ / 302
/admin.html / 302
/app.html /home/ 302
/dashboard/ /home/ 302
/* /index.html 200
"@

Set-Content -LiteralPath (Join-Path $public "_redirects") -Value $redirects -Encoding utf8

function Write-RedirectHtml {
  param (
    [string] $Path,
    [string] $Target
  )

  $html = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=$Target" />
    <title>Bitramed Redirect</title>
    <script>
      window.location.replace("$Target");
    </script>
  </head>
  <body></body>
</html>
"@

  Set-Content -LiteralPath $Path -Value $html -Encoding utf8
}

Write-RedirectHtml -Path (Join-Path $public "admin.html") -Target "/"
Write-RedirectHtml -Path (Join-Path $public "app.html") -Target "/home/"

$adminDir = Join-Path $public "admin"
New-Item -ItemType Directory -Force -Path $adminDir | Out-Null
Write-RedirectHtml -Path (Join-Path $adminDir "index.html") -Target "/"

$dashboardDir = Join-Path $public "dashboard"
New-Item -ItemType Directory -Force -Path $dashboardDir | Out-Null
Write-RedirectHtml -Path (Join-Path $dashboardDir "index.html") -Target "/home/"
