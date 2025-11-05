#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"commercetools-platform"}
REGION=${GCP_REGION:-"europe-west1"}
IMAGE_NAME="ct-react-test"
IMAGE_TAG=${IMAGE_TAG:-"latest"}
GCR_REGISTRY="gcr.io/${PROJECT_ID}"

cd "$(dirname "$0")/.."

echo -e "${YELLOW}Building Docker image for linux/amd64...${NC}"
# Use buildx to build for linux/amd64 platform (required for GKE)
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME}:${IMAGE_TAG} --load .

# Detect cluster type
CLUSTER_INFO=$(kubectl cluster-info 2>/dev/null || echo "")

if echo "$CLUSTER_INFO" | grep -q "kind"; then
    echo -e "${YELLOW}Loading image into kind cluster...${NC}"
    kind load docker-image ${IMAGE_NAME}:${IMAGE_TAG}
    IMAGE_TO_USE=${IMAGE_NAME}:${IMAGE_TAG}
elif echo "$CLUSTER_INFO" | grep -q "minikube"; then
    echo -e "${YELLOW}Loading image into minikube...${NC}"
    eval $(minikube docker-env)
    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
    IMAGE_TO_USE=${IMAGE_NAME}:${IMAGE_TAG}
else
    echo -e "${YELLOW}Remote cluster detected. Pushing to GCR...${NC}"
    
    # Check if gcloud is available
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}Error: gcloud CLI not found. Please install it or use a local cluster.${NC}"
        exit 1
    fi
    
    # Build and push directly to GCR for linux/amd64
    FULL_IMAGE_NAME="${GCR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo -e "${YELLOW}Building and pushing to ${FULL_IMAGE_NAME}...${NC}"
    docker buildx build --platform linux/amd64 -t ${FULL_IMAGE_NAME} --push .
    
    IMAGE_TO_USE=${FULL_IMAGE_NAME}
    
    # Update deployment.yaml with the GCR image
    sed -i.bak "s|image:.*|image: ${FULL_IMAGE_NAME}|" k8s/deployment.yaml
    # Clean up backup file
    rm -f k8s/deployment.yaml.bak
fi

echo -e "${YELLOW}Applying Kubernetes manifests...${NC}"
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Check status with:"
echo "  kubectl get pods -l app=ct-react-test"
echo "  kubectl get svc ct-react-test"
echo "  kubectl get ingress ct-react-test"
echo ""
echo "Get the URL:"
INGRESS_HOST=$(kubectl get ingress ct-react-test -o jsonpath='{.items[0].spec.rules[0].host}' 2>/dev/null || echo "check with: kubectl get ingress")
echo "  https://${INGRESS_HOST}"
echo ""
echo "View logs:"
echo "  kubectl logs -f deployment/ct-react-test"

