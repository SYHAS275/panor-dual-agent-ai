@echo off
title PANOR.AI - Stop Server
echo.
echo  ========================================
echo   PANOR.AI - Stopping Development Server
echo  ========================================
echo.

REM Find and kill process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo  Stopping process with PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

REM Also kill any remaining node processes related to Next.js
taskkill /F /IM node.exe /FI "WINDOWTITLE eq PANOR.AI*" >nul 2>&1

echo.
echo  Server stopped successfully!
echo.
pause
