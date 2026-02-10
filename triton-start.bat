@echo off
echo ========================================
echo   PANOR.AI - Triton Inference Server
echo ========================================
echo.

echo Checking for NVIDIA GPU...
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo ERROR: NVIDIA GPU not found or drivers not installed.
    echo Triton requires an NVIDIA GPU with CUDA support.
    echo.
    pause
    exit /b 1
)

echo NVIDIA GPU found!
echo.

echo Starting Triton + PANOR.AI with Docker Compose...
docker-compose -f docker-compose.triton.yml up --build -d

echo.
echo Waiting for Triton to be ready...
:wait_loop
timeout /t 5 /nobreak >nul
curl -s http://localhost:8000/v2/health/ready >nul 2>&1
if errorlevel 1 (
    echo Still starting...
    goto wait_loop
)

echo.
echo ========================================
echo   Triton is ready!
echo ========================================
echo.
echo   Triton HTTP:    http://localhost:8000
echo   Triton gRPC:    http://localhost:8001
echo   Triton Metrics: http://localhost:8002
echo   PANOR.AI App:   http://localhost:3000
echo.
echo   Check Triton models:
echo   curl http://localhost:8000/v2/models
echo.
echo   Stop with: docker-compose -f docker-compose.triton.yml down
echo ========================================
echo.

start http://localhost:3000
pause
