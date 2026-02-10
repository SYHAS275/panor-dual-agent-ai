#!/bin/bash
# PANOR.AI Kubernetes Deployment Script
# Works with: Minikube (local), GKE, AKS, OKE

set -e

echo "=== PANOR.AI Kubernetes Deployment ==="
echo ""

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found. Install: https://kubernetes.io/docs/tasks/tools/"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker not found. Install: https://docs.docker.com/get-docker/"; exit 1; }

# Configuration
IMAGE_NAME="${DOCKER_IMAGE:-panorai}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${DOCKER_REGISTRY:-}"

# Build Docker image
echo "[1/5] Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# Tag and push if registry is set
if [ -n "$REGISTRY" ]; then
    echo "[2/5] Pushing to registry ${REGISTRY}..."
    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    # Update deployment to use registry image
    sed -i "s|image: panorai:latest|image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}|g" k8s/deployment.yaml
else
    echo "[2/5] No registry set, using local image (for Minikube: eval \$(minikube docker-env) first)"
fi

# Apply Kubernetes manifests
echo "[3/5] Creating namespace..."
kubectl apply -f k8s/namespace.yaml

echo "[4/5] Creating secrets (edit k8s/secret.yaml with your API keys first!)..."
kubectl apply -f k8s/secret.yaml

echo "[5/5] Deploying application..."
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Check status:  kubectl get pods -n panorai"
echo "Get URL:       kubectl get svc -n panorai"
echo "View logs:     kubectl logs -f -n panorai -l app=panorai"
echo ""

# Wait for pod to be ready
echo "Waiting for pod to be ready..."
kubectl wait --for=condition=ready pod -l app=panorai -n panorai --timeout=120s

echo ""
kubectl get svc -n panorai
echo ""
echo "Done! Your app is being served on the LoadBalancer IP above."
