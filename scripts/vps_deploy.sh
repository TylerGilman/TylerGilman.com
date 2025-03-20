#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TylerGilman.com VPS Deployment Script ===${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if docker-compose.prod.yml exists
if [ ! -f docker-compose.prod.yml ]; then
    echo -e "${RED}Error: docker-compose.prod.yml not found. Please run this script from the project root.${NC}"
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
    read -p "Enter your email for Let's Encrypt (or press Enter to skip): " letsencrypt_email
    if [ ! -z "$letsencrypt_email" ]; then
        sed -i "s/your-email@example.com/$letsencrypt_email/g" traefik/traefik.yml
        echo -e "${GREEN}Email updated in Traefik configuration${NC}"
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
        read -s -p "Enter password for Traefik dashboard (or press Enter for random): " traefik_password
        echo ""
        
        if [ -z "$traefik_password" ]; then
            # Generate random password if openssl is available
            if command -v openssl > /dev/null; then
                traefik_password=$(openssl rand -base64 12)
            else
                traefik_password="password"
            fi
            echo -e "${YELLOW}Generated password: ${GREEN}$traefik_password${NC}"
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

# Ask for deployment option
echo -e "${YELLOW}Select deployment option:${NC}"
echo "1) Build and deploy locally"
echo "2) Pull from Docker Hub and deploy"
echo "3) Load from local tarball (for offline deployment)"
echo "4) Stop all services"
read -p "Enter your choice [1-4]: " deployment_option

case $deployment_option in
    1)
        echo -e "${BLUE}Building Docker image...${NC}"
        
        # Check if there's a local build script
        if [ -f "scripts/local_build.sh" ]; then
            echo -e "${YELLOW}Using local build script...${NC}"
            bash scripts/local_build.sh
        else
            # If no local build script, try to build using Dockerfile
            if [ -f "Dockerfile.static" ]; then
                echo -e "${YELLOW}Using Dockerfile.static for better offline compatibility...${NC}"
                docker build -t tylergilman/tylergilman:prod -f Dockerfile.static .
            else
                echo -e "${YELLOW}Using standard Dockerfile...${NC}"
                docker build -t tylergilman/tylergilman:prod .
            fi
        fi
        
        echo -e "${BLUE}Deploying with docker-compose...${NC}"
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    2)
        echo -e "${BLUE}Pulling latest image from Docker Hub...${NC}"
        if docker pull tylergilman/tylergilman:prod; then
            echo -e "${GREEN}Image pulled successfully${NC}"
        else
            echo -e "${RED}Failed to pull image from Docker Hub.${NC}"
            echo -e "${YELLOW}Would you like to try building locally instead?${NC}"
            read -p "Build locally? (y/n): " build_locally
            if [[ "$build_locally" == "y" ]]; then
                echo -e "${BLUE}Building Docker image locally...${NC}"
                if [ -f "scripts/local_build.sh" ]; then
                    bash scripts/local_build.sh
                else
                    if [ -f "Dockerfile.static" ]; then
                        docker build -t tylergilman/tylergilman:prod -f Dockerfile.static .
                    else
                        docker build -t tylergilman/tylergilman:prod .
                    fi
                fi
            else
                echo -e "${RED}Deployment aborted.${NC}"
                exit 1
            fi
        fi
        
        echo -e "${BLUE}Deploying with docker-compose...${NC}"
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    3)
        echo -e "${BLUE}Loading image from local tarball...${NC}"
        read -p "Enter path to Docker image tarball: " tarball_path
        
        if [ ! -f "$tarball_path" ]; then
            echo -e "${RED}Error: Tarball not found at $tarball_path${NC}"
            exit 1
        fi
        
        echo -e "${BLUE}Loading Docker image...${NC}"
        docker load -i "$tarball_path"
        
        echo -e "${BLUE}Deploying with docker-compose...${NC}"
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    4)
        echo -e "${BLUE}Stopping all services...${NC}"
        docker-compose -f docker-compose.prod.yml down
        echo -e "${GREEN}All services stopped.${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option. Exiting.${NC}"
        exit 1
        ;;
esac

# Check if services are running
echo -e "${BLUE}Checking service status...${NC}"
docker-compose -f docker-compose.prod.yml ps

# Display access information
echo -e "\n${GREEN}Deployment Complete!${NC}"
echo -e "${YELLOW}Services:${NC}"
echo -e "- Website: https://tylergilman.com"
echo -e "- Traefik Dashboard: https://traefik.tylergilman.com"

echo -e "\n${YELLOW}Notes:${NC}"
echo -e "- SSL certificates will be automatically provisioned by Let's Encrypt"
echo -e "- Ensure your DNS records are properly configured for all domains"
echo -e "- Watchtower will automatically update containers when new images are pushed"

# View logs if requested
echo -e "\n${YELLOW}Do you want to view the logs?${NC}"
read -p "View logs? (y/n): " view_logs
if [[ "$view_logs" == "y" ]]; then
    docker-compose -f docker-compose.prod.yml logs -f
fi

exit 0