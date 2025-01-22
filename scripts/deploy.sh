#!/bin/bash
set -e

# Build the new image
docker build -t tylergilman/tylergilman:prod .

# Push to Docker Hub
docker push tylergilman/tylergilman:prod

# Watchtower will automatically detect and pull the new image
