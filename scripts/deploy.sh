#!/bin/bash
set -e

# Build the new image
docker build -t tylergilman/tylergilman:latest .

# Push to Docker Hub
docker push tylersgilman/tylergilman:latest

# Watchtower will automatically detect and pull the new image
