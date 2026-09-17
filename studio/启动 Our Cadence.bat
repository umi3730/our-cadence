@echo off
setlocal
cd /d "%~dp0"
title Our Cadence - Local Studio

where node >nul 2>nul
if errorlevel 1 (
  echo [Our Cadence] Node.js not found.
  echo Please install Node.js 22 or newer, then run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [Our Cadence] Node %NODE_VERSION%

if not exist "node_modules\next\package.json" (
  echo [Our Cadence] First run: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Check your network and run this BAT again.
    pause
    exit /b 1
  )
)

echo [Our Cadence] Starting http://localhost:3000/studio
start "Our Cadence Browser" powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:3000/studio'; for($i=0;$i -lt 30;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 $u;if($r.StatusCode -ge 200){Start-Process $u;break}}catch{};Start-Sleep -Milliseconds 700}"
call npm run dev

pause
endlocal
