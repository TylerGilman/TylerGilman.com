#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building Docker image for TylerGilman.com${NC}"

# Default values
BUILD_TYPE="prod"
TAG="latest"
PUSH_IMAGE=false

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --type)
      BUILD_TYPE="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --push)
      PUSH_IMAGE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--type dev|prod|build] [--tag TAG] [--push]"
      exit 1
      ;;
  esac
done

# Validate build type
if [[ ! "$BUILD_TYPE" =~ ^(dev|prod)$ ]]; then
  echo -e "${RED}Invalid build type: $BUILD_TYPE${NC}"
  echo "Valid types: dev, prod"
  exit 1
fi

# Select Dockerfile based on build type
case $BUILD_TYPE in
  dev)
    DOCKERFILE="Dockerfile"
    IMAGE_NAME="tylergilman/tylergilman:$TAG"
    BUILD_METHOD="standard"
    ;;
  prod)
    DOCKERFILE="Dockerfile.prod"
    IMAGE_NAME="tylergilman/tylergilman:$TAG"
    BUILD_METHOD="offline"
    ;;
esac

# Build approach based on method
if [[ "$BUILD_METHOD" == "offline" ]]; then
  echo -e "${YELLOW}Building with offline approach (pre-built binary)${NC}"
  
  # Ensure bin directory exists
  mkdir -p bin
  
  # Build locally
  echo -e "${YELLOW}Building Go binary...${NC}"
  go build -o bin/app .
  
  # Build Docker image
  echo -e "${YELLOW}Building Docker image from pre-built binary...${NC}"
  docker build -t $IMAGE_NAME -f $DOCKERFILE .
else
  echo -e "${YELLOW}Building with standard Docker build...${NC}"
  docker build -t $IMAGE_NAME -f $DOCKERFILE .
fi

echo -e "${GREEN}Image built successfully: $IMAGE_NAME${NC}"

# Push image if requested
if [[ "$PUSH_IMAGE" == true ]]; then
  echo -e "${YELLOW}Pushing image to Docker Hub...${NC}"
  docker push $IMAGE_NAME
  echo -e "${GREEN}Image pushed to Docker Hub${NC}"
fi

# Save image to file if it's a production build
if [[ "$BUILD_TYPE" == "prod" ]]; then
  echo -e "${YELLOW}Saving image to file...${NC}"
  docker save -o tylergilman-app.tar $IMAGE_NAME
  echo -e "${GREEN}Image saved to tylergilman-app.tar${NC}"
fi

echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${YELLOW}Run the application with: docker-compose -f docker-compose.dev.yml up${NC}"
if [[ "$BUILD_TYPE" == "prod" ]]; then
  echo -e "${YELLOW}For production: docker-compose -f docker-compose.prod.yml up -d${NC}"
fi