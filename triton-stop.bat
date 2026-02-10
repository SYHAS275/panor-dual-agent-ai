@echo off
echo ========================================
echo   PANOR.AI - Stopping Triton
echo ========================================
echo.

docker-compose -f docker-compose.triton.yml down

echo.
echo ========================================
echo   Triton stopped.
echo ========================================
echo.
pause
