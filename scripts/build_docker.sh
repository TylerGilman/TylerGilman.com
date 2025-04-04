#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TylerGilman.com Docker Build Script ===${NC}"

# Check if templ is installed
if ! command -v templ &> /dev/null; then
    echo -e "${YELLOW}The templ CLI is not installed. Would you like to install it now?${NC}"
    read -p "Install templ? (y/n): " install_templ
    if [[ "$install_templ" == "y" ]]; then
        echo -e "${BLUE}Installing templ...${NC}"
        go install github.com/a-h/templ/cmd/templ@latest
        echo -e "${GREEN}templ installed successfully${NC}"
    else
        echo -e "${RED}templ is required to generate templates. Exiting.${NC}"
        exit 1
    fi
fi

# Generate templ files
echo -e "${BLUE}Generating templ files...${NC}"
templ generate
echo -e "${GREEN}Templates generated successfully${NC}"

# Build the app locally first
echo -e "${BLUE}Building Go app locally...${NC}"
go build -o bin/app .

# Then build Docker image with pre-built binary
echo -e "${BLUE}Building Docker image using Dockerfile.offline...${NC}"
docker build -f Dockerfile.offline -t tylergilman/tylergilman:prod .

echo -e "${GREEN}Docker image built successfully: tylergilman/tylergilman:prod${NC}"

# Ask if user wants to push the image
echo -e "${YELLOW}Do you want to push the image to Docker Hub?${NC}"
read -p "Push to Docker Hub? (y/n): " push_image
if [[ "$push_image" == "y" ]]; then
    echo -e "${BLUE}Pushing image to Docker Hub...${NC}"
    docker push tylergilman/tylergilman:prod
    echo -e "${GREEN}Image pushed successfully${NC}"
fi

echo -e "${GREEN}Build process complete!${NC}"
exit 0