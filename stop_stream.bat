@echo off
title PANOR.AI - Stop Streams
color 0C

echo.
echo  ========================================
echo       PANOR.AI - Stopping Streams
echo  ========================================
echo.

:: Stop Python (Flask stream server)
echo [1/3] Stopping Flask stream server...
taskkill /F /IM python.exe 2>nul
if errorlevel 1 (
    echo      No Flask server running.
) else (
    echo      Flask server stopped.
)

:: Stop ngrok
echo [2/3] Stopping ngrok tunnels...
taskkill /F /IM ngrok.exe 2>nul
if errorlevel 1 (
    echo      No ngrok tunnels running.
) else (
    echo      ngrok stopped.
)

:: Stop Node.js (Next.js dev server)
echo [3/3] Stopping Next.js dev server...
taskkill /F /IM node.exe 2>nul
if errorlevel 1 (
    echo      No Next.js server running.
) else (
    echo      Next.js server stopped.
)

echo.
echo  ========================================
echo      All streams stopped successfully!
echo  ========================================
echo.
pause
