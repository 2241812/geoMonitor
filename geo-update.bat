@echo off
title GeoMonitor Update
cd /d "%~dp0"

if "%~1"=="" (
    cls
    echo ========================================
    echo    GeoMonitor - Watcher Mode
    echo ========================================
    echo.
    echo  Drop .geojson / .topojson / .json files into:
    echo    %CD%\gis-drop\
    echo.
    echo  Press Ctrl+C to stop.
    echo ========================================
    echo.
    node scripts\update-deploy.mjs --watch
    exit /b 0
)

cls
echo ========================================
echo    GeoMonitor - Update Tool
echo ========================================
echo.

:process
if "%~1"=="" goto :done
echo --- Processing: %~nx1 ---
echo.
node scripts\update-deploy.mjs "%~1"
if %ERRORLEVEL% neq 0 echo   FAILED
echo.
shift
goto :process

:done
echo ========================================
echo   Done
echo ========================================
pause
