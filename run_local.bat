@echo off
cd /d "%~dp0"
title DRCH Platform Launcher
echo ==============================================================================
echo Starting Disaster Response Coordination Hub (DRCH)...
echo ==============================================================================

echo [1/2] Launching Backend on http://localhost:8000 ...
start "DRCH Backend (:8000)" cmd /k "cd /d ""%~dp0"" && .\.venv\Scripts\python main.py"

echo [2/2] Launching Frontend on http://localhost:3000 ...
start "DRCH Frontend (:3000)" cmd /k "cd /d ""%~dp0\frontend"" && npm run dev"

echo Waiting 4 seconds for servers to initialize...
timeout /t 4 /nobreak >nul

echo Opening http://localhost:3000 in your browser...
start http://localhost:3000

echo.
echo ==============================================================================
echo DRCH Platform is now running!
echo - Public Tactical Map: http://localhost:3000
echo - Citizen Reporting:    http://localhost:3000/citizen/dashboard
echo - Staff / DM Login:    http://localhost:3000/login
echo - Backend API Docs:    http://localhost:8000/docs
echo ==============================================================================
pause
