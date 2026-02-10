@echo off
echo ========================================
echo   PANOR.AI - Kubernetes Stop
echo ========================================
echo.

echo Stopping PANOR.AI...
kubectl delete namespace panorai

echo.
echo ========================================
echo   PANOR.AI stopped.
echo ========================================
echo.
pause
