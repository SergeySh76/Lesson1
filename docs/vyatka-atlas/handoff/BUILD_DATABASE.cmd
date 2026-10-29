@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
echo [VYATKA ATLAS R11] Create SQLite / SQL / XML / GeoJSON / RETURN
where py >nul 2>nul
if not errorlevel 1 (
    py -3 BUILD_R11.py
) else (
    python BUILD_R11.py
)
set "STATUS=%ERRORLEVEL%"
if "%STATUS%"=="0" (
    echo [PASS] Outputs saved beside CMD: %~dp0
) else (
    echo [FAIL] Please read DIAGNOSTIC_R11.txt in %~dp0
)
exit /b %STATUS%
