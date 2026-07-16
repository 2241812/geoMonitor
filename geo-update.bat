@echo off
title GeoMonitor Update
cd /d "%~dp0"

if "%~1"=="" (
    echo ========================================
    echo    GeoMonitor - GeoJSON Update Tool
    echo ========================================
    echo.
    echo  Drag a .geojson / .topojson / .json file
    echo  onto this script to update the app.
    echo.
    echo  Requires Node.js installed and in PATH.
    echo.
    pause
    exit /b 1
)

echo ========================================
echo    GeoMonitor - GeoJSON Update Tool
echo ========================================
echo.

:process
if "%~1"=="" goto :done
echo --- Processing: %~nx1 ---
echo.
node "scripts\update-deploy.mjs" "%~1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo   FAILED (exit code %ERRORLEVEL%)
)
echo.
shift
goto :process

:done
echo ========================================
echo   Done! Check the output above.
echo ========================================
echo.
pause
