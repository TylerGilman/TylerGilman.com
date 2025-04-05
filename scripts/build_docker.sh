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
      echo "Usage: $0 [--type dev|prod] [--tag TAG] [--push]"
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

# Find Go path
find_go_path() {
  GO_PATH=$(which go 2>/dev/null || echo "/usr/local/go/bin/go")
  if [ ! -x "$GO_PATH" ]; then
    # Try common locations if which failed
    for p in "/usr/bin/go" "/usr/local/bin/go" "$HOME/go/bin/go" "$HOME/.go/bin/go"; do
      if [ -x "$p" ]; then
        GO_PATH="$p"
        break
      fi
    done
  fi
  
  if [ ! -x "$GO_PATH" ]; then
    echo -e "${RED}Error: Unable to find go executable. Please make sure Go is installed and in your PATH.${NC}"
    exit 1
  fi
  
  echo -e "${YELLOW}Using Go at: $GO_PATH${NC}"
}

# Find templ path
find_templ_path() {
  TEMPL_PATH=$(which templ 2>/dev/null)
  if [ ! -x "$TEMPL_PATH" ]; then
    # Try common locations
    for p in "$HOME/go/bin/templ" "/usr/local/bin/templ" "/usr/bin/templ"; do
      if [ -x "$p" ]; then
        TEMPL_PATH="$p"
        break
      fi
    done
  fi
  
  if [ ! -x "$TEMPL_PATH" ] && [ "$BUILD_METHOD" == "standard" ]; then
    echo -e "${YELLOW}Installing templ...${NC}"
    find_go_path
    $GO_PATH install github.com/a-h/templ/cmd/templ@latest
    TEMPL_PATH="$HOME/go/bin/templ"
  fi
}

# Find necessary paths
find_go_path
find_templ_path

# Build approach based on method
if [[ "$BUILD_METHOD" == "offline" ]]; then
  echo -e "${YELLOW}Building with offline approach (pre-built binary)${NC}"
  
  # Ensure bin directory exists
  mkdir -p bin
  
  # Generate templates if needed
  if [ -x "$TEMPL_PATH" ]; then
    echo -e "${YELLOW}Generating templates with: $TEMPL_PATH${NC}"
    $TEMPL_PATH generate
  fi
  
  # Build locally with full path to go
  echo -e "${YELLOW}Building Go binary...${NC}"
  $GO_PATH build -o bin/app .
  
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