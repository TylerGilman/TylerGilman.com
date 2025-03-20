#!/bin/bash
set -e

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
SERVER_USER=${SERVER_USER:-"tygilman"}
SERVER_PORT=${SERVER_PORT:-"22"}
TARGET_DIR=${TARGET_DIR:-"~/TylerGilman.com"}
IMAGE_NAME=${IMAGE_NAME:-"tylergilman/tylergilman:prod"}
TARBALL_NAME=${TARBALL_NAME:-"tylergilman-app.tar"}

# Check if server IP is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Server IP address is required as the first argument${NC}"
    echo "Usage: $0 <server_ip> [ssh_user] [ssh_port]"
    exit 1
fi

SERVER_IP=$1

# Optional parameters
if [ ! -z "$2" ]; then
    SERVER_USER=$2
fi

if [ ! -z "$3" ]; then
    SERVER_PORT=$3
fi

echo -e "${YELLOW}=== TylerGilman.com Deployment Script ===${NC}"
echo -e "Deploying to ${GREEN}$SERVER_IP${NC} as user ${GREEN}$SERVER_USER${NC} on port ${GREEN}$SERVER_PORT${NC}"

# Step 1: Build the application locally
echo -e "\n${YELLOW}Step 1: Building application locally${NC}"
if [ ! -d "bin" ]; then
    mkdir -p bin
fi

echo -e "Generating templ templates..."
templ generate

echo -e "Building Go application..."
go build -o bin/app .

# Step 2: Create Docker image
echo -e "\n${YELLOW}Step 2: Building Docker image${NC}"
echo -e "Building Docker image using Dockerfile.offline..."
docker build -f Dockerfile.offline -t $IMAGE_NAME .

# Step 3: Save Docker image
echo -e "\n${YELLOW}Step 3: Saving Docker image to tarball${NC}"
echo -e "Saving image to $TARBALL_NAME..."
docker save $IMAGE_NAME -o $TARBALL_NAME

# Step 4: Transfer files to server
echo -e "\n${YELLOW}Step 4: Transferring files to server${NC}"
echo -e "Copying Docker image tarball to server..."
scp -P $SERVER_PORT $TARBALL_NAME $SERVER_USER@$SERVER_IP:~/

# Files needed for deployment
echo -e "Copying docker-compose.prod.yml to server..."
scp -P $SERVER_PORT docker-compose.prod.yml $SERVER_USER@$SERVER_IP:~/TylerGilman.com/

echo -e "Copying traefik configuration to server..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "mkdir -p ~/TylerGilman.com/traefik/config"
scp -P $SERVER_PORT traefik/config/middlewares.yml $SERVER_USER@$SERVER_IP:~/TylerGilman.com/traefik/config/
scp -P $SERVER_PORT traefik/traefik.yml $SERVER_USER@$SERVER_IP:~/TylerGilman.com/traefik/

# Step 5: Deploy on server
echo -e "\n${YELLOW}Step 5: Deploying on server${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "cd ~/TylerGilman.com && \
    docker load -i ~/$TARBALL_NAME && \
    docker-compose -f docker-compose.prod.yml down && \
    docker-compose -f docker-compose.prod.yml up -d && \
    echo 'Deployment completed successfully'"

# Step 6: Cleanup
echo -e "\n${YELLOW}Step 6: Cleaning up${NC}"
echo -e "Removing local tarball..."
rm $TARBALL_NAME

echo -e "\n${GREEN}Deployment to $SERVER_IP completed successfully!${NC}"
echo -e "Your website should be available at ${YELLOW}https://tylergilman.com${NC}"
echo -e "Traefik dashboard should be available at ${YELLOW}https://traefik.tylergilman.com${NC}"
echo -e "\nTo check the status of your containers, run:"
echo -e "${YELLOW}ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"docker-compose -f ~/TylerGilman.com/docker-compose.prod.yml ps\"${NC}"
echo -e "\nTo view the logs, run:"
echo -e "${YELLOW}ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"docker-compose -f ~/TylerGilman.com/docker-compose.prod.yml logs -f\"${NC}"