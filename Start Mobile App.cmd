@echo off
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Run npm ci in the frontend folder first.
  pause
  exit /b 1
)
call npm start
pause
