# ==============================================================================
# Launch DRCH Platform Locally (Backend on :8000 + Frontend on :3000)
# ==============================================================================

Write-Host "Starting Disaster Response Coordination Hub (DRCH)..." -ForegroundColor Cyan

# 1. Start Backend FastAPI Server (port 8000)
Write-Host "Launching Backend on http://localhost:8000 ..." -ForegroundColor Yellow
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; .\.venv\Scripts\python main.py" -PassThru

# 2. Start Frontend Next.js Server (port 3000)
Write-Host "Launching Frontend on http://localhost:3000 ..." -ForegroundColor Yellow
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -PassThru

# Give servers 3-4 seconds to spin up
Start-Sleep -Seconds 4

# 3. Open browser
Write-Host "Opening DRCH Tactical Map in browser..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host "Both servers are running in separate terminal windows." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "Swagger Docs: http://localhost:8000/docs" -ForegroundColor White

