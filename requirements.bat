@echo off
title PANOR.AI - Install Requirements
color 0B

echo.
echo  ================================================
echo       PANOR.AI - Installing All Requirements
echo  ================================================
echo.

:: Check if Node.js is installed
echo [1/5] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo      [ERROR] Node.js is not installed!
    echo      Please download and install from: https://nodejs.org/
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node -v') do echo      Node.js version: %%i
)
echo.

:: Check if Python is installed
echo [2/5] Checking Python...
where python >nul 2>nul
if errorlevel 1 (
    echo      [ERROR] Python is not installed!
    echo      Please download and install from: https://python.org/
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('python --version') do echo      %%i
)
echo.

:: Install Node.js dependencies
echo [3/5] Installing Node.js dependencies...
echo      This may take a few minutes...
call npm install
if errorlevel 1 (
    echo      [ERROR] Failed to install Node.js dependencies
    pause
    exit /b 1
)
echo      Done!
echo.

:: Install Python dependencies for streaming
echo [4/5] Installing Python dependencies for streaming...
pip install flask flask-cors opencv-python -q
if errorlevel 1 (
    echo      [WARNING] Some Python packages may have failed to install
) else (
    echo      Done!
)
echo.

:: Check for ngrok (optional)
echo [5/5] Checking ngrok (optional - for public streaming)...
where ngrok >nul 2>nul
if errorlevel 1 (
    echo      [INFO] ngrok is not installed (optional)
    echo      To enable public streaming, install ngrok:
    echo        - Download from: https://ngrok.com/download
    echo        - Or run: choco install ngrok
) else (
    echo      ngrok is installed!
)
echo.

echo  ================================================
echo       All Requirements Installed Successfully!
echo  ================================================
echo.
echo  Installed packages:
echo    - Node.js dependencies (Next.js, React, etc.)
echo    - Python: flask, flask-cors, opencv-python
echo.
echo  To start the application:
echo    1. Run: npm run dev       (starts website)
echo    2. Run: start_stream.bat  (starts webcam stream)
echo.
echo  Or use: start_all.bat to start everything at once
echo.
echo  ================================================
echo.
pause
