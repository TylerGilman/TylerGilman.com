#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TylerGilman.com Build Script ===${NC}"

# Fix go.mod file if needed
if grep -q "go 1.23" go.mod; then
    echo -e "${YELLOW}Found Go 1.23 in go.mod but this version might not be available${NC}"
    echo -e "${BLUE}Creating backup of go.mod as go.mod.backup${NC}"
    cp go.mod go.mod.backup
    
    echo -e "${BLUE}Updating go.mod to use Go 1.21...${NC}"
    sed -i 's/go 1.23/go 1.21/g' go.mod
    echo -e "${GREEN}Updated go.mod to use 'go 1.21'${NC}"
fi

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

# Create build directory
echo -e "${BLUE}Creating build directory...${NC}"
mkdir -p bin

# Generate templ files
echo -e "${BLUE}Generating templ files...${NC}"
templ generate
echo -e "${GREEN}Templates generated successfully${NC}"

# Build application
echo -e "${BLUE}Building application...${NC}"
go build -o bin/app .
echo -e "${GREEN}Application built successfully${NC}"

# Create a minimal Dockerfile
echo -e "${BLUE}Creating minimal Dockerfile...${NC}"
cat > Dockerfile.minimal << EOL
FROM busybox:stable

WORKDIR /app

# Create data directory
RUN mkdir -p /app/data

# Copy pre-built binary and required files
COPY bin/app /app/main
COPY public /app/public
COPY views /app/views

# Make the binary executable
RUN chmod +x /app/main

# Create a non-root user
RUN adduser -D -u 1001 appuser
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080
CMD ["/app/main"]
EOL
echo -e "${GREEN}Created minimal Dockerfile${NC}"

# Build Docker image
echo -e "${BLUE}Building Docker image...${NC}"
docker build -t tylergilman/tylergilman:prod -f Dockerfile.minimal .
echo -e "${GREEN}Docker image built successfully: tylergilman/tylergilman:prod${NC}"

# Save the image to a file
echo -e "${YELLOW}Would you like to save the Docker image for offline deployment?${NC}"
read -p "Save image? (y/n): " save_image
if [[ "$save_image" == "y" ]]; then
    echo -e "${BLUE}Saving Docker image to tylergilman_prod.tar.gz...${NC}"
    docker save tylergilman/tylergilman:prod | gzip > tylergilman_prod.tar.gz
    echo -e "${GREEN}Image saved to tylergilman_prod.tar.gz${NC}"
fi

# Ask if user wants to push the image
echo -e "${YELLOW}Do you want to push the image to Docker Hub?${NC}"
read -p "Push to Docker Hub? (y/n): " push_image
if [[ "$push_image" == "y" ]]; then
    echo -e "${BLUE}Pushing image to Docker Hub...${NC}"
    docker push tylergilman/tylergilman:prod || {
        echo -e "${RED}Failed to push to Docker Hub.${NC}"
        echo -e "${YELLOW}You can try again later with:${NC}"
        echo -e "${BLUE}  docker push tylergilman/tylergilman:prod${NC}"
    }
fi

echo -e "${GREEN}Build process complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Transfer and deploy on your server with: ./scripts/deploy.sh"
echo -e "2. If you saved the image, upload tylergilman_prod.tar.gz to your server"
exit 0