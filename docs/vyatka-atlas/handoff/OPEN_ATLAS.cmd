@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "site\index.html" (
  echo ERROR: site\index.html is missing
  exit /b 1
)
start "" "%~dp0site\index.html"
exit /b 0
