@echo off
echo ========================================
echo   PANOR.AI - Kubernetes Start
echo ========================================
echo.

:: Check if kubectl is available
kubectl version --client >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] kubectl not found. Make sure Docker Desktop is running with Kubernetes enabled.
    pause
    exit /b 1
)

:: Check if pod is already running
echo [1/4] Checking if PANOR.AI is already running...
kubectl get pods -n panorai 2>nul | findstr "Running" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PANOR.AI is already running!
    echo.
    kubectl get pods -n panorai
    echo.
    echo Open http://localhost in your browser.
    pause
    exit /b 0
)

:: Deploy
echo [2/4] Creating namespace and secrets...
kubectl apply -f "k8s/namespace.yaml"
kubectl apply -f "k8s/secret.yaml"

echo [3/4] Deploying application...
kubectl apply -f "k8s/deployment.yaml"
kubectl apply -f "k8s/service.yaml"

echo [4/4] Waiting for pod to be ready...
kubectl wait --for=condition=ready pod -l app=panorai -n panorai --timeout=120s

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   PANOR.AI is running!
    echo   Open: http://localhost
    echo ========================================
) else (
    echo.
    echo [ERROR] Pod did not become ready. Check logs:
    echo   kubectl logs -n panorai -l app=panorai
)

echo.
pause
