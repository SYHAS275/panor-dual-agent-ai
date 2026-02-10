@echo off
title PANOR.AI - Start All Services
color 0B

echo.
echo  ========================================
echo       PANOR.AI - Starting All Services
echo  ========================================
echo.

:: Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do set LOCAL_IP=%%b
)

:: Install dependencies
echo [1/4] Checking dependencies...
pip install flask flask-cors opencv-python -q 2>nul
echo      Done!
echo.

:: Start Flask stream server
echo [2/4] Starting Flask webcam stream...
start "PANOR.AI Stream" cmd /c "cd /d "%~dp0stream" && python stream.py"
timeout /t 2 /nobreak >nul
echo      Stream running!
echo.

:: Start Next.js dev server
echo [3/4] Starting Next.js website...
start "PANOR.AI Website" cmd /c "cd /d "%~dp0" && npm run dev"
timeout /t 5 /nobreak >nul
echo      Website running!
echo.

:: Display URLs
echo [4/4] All services started!
echo.
echo  ========================================
echo      LOCAL ACCESS (Same WiFi)
echo  ========================================
echo.
echo   Website:  http://localhost:3000
echo             http://%LOCAL_IP%:3000
echo.
echo   Stream:   http://localhost:8080/video
echo             http://%LOCAL_IP%:8080/video
echo.
echo  ========================================
echo.
echo  To make accessible from ANY network,
echo  run: stream_public.bat
echo.
echo  To stop all services, run: stop_stream.bat
echo.
echo  ========================================
echo.
pause
