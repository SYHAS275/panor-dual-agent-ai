@echo off
title PANOR.AI - Local Stream Server
color 0A

echo.
echo  ========================================
echo       PANOR.AI Local Stream Server
echo  ========================================
echo.

:: Check and install dependencies
echo Checking dependencies...
pip install flask flask-cors opencv-python -q 2>nul
echo Done!
echo.

:: Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do set LOCAL_IP=%%b
)

echo  ----------------------------------------
echo   ACCESS URLS:
echo  ----------------------------------------
echo.
echo   Local:    http://localhost:8080/video
echo   Network:  http://%LOCAL_IP%:8080/video
echo.
echo  ----------------------------------------
echo.
echo  Devices on the SAME WiFi can connect
echo  using the Network URL above.
echo.
echo  For PUBLIC access (any network), run:
echo  stream_public.bat
echo.
echo  Press Ctrl+C to stop the stream.
echo  ----------------------------------------
echo.

cd /d "%~dp0stream"
python stream.py
pause
