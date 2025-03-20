#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TylerGilman.com VPS Setup Script ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root${NC}"
  exit 1
fi

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start Docker
    systemctl enable docker
    systemctl start docker
    
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker is already installed${NC}"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    apt-get update
    apt-get install -y docker-compose
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}Docker Compose is already installed${NC}"
fi

# Install other useful tools
echo -e "${YELLOW}Installing additional tools...${NC}"
apt-get install -y htop nano git apache2-utils

# Set up firewall
echo -e "${YELLOW}Setting up firewall...${NC}"
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
echo -e "${YELLOW}Enable the firewall now? This might disconnect your SSH session if not on port 22.${NC}"
read -p "Enable firewall? (y/n): " enable_firewall
if [[ "$enable_firewall" == "y" ]]; then
    ufw --force enable
    echo -e "${GREEN}Firewall enabled${NC}"
else
    echo -e "${YELLOW}Firewall setup skipped. You can enable it later with: ufw enable${NC}"
fi

# Create app directory
echo -e "${YELLOW}Setting up application directory...${NC}"
mkdir -p /opt/tylergilman
cd /opt/tylergilman

# Prompt for git clone
echo -e "${YELLOW}Do you want to clone the repository now?${NC}"
read -p "Clone repository? (y/n): " clone_repo
if [[ "$clone_repo" == "y" ]]; then
    if [ -d "/opt/tylergilman/TylerGilman.com" ]; then
        echo -e "${YELLOW}Repository already exists. Pull latest changes?${NC}"
        read -p "Pull changes? (y/n): " pull_changes
        if [[ "$pull_changes" == "y" ]]; then
            cd /opt/tylergilman/TylerGilman.com
            git pull
        fi
    else
        git clone https://github.com/TylerGilman/TylerGilman.com.git
        cd TylerGilman.com
    fi
    
    # Create directories
    mkdir -p data traefik/config monitoring/prometheus monitoring/grafana/provisioning/datasources monitoring/grafana/provisioning/dashboards
    
    # Set up .env file
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}Creating .env file...${NC}"
        cat > .env << EOL
ENV=production
DEV_PORT=8080
ADMIN_PASSWORD=changeme
LOG_LEVEL=INFO
GITHUB_TOKEN=changeme
SESSION_KEY=changeme
DB_PATH=/app/data/blog.db
GRAFANA_PASSWORD=changeme
EOL
        echo -e "${GREEN}.env file created. Please edit it with your actual values.${NC}"
        echo -e "${YELLOW}You can edit it with: nano .env${NC}"
    else
        echo -e "${GREEN}.env file already exists${NC}"
    fi
    
    # Update Traefik email
    echo -e "${YELLOW}Do you want to update the Traefik configuration with your email?${NC}"
    read -p "Update email? (y/n): " update_email
    if [[ "$update_email" == "y" ]]; then
        read -p "Enter your email for Let's Encrypt: " letsencrypt_email
        sed -i "s/your-email@example.com/$letsencrypt_email/g" traefik/traefik.yml
        echo -e "${GREEN}Email updated in Traefik configuration${NC}"
    fi
    
    # Generate password for Traefik dashboard
    echo -e "${YELLOW}Do you want to update the Traefik dashboard password?${NC}"
    read -p "Update password? (y/n): " update_password
    if [[ "$update_password" == "y" ]]; then
        read -p "Enter username for Traefik dashboard: " traefik_user
        read -s -p "Enter password for Traefik dashboard: " traefik_password
        echo ""
        hashed_password=$(htpasswd -nb $traefik_user $traefik_password)
        escaped_password=$(echo $hashed_password | sed 's/\$/\\\$/g')
        sed -i "s/admin:\$2y\$05\$flFpNO8eP\/ILFHYpVOe9.OqfNsIUcoBFUxzGJgGXrB\/m1tQRhPRyS/$escaped_password/g" traefik/config/middlewares.yml
        echo -e "${GREEN}Password updated in Traefik configuration${NC}"
    fi
    
    # Set proper permissions
    chown -R 1001:1001 data
    chmod -R 755 data
    
    echo -e "${GREEN}Repository setup complete${NC}"
else
    echo -e "${YELLOW}Repository setup skipped${NC}"
fi

# Add automatic updates
echo -e "${YELLOW}Do you want to set up automatic system updates?${NC}"
read -p "Setup automatic updates? (y/n): " setup_updates
if [[ "$setup_updates" == "y" ]]; then
    apt-get install -y unattended-upgrades apt-listchanges
    cat > /etc/apt/apt.conf.d/50unattended-upgrades << EOL
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}";
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
    "\${distro_id}:\${distro_codename}-updates";
};
Unattended-Upgrade::Package-Blacklist {
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::InstallOnShutdown "false";
Unattended-Upgrade::Mail "root";
Unattended-Upgrade::MailOnlyOnError "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
EOL

    cat > /etc/apt/apt.conf.d/20auto-upgrades << EOL
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOL
    echo -e "${GREEN}Automatic updates configured${NC}"
else
    echo -e "${YELLOW}Automatic updates setup skipped${NC}"
fi

# Setup backup
echo -e "${YELLOW}Do you want to set up automated backups for the database?${NC}"
read -p "Setup backups? (y/n): " setup_backups
if [[ "$setup_backups" == "y" ]]; then
    mkdir -p /opt/backups
    
    cat > /opt/tylergilman/backup.sh << EOL
#!/bin/bash
TIMESTAMP=\$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p \$BACKUP_DIR
cd /opt/tylergilman/TylerGilman.com

# Backup database
tar -czf \$BACKUP_DIR/tylergilman-data-\$TIMESTAMP.tar.gz data/

# Keep only last 7 backups
ls -tp \$BACKUP_DIR/tylergilman-data-*.tar.gz | grep -v '/$' | tail -n +8 | xargs -I {} rm -- {}
EOL
    
    chmod +x /opt/tylergilman/backup.sh
    
    # Add cron job
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/tylergilman/backup.sh") | crontab -
    
    echo -e "${GREEN}Backup system configured - daily at 2:00 AM${NC}"
else
    echo -e "${YELLOW}Backup setup skipped${NC}"
fi

echo -e "\n${GREEN}VPS setup completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Edit the .env file with your actual values: nano /opt/tylergilman/TylerGilman.com/.env"
echo -e "2. Configure DNS records for your domains:"
echo -e "   - tylergilman.com"
echo -e "   - traefik.tylergilman.com"
echo -e "   - prometheus.tylergilman.com"
echo -e "   - grafana.tylergilman.com"
echo -e "3. Deploy the application:"
echo -e "   cd /opt/tylergilman/TylerGilman.com && ./scripts/deploy.sh"
echo -e "4. Check if everything is running: docker-compose ps"
echo -e "5. View logs if needed: docker-compose logs -f web1"
echo -e "\n${GREEN}Good luck with your deployment!${NC}"