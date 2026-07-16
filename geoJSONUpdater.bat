@echo off
title GeoMonitor - Deploy GUI
cd /d "%~dp0"

:: Kill any lingering server on port 3479
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3479" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a 2>nul >nul
)
timeout /t 1 /nobreak >nul

echo Starting GeoMonitor Deploy GUI...
echo.
node geoJSONUpdater/server.mjs
pause
