#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TylerGilman.com Local Build Script ===${NC}"

# Since we can't easily resolve Go version, let's use a Docker-based build approach
echo -e "${YELLOW}Using Docker to build the application with compatible Go version${NC}"

# Create a temporary Dockerfile for building
echo -e "${BLUE}Creating build Dockerfile...${NC}"
cat > Dockerfile.build << EOL
# Builder stage
FROM golang:1.23-rc-bullseye AS builder

WORKDIR /app

# Copy source code
COPY . .

# Install templ
RUN go install github.com/a-h/templ/cmd/templ@v0.3.833

# Generate templates
RUN templ generate

# Build the application
RUN go build -o app .

# Final stage
FROM busybox:stable

WORKDIR /app

# Create data directory
RUN mkdir -p /app/data

# Copy the binary and static files from builder
COPY --from=builder /app/app /app/main
COPY --from=builder /app/public /app/public
COPY --from=builder /app/views /app/views

# Make the binary executable
RUN chmod +x /app/main

# Create a non-root user
RUN adduser -D -u 1001 appuser && \\
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8080
CMD ["/app/main"]
EOL

echo -e "${BLUE}Building Docker image using multi-stage build...${NC}"
docker build -t tylergilman/tylergilman:prod -f Dockerfile.build .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker image built successfully: tylergilman/tylergilman:prod${NC}"
else
    echo -e "${RED}Failed to build Docker image. See errors above.${NC}"
    exit 1
fi

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