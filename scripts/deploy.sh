#!/bin/bash
set -e

# Pull latest changes
git pull

# Build and start containers
docker-compose down
docker-compose build
docker-compose up -d

# Check status
docker-compose ps
