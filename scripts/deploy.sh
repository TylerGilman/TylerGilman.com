#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TylerGilman.com Deployment Script ===${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}Error: Neither docker-compose nor Docker Compose plugin found.${NC}"
    echo -e "${YELLOW}Please install Docker Compose before continuing.${NC}"
    exit 1
fi

# Check if docker-compose.yml exists
if [ ! -f docker-compose.yml ]; then
    echo -e "${RED}Error: docker-compose.yml not found.${NC}"
    exit 1
fi

# Initialize Traefik directory structure if it doesn't exist
if [ ! -d "traefik" ]; then
    echo -e "${YELLOW}Creating Traefik configuration directories...${NC}"
    mkdir -p traefik/config
    echo -e "${GREEN}Traefik directories created successfully.${NC}"
fi

# Check if SSL email is configured
if grep -q "your-email@example.com" traefik/traefik.yml 2>/dev/null; then
    echo -e "${YELLOW}Warning: Let's Encrypt email not configured${NC}"
    read -p "Enter your email for Let's Encrypt: " letsencrypt_email
    if [ ! -z "$letsencrypt_email" ]; then
        sed -i "s/your-email@example.com/$letsencrypt_email/g" traefik/traefik.yml
        echo -e "${GREEN}Email updated in Traefik configuration${NC}"
    else
        echo -e "${RED}Email is required for Let's Encrypt. Exiting.${NC}"
        exit 1
    fi
fi

# Check if traefik middlewares exist
if [ ! -f "traefik/config/middlewares.yml" ]; then
    echo -e "${YELLOW}Creating Traefik middleware configuration...${NC}"
    
    # Generate a secure password if htpasswd is available
    ADMIN_AUTH="admin:\$2y\$05\$flFpNO8eP\/ILFHYpVOe9.OqfNsIUcoBFUxzGJgGXrB\/m1tQRhPRyS"
    if command -v htpasswd > /dev/null; then
        echo -e "${YELLOW}Setting up Traefik dashboard authentication${NC}"
        read -p "Enter username for Traefik dashboard (default: admin): " traefik_user
        traefik_user=${traefik_user:-admin}
        read -s -p "Enter password for Traefik dashboard: " traefik_password
        echo ""
        
        if [ -z "$traefik_password" ]; then
            if command -v openssl > /dev/null; then
                traefik_password=$(openssl rand -base64 12)
                echo -e "${YELLOW}Generated password: ${GREEN}$traefik_password${NC}"
            else
                traefik_password="password"
            fi
        fi
        
        ADMIN_AUTH=$(htpasswd -nb $traefik_user $traefik_password)
        ADMIN_AUTH=$(echo $ADMIN_AUTH | sed 's/\$/\\\$/g')
    fi
    
    # Create middlewares.yml
    cat > traefik/config/middlewares.yml << EOL
http:
  middlewares:
    # Authentication middleware for sensitive dashboards
    traefik-auth:
      basicAuth:
        users:
          - "$ADMIN_AUTH" # admin/password - replace with your own hashed credentials
    
    # Security headers for all services
    security-headers:
      headers:
        frameDeny: true
        browserXssFilter: true
        contentTypeNosniff: true
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
        customFrameOptionsValue: "SAMEORIGIN"
        contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';"
EOL
    
    # Create tls.yml
    cat > traefik/config/tls.yml << EOL
tls:
  options:
    default:
      minVersion: VersionTLS12
      sniStrict: true
      cipherSuites:
        - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
EOL
    
    echo -e "${GREEN}Traefik configuration created successfully${NC}"
fi

# Make sure data directory exists
mkdir -p data
touch data/.keep
chmod -R 755 data

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    
    # Generate random session key if possible
    SESSION_KEY="change_me_please"
    if command -v openssl &> /dev/null; then
        SESSION_KEY=$(openssl rand -base64 32)
    fi
    
    cat > .env << EOL
# Server Configuration
ENV=production
DEV_PORT=8080

# Security
ADMIN_PASSWORD=change_me_please
SESSION_KEY=$SESSION_KEY

# Logging
LOG_LEVEL=INFO

# Database
DB_PATH=/app/data/blog.db

# GitHub Integration (required for contribution chart)
GITHUB_TOKEN=your_github_token
EOL
    echo -e "${GREEN}.env file created. Please edit it with your actual values.${NC}"
    echo -e "${YELLOW}Especially the ADMIN_PASSWORD and GITHUB_TOKEN which are crucial for functionality${NC}"
fi

# Ask for deployment option
echo -e "${YELLOW}Select deployment option:${NC}"
echo "1) Pull from Docker Hub and deploy"
echo "2) Load from local image file"
echo "3) Stop all services"
read -p "Enter your choice [1-3]: " deployment_option

case $deployment_option in
    1)
        echo -e "${BLUE}Pulling latest image from Docker Hub...${NC}"
        if docker pull tylergilman/tylergilman:prod; then
            echo -e "${GREEN}Image pulled successfully${NC}"
        else
            echo -e "${RED}Failed to pull image from Docker Hub.${NC}"
            exit 1
        fi
        ;;
    2)
        echo -e "${BLUE}Loading image from local file...${NC}"
        
        # Check for .tar or .tar.gz file
        if [ -f "tylergilman-app.tar.gz" ]; then
            echo -e "${BLUE}Found tylergilman-app.tar.gz file${NC}"
            gunzip -c tylergilman-app.tar.gz | docker load
        elif [ -f "tylergilman-app.tar" ]; then
            echo -e "${BLUE}Found tylergilman-app.tar file${NC}"
            docker load -i tylergilman-app.tar
        else
            echo -e "${RED}No image file found. Please provide the path to the image file:${NC}"
            read -p "Enter path to image file: " image_path
            
            if [ ! -f "$image_path" ]; then
                echo -e "${RED}Error: File not found at $image_path${NC}"
                exit 1
            fi
            
            if [[ "$image_path" == *.tar.gz ]]; then
                gunzip -c "$image_path" | docker load
            else
                docker load -i "$image_path"
            fi
        fi
        echo -e "${GREEN}Image loaded successfully${NC}"
        ;;
    3)
        echo -e "${BLUE}Stopping all services...${NC}"
        $COMPOSE_CMD -f docker-compose.yml down
        echo -e "${GREEN}All services stopped.${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option. Exiting.${NC}"
        exit 1
        ;;
esac

# Deploy
echo -e "${BLUE}Deploying with docker-compose...${NC}"
$COMPOSE_CMD -f docker-compose.yml up -d

# Check if services are running
echo -e "${BLUE}Checking service status...${NC}"
$COMPOSE_CMD -f docker-compose.yml ps

# Display access information
echo -e "\n${GREEN}Deployment Complete!${NC}"
echo -e "${YELLOW}Services:${NC}"
echo -e "- Website: https://tylergilman.com"
echo -e "- Traefik Dashboard: https://traefik.tylergilman.com"
echo -e "- Prometheus: https://prometheus.tylergilman.com"
echo -e "- Grafana: https://grafana.tylergilman.com"

echo -e "\n${YELLOW}Notes:${NC}"
echo -e "- SSL certificates will be automatically provisioned by Let's Encrypt"
echo -e "- Ensure your DNS records are properly configured for all domains"
echo -e "- Traefik dashboard is password protected with the credentials you provided"
echo -e "- IMPORTANT: Check that your GITHUB_TOKEN is set in the .env file for GitHub contributions"

# View logs if requested
echo -e "\n${YELLOW}Do you want to view the logs?${NC}"
read -p "View logs? (y/n): " view_logs
if [[ "$view_logs" == "y" ]]; then
    $COMPOSE_CMD -f docker-compose.yml logs -f
fi

exit 0