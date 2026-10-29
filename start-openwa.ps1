# Launch OpenWA WhatsApp Gateway
# Prefer the portable Node in $env:USERPROFILE\tools, otherwise use node from PATH
$portable = Get-ChildItem -Path "$env:USERPROFILE\tools" -Directory -Filter "node-v*-win-x64" -ErrorAction SilentlyContinue | Select-Object -Last 1
if ($portable) { $env:Path = "$($portable.FullName);" + $env:Path }
elseif (Test-Path "$env:USERPROFILE\tools\node\node.exe") { $env:Path = "$env:USERPROFILE\tools\node;" + $env:Path }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js was not found. Install Node.js 20+ or place it in $env:USERPROFILE\tools." -ForegroundColor Red
    exit 1
}

Set-Location -Path "$PSScriptRoot\openwa"
if (-not (Test-Path "dist\main.js")) {
    Write-Host "OpenWA is not installed in $PSScriptRoot\openwa (dist\main.js is missing)." -ForegroundColor Red
    Write-Host "Install and build OpenWA into that folder, then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting OpenWA Gateway on http://localhost:2785 ..." -ForegroundColor Green
node dist/main.js
