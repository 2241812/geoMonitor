@echo off
title GeoMonitor - Deploy Tool
cd /d "%~dp0"

if "%~1"=="--watch" goto :watcher
if "%~1"=="--help" goto :help
if "%~1"=="--gui" goto :gui

:: Default: Full deploy cycle (pull, build, upload via FTP)
cls
echo ========================================
echo    GeoMonitor - Full Deploy
echo ========================================
echo.

echo [1/4] Pulling latest from git...
git pull origin main
if errorlevel 1 echo   WARNING: git pull had issues (non-fatal)& echo.

echo [2/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo   FAILED: npm install
    pause
    exit /b 1
)
echo.

echo [3/4] Building...
call npm run build
if errorlevel 1 (
    echo   FAILED: build
    pause
    exit /b 1
)
echo.

echo [4/4] Deploying via FTP...
node scripts/deploy-ftp.mjs --skip-build
if errorlevel 1 (
    echo   FAILED: FTP deploy
    pause
    exit /b 1
)
echo.
echo ========================================
echo   Deploy complete
echo ========================================
pause
exit /b 0

:gui
echo ========================================
echo    GeoMonitor - GUI Mode
echo ========================================
echo.
start http://localhost:3479
node deploy-gui/server.mjs
pause
exit /b 0

:watcher
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
node scripts/update-deploy.mjs --watch
pause
exit /b 0

:help
echo.
echo GeoMonitor Deploy Tool
echo ======================
echo.
echo Usage:  geo-update.bat [option]
echo.
echo Options:
echo   (no args)    Full deploy: git pull ^> npm install ^> build ^> FTP upload
echo   --gui        Open the graphical deploy GUI (browser)
echo   --watch      Watcher mode: process GeoJSON files dropped in gis-drop/
echo   --help       Show this help
echo.
pause
exit /b 0
