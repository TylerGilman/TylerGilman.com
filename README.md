# TylerGilman.com

Personal website and blog built with Go, HTMX, and ThreeJS.

## Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/TylerGilman/TylerGilman.com.git
   cd TylerGilman.com
   ```

2. Create `.env` file with the following contents:
   ```
   ENV=development
   DEV_PORT=8002
   ADMIN_PASSWORD=admin
   SESSION_KEY=your_session_key
   DB_PATH=./data/blog.db
   LOG_LEVEL=DEBUG
   GITHUB_TOKEN=your_github_personal_access_token
   ```

3. Build and run locally:
   ```
   go mod download
   go run .
   ```

4. Or use Docker for development:
   ```
   docker-compose -f docker-compose.dev.yml up
   ```

## Scripts Overview

The repository contains two essential scripts:

1. **build_docker.sh**: Builds Docker images for dev or production
   ```bash
   # Before pushing to Docker Hub, make sure you're logged in:
   docker login
   
   # Quick reference:
   # Development build (creates a local image)
   ./scripts/build_docker.sh --type dev
   
   # Production build (creates a local image and saves as tylergilman-app.tar)
   ./scripts/build_docker.sh --type prod --tag prod
   
   # Production build + push to Docker Hub (for Watchtower auto-updates)
   ./scripts/build_docker.sh --type prod --tag prod --push
   ```
   
   **IMPORTANT NOTES:**
   - Do not use sudo with build_docker.sh
   - Pushing to Docker Hub requires docker login first
   - The --push flag sends the image to Docker Hub as tylergilman/tylergilman:prod
   - Watchtower on your server will automatically pull and deploy the new image

2. **deploy.sh**: Deploys the application to production
   ```bash
   # Deploy from Docker Hub
   ./scripts/deploy.sh
   
   # Deploy from local image
   # (select option 2 when prompted)
   ```

## Docker Setup

We use two Dockerfiles:
- `Dockerfile` - For development
- `Dockerfile.prod` - For production (minimal image using pre-built binary)

## Deployment

### Using Watchtower (Recommended)

This method uses Watchtower to automatically update your production server when you push new images to Docker Hub.

1. Initial Setup:
   ```bash
   # On your local machine:
   # Build and push the image to Docker Hub
   docker login
   ./scripts/build_docker.sh --type prod --tag prod --push
   
   # On your server:
   # First-time deployment
   ./scripts/deploy.sh
   # Select option 1 when prompted (Pull from Docker Hub and deploy)
   ```

2. For future updates (CI/CD workflow):
   ```bash
   # On your local machine - build and push
   docker login
   ./scripts/build_docker.sh --type prod --tag prod --push
   
   # That's it! Watchtower will automatically:
   # 1. Detect the new image on Docker Hub
   # 2. Pull the updated image
   # 3. Restart the containers with the new image
   # 4. Clean up the old image
   ```

### Manual Deployment (Without Watchtower)

If you prefer a more controlled deployment process without automatic updates:

1. On your local machine, build the production image:
   ```bash
   # Create the production image and save to tylergilman-app.tar
   ./scripts/build_docker.sh --type prod --tag prod
   ```

2. Transfer the image to your server:
   ```bash
   # Copy the image file to your server
   scp tylergilman-app.tar user@your-server:/tmp/
   ```

3. On your server:
   ```bash
   # Load the image
   docker load -i /tmp/tylergilman-app.tar
   
   # Deploy using the deploy script (or manually)
   ./scripts/deploy.sh
   # Select option 2 when prompted (Load from local image file)
   ```

## Important Notes

- The `.env` file is mounted at runtime, not build time
- Make sure your production server has a valid GITHUB_TOKEN in its .env file
- The GitHub token is necessary for the contribution chart to work
- Traefik is used for reverse proxying and automatic SSL