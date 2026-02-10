@echo off
title PANOR.AI - Development Server
echo.
echo  ========================================
echo   PANOR.AI - Starting Development Server
echo  ========================================
echo.
echo  Server will be available at: http://localhost:3000
echo  Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
npm run dev
pause
