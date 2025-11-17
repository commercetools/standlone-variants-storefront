# ct-react-test

A simple React app for testing various API functions from the browser.
This example calls the product projections Search API to fetch a list of products.
Optionally, you can use commercetools' price selection logic to fetch the correct price 
for a product using a combination of currency, country, channel, and customer group parameters

# Setup:

Create a local .env file.

Install the dependencies.
```yarn```

---
# To run locally:

`yarn start`

Runs the app in  development mode.\
Open [http://localhost:3001](http://localhost:3001) to view it in the browser.

---

# Kubernetes Deployment

This application can be deployed to Kubernetes for team-wide access.

## Prerequisites

- Docker installed and running
- `kubectl` configured with access to the cluster
- `gcloud` CLI installed and authenticated (for GCR push)
- Access to the `platform-prototype` namespace

## Deployment Steps

1. **Build and push the Docker image:**
   ```bash
   ./k8s/deploy.sh
   ```
   
   This script will:
   - Build the Docker image for the correct platform (linux/amd64)
   - Push the image to `gcr.io/commercetools-platform/ct-react-test:latest`
   - Apply all Kubernetes manifests (Deployment, Service, Ingress)

2. **Verify the deployment:**
   ```bash
   kubectl get pods -l app=ct-react-test -n platform-prototype
   kubectl get svc ct-react-test -n platform-prototype
   kubectl get ingress ct-react-test -n platform-prototype
   ```

3. **Get the URL:**
   ```bash
   kubectl get ingress ct-react-test -n platform-prototype -o jsonpath='{.items[0].spec.rules[0].host}'
   ```
   
   The application will be available at:
   **http://ct-react-test.prototype.europe-west1.gcp.commercetools.com**

4. **View logs:**
   ```bash
   kubectl logs -f deployment/ct-react-test -n platform-prototype
   ```

## Manual Deployment

If you prefer to deploy manually:

```bash
# Build for linux/amd64 platform
docker buildx build --platform linux/amd64 -t gcr.io/commercetools-platform/ct-react-test:latest --push .

# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

## Updating the Deployment

After making code changes:

```bash
# Rebuild and push the image
docker buildx build --platform linux/amd64 -t gcr.io/commercetools-platform/ct-react-test:latest --push .

# Restart the deployment to pull the new image
kubectl rollout restart deployment/ct-react-test -n platform-prototype
kubectl rollout status deployment/ct-react-test -n platform-prototype
```

## Removing the Deployment

To completely remove the deployment:

```bash
# Delete all resources
kubectl delete -f k8s/ingress.yaml
kubectl delete -f k8s/service.yaml
kubectl delete -f k8s/deployment.yaml
```

Or delete everything at once:

```bash
kubectl delete -f k8s/
```

To also remove the Docker image from GCR:

```bash
gcloud container images delete gcr.io/commercetools-platform/ct-react-test:latest --quiet
```

## Troubleshooting

**Pods are crashing:**
- Check logs: `kubectl logs -l app=ct-react-test -n platform-prototype`
- Verify image platform: Make sure the image is built for `linux/amd64`, not ARM64
- Check resource limits: `kubectl describe pod -l app=ct-react-test -n platform-prototype`

**Ingress not working:**
- Check ingress status: `kubectl describe ingress ct-react-test -n platform-prototype`
- Verify service: `kubectl get svc ct-react-test -n platform-prototype`
- Check DNS resolution for the hostname

**Image pull errors:**
- Verify GCR authentication: `gcloud auth configure-docker gcr.io`
- Check image exists: `gcloud container images list --repository=gcr.io/commercetools-platform`

