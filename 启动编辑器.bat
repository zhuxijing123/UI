@echo off
setlocal

cd /d "%~dp0"

set "HOST=127.0.0.1"
set "PORT=5173"
set "URL=http://%HOST%:%PORT%"
set "READY_FLAG=%TEMP%\brm-ui-studio-ready-%PORT%.flag"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm was not found in PATH.
  echo [INFO] Install Node.js and pnpm first, then run this script again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing editor dependencies...
  call pnpm install
  if errorlevel 1 (
    echo [ERROR] pnpm install failed.
    pause
    exit /b 1
  )
)

del "%READY_FLAG%" >nul 2>nul

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference='SilentlyContinue';" ^
  "try {" ^
  "  $response = Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2;" ^
  "  if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 }" ^
  "} catch { exit 1 }"

if not errorlevel 1 (
  echo [INFO] Editor is already running at %URL%
  start "" "%URL%"
  exit /b 0
)

echo [INFO] Starting BRM UI Studio dev server on %URL%
start "BRM UI Studio" cmd /k "cd /d ""%~dp0"" && pnpm dev --host %HOST% --port %PORT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference='SilentlyContinue';" ^
  "$deadline = (Get-Date).AddSeconds(45);" ^
  "do {" ^
  "  try {" ^
  "    $response = Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2;" ^
  "    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {" ^
  "      Set-Content -Path '%READY_FLAG%' -Value 'ready' -Encoding ascii;" ^
  "      exit 0" ^
  "    }" ^
  "  } catch {}" ^
  "  Start-Sleep -Milliseconds 500" ^
  "} while ((Get-Date) -lt $deadline);" ^
  "exit 1"

if exist "%READY_FLAG%" (
  del "%READY_FLAG%" >nul 2>nul
  echo [INFO] Opening editor page: %URL%
  start "" "%URL%"
  exit /b 0
)

echo [WARN] The editor page did not become ready within 45 seconds.
echo [INFO] Open %URL% manually after the dev server finishes booting.
pause
exit /b 1
