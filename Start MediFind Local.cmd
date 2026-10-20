@echo off
set "ROOT=%~dp0"
if not exist "%ROOT%backend\.venv\Scripts\python.exe" (
  echo Backend environment is missing. Set up backend\requirements.txt first.
  pause
  exit /b 1
)
if not exist "%ROOT%frontend\node_modules" (
  echo Frontend dependencies are missing. Run npm ci in frontend first.
  pause
  exit /b 1
)
start "MediFind API" /D "%ROOT%backend" "%ROOT%backend\.venv\Scripts\python.exe" manage.py runserver 0.0.0.0:8000
start "MediFind Mobile and Web" /D "%ROOT%frontend" "%ComSpec%" /k npm start -- --lan --port 8081
echo Started the MediFind API and Expo. Scan Expo's QR code with Expo Go on a phone on the same Wi-Fi.
