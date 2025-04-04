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

## Docker Setup

We use two Dockerfiles:
- `Dockerfile` - For development
- `Dockerfile.prod` - For production (minimal image using pre-built binary)

### Building for Production

```bash
# Build production image
./scripts/build_docker.sh --type prod --tag prod

# For automatic deployment with Watchtower:
./scripts/build_docker.sh --type prod --tag prod --push
```

## Deployment

### Using Watchtower (Recommended)

1. Deploy with:
   ```
   ./scripts/deploy.sh
   ```

2. For updates, push to Docker Hub:
   ```
   ./scripts/build_docker.sh --type prod --tag prod --push
   ```
   
   Watchtower will automatically detect and deploy the new image.

### Manual Deployment

1. Build the production image:
   ```
   ./scripts/build_docker.sh --type prod --tag prod
   ```

2. Transfer the image to your server:
   ```
   scp tylergilman-app.tar user@your-server:/tmp/
   ```

3. On the server:
   ```
   docker load -i /tmp/tylergilman-app.tar
   docker-compose up -d
   ```

## Important Notes

- The `.env` file is mounted at runtime, not build time
- Make sure your production server has a valid GITHUB_TOKEN in its .env file
- The GitHub token is necessary for the contribution chart to work
- Traefik is used for reverse proxying and automatic SSL