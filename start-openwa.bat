@echo off
title OpenWA WhatsApp Gateway (:2785)
cd /d "%~dp0openwa"

rem Prefer the portable Node in %USERPROFILE%\tools, otherwise use node from PATH
for /d %%D in ("%USERPROFILE%\tools\node-v*-win-x64") do set "PATH=%%~fD;%PATH%"
if exist "%USERPROFILE%\tools\node\node.exe" set "PATH=%USERPROFILE%\tools\node;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20+ or place it in %USERPROFILE%\tools.
  pause
  exit /b 1
)

if not exist "dist\main.js" (
  echo OpenWA is not installed in "%~dp0openwa" ^(dist\main.js is missing^).
  echo Install and build OpenWA into that folder, then run this script again.
  pause
  exit /b 1
)

echo Starting OpenWA Gateway on http://localhost:2785 ...
node dist/main.js
pause
