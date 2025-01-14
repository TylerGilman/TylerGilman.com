#!/bin/bash
set -e

# Build the new image
docker build -t yourusername/tylergilman:latest .

# Push to Docker Hub
docker push yourusername/tylergilman:latest

# Watchtower will automatically detect and pull the new image
