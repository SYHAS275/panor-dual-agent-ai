@echo off
title PANOR.AI - Public Webcam Stream
color 0B

echo.
echo  ================================================
echo       PANOR.AI - Public Webcam Stream Server
echo  ================================================
echo.

:: Check and install dependencies
echo [1/4] Checking Python dependencies...
pip install flask flask-cors opencv-python -q 2>nul
echo      Done!
echo.

:: Check if ngrok is available
where ngrok >nul 2>nul
if errorlevel 1 (
    echo [ERROR] ngrok is not installed!
    echo.
    echo Please install ngrok:
    echo   1. Download from: https://ngrok.com/download
    echo   2. Or run: choco install ngrok
    echo.
    pause
    exit /b 1
)

:: Start Flask stream server in background
echo [2/4] Starting Flask webcam stream server...
start /B "" cmd /c "cd /d "%~dp0stream" && python stream.py" >nul 2>&1
timeout /t 3 /nobreak >nul
echo      Local stream: http://localhost:8080/video
echo.

:: Start ngrok in background and wait for it to initialize
echo [3/4] Creating public tunnel with ngrok...
start /B "" ngrok http 8080 --log=stdout >nul 2>&1
timeout /t 4 /nobreak >nul

:: Get the public URL from ngrok API
echo [4/4] Getting public URL...
echo.

for /f "tokens=*" %%i in ('curl -s http://127.0.0.1:4040/api/tunnels 2^>nul ^| findstr /C:"public_url"') do set NGROK_OUTPUT=%%i

:: Extract URL using PowerShell
for /f "delims=" %%a in ('powershell -Command "(Invoke-RestMethod http://127.0.0.1:4040/api/tunnels).tunnels[0].public_url" 2^>nul') do set PUBLIC_URL=%%a

if "%PUBLIC_URL%"=="" (
    echo  [!] Could not get public URL. Ngrok may still be starting...
    echo      Check http://127.0.0.1:4040 for the URL
    echo.
) else (
    echo  ================================================
    echo.
    echo     YOUR PUBLIC WEBCAM STREAM URL:
    echo.
    echo     %PUBLIC_URL%/video
    echo.
    echo  ================================================
    echo.
    echo  Share this URL with anyone to view your webcam!
    echo  Works on any device, any network, worldwide.
    echo.
)

echo  ------------------------------------------------
echo   Local URLs (same network only):
echo     http://localhost:8080/video
echo     http://192.168.0.220:8080/video
echo  ------------------------------------------------
echo.
echo  Press any key to stop the stream and exit...
echo.
pause >nul

:: Cleanup
echo.
echo Stopping services...
taskkill /F /IM ngrok.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
echo Done!
