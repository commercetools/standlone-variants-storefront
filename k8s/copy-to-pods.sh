#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="platform-prototype"
APP_LABEL="app=ct-react-test"
POD_NAME_PREFIX="ct-react-test-"
TARGET_PATH="/usr/share/nginx/html/"
BUILD_DIR="build"
DRY_RUN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--dry-run]"
            echo ""
            echo "Options:"
            echo "  --dry-run    Show what would be copied without actually copying"
            echo "  -h, --help   Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}=== DRY RUN MODE ===${NC}"
    echo -e "${BLUE}No files will be copied. Showing what would happen.${NC}"
    echo ""
fi

# Change to project root directory
cd "$(dirname "$0")/.."

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}Error: Build directory not found. Please run 'npm run build' first.${NC}"
    exit 1
fi

# Get all pods matching the label selector in the namespace
echo -e "${YELLOW}Finding pods in namespace ${NAMESPACE}...${NC}"
PODS=$(kubectl get pods -n ${NAMESPACE} -l ${APP_LABEL} -o jsonpath='{.items[*].metadata.name}')

if [ -z "$PODS" ]; then
    echo -e "${RED}Error: No pods found matching label ${APP_LABEL} in namespace ${NAMESPACE}${NC}"
    echo "Check with: kubectl get pods -n ${NAMESPACE}"
    exit 1
fi

echo -e "${GREEN}Found pods:${NC}"
for pod in $PODS; do
    echo "  - $pod"
done
echo ""

# Copy to each pod
for pod in $PODS; do
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}Would copy build folder to pod: ${pod}${NC}"
    else
        echo -e "${YELLOW}Copying build folder to pod: ${pod}${NC}"
    fi

    # First, clear the target directory
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}  Would clear ${TARGET_PATH}${NC}"
    else
        echo "  Clearing ${TARGET_PATH}..."
        kubectl exec -n ${NAMESPACE} ${pod} -- sh -c "rm -rf ${TARGET_PATH}*"
    fi

    # Create directories structure first
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}  Would create directory structure:${NC}"
    else
        echo "  Creating directory structure..."
    fi

    dir_count=0
    find ${BUILD_DIR} -type d | while read dir; do
        # Get relative path from build directory
        rel_path=${dir#${BUILD_DIR}/}
        if [ "$rel_path" != "$BUILD_DIR" ]; then
            if [ "$DRY_RUN" = true ]; then
                if [ $dir_count -lt 5 ]; then
                    echo -e "${BLUE}    ${TARGET_PATH}${rel_path}${NC}"
                fi
            else
                kubectl exec -n ${NAMESPACE} ${pod} -- sh -c "mkdir -p ${TARGET_PATH}${rel_path}"
            fi
            dir_count=$((dir_count + 1))
        fi
    done

    if [ "$DRY_RUN" = true ] && [ $dir_count -gt 5 ]; then
        echo -e "${BLUE}    ... and $((dir_count - 5)) more directories${NC}"
    fi

    # Copy files one by one
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}  Would copy files:${NC}"
    else
        echo "  Copying files..."
    fi

    file_count=0
    find ${BUILD_DIR} -type f | while read file; do
        # Get relative path from build directory
        rel_path=${file#${BUILD_DIR}/}

        if [ "$DRY_RUN" = true ]; then
            # In dry-run mode, show first 10 files
            if [ $file_count -lt 10 ]; then
                echo -e "${BLUE}    ${file} -> ${TARGET_PATH}${rel_path}${NC}"
            fi
        else
            # Copy the file
            kubectl cp ${file} ${NAMESPACE}/${pod}:${TARGET_PATH}${rel_path}
        fi

        file_count=$((file_count + 1))

        # Show progress every 10 files (only in non-dry-run mode)
        if [ "$DRY_RUN" = false ] && [ $((file_count % 10)) -eq 0 ]; then
            echo "    Copied ${file_count} files..."
        fi
    done

    # Show total file count
    TOTAL_FILES=$(find ${BUILD_DIR} -type f | wc -l | tr -d ' ')
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}  Would copy ${TOTAL_FILES} total files${NC}"
    else
        # Verify the copy
        echo "  Verifying..."
        FILE_COUNT=$(kubectl exec -n ${NAMESPACE} ${pod} -- sh -c "find ${TARGET_PATH} -type f | wc -l" | tr -d ' ')

        if [ "$FILE_COUNT" -gt 0 ]; then
            echo -e "${GREEN}  ✓ Successfully copied ${FILE_COUNT} files to ${pod}${NC}"
        else
            echo -e "${RED}  ✗ Failed to copy to ${pod}${NC}"
        fi
    fi
    echo ""
done

echo -e "${GREEN}Copy complete!${NC}"
echo ""
echo "Verify the deployment:"
echo "  kubectl get pods -n ${NAMESPACE} -l ${APP_LABEL}"
echo ""
echo "Check logs:"
echo "  kubectl logs -n ${NAMESPACE} -l ${APP_LABEL}"
echo ""
echo "Access the application:"
echo "  kubectl get ingress ct-react-test -n ${NAMESPACE}"