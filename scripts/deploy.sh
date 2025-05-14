#!/bin/bash
set -e

# Display what we're about to do
echo "Starting deployment for tylergilman.com..."

# Build the new Docker image
echo "Building new Docker image..."
docker build -t tylergilman/tylergilman:prod .

# Push the image to Docker Hub (if you have credentials configured)
echo "Pushing image to Docker Hub..."
docker push tylergilman/tylergilman:prod

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
  echo "Creating data directory..."
  mkdir -p data
  chmod 755 data
fi

# Create traefik directory structure if it doesn't exist
if [ ! -d "traefik/letsencrypt" ]; then
  echo "Creating traefik directories..."
  mkdir -p traefik/letsencrypt
  chmod 700 traefik/letsencrypt
fi

# Check if the containers are already running
if docker ps | grep -q tylergilman_web; then
  echo "Updating existing containers via Watchtower..."
  # Trigger Watchtower to update the containers
  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    containrrr/watchtower \
    --run-once --cleanup \
    --scope tylergilman
else
  echo "Starting services with docker-compose..."
  # Start the entire stack
  docker-compose up -d
fi

echo "Deployment completed successfully!"
echo "Your website should be accessible at https://tylergilman.com"