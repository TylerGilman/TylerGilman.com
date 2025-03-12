# CLAUDE.md - Project Guidelines

## Build & Run Commands
- Build app: `make build` or `go build -o bin/app .`
- Run locally: `make run` or `./bin/app`
- Build Docker: `docker build -t tylergilman/tylergilman:prod .`
- Run in Docker: `docker-compose up`
- Generate CSS: `make css`
- Deploy: `./scripts/deploy.sh`

## Code Style Guidelines
- **Naming**: camelCase for variables, CamelCase for functions, UPPERCASE for constants
- **Imports**: Standard library first, third-party next, internal packages last
- **Error Handling**: Check errors explicitly, use slog for logging
- **Templates**: Use templ for HTML components with modular approach
- **JavaScript**: ES6 classes with clear separation of concerns
- **CSS**: Component-specific CSS files with consistent naming

## Project Structure
- `handlers/`: HTTP request handlers
- `views/`: Templ templates and components
- `public/`: Static assets (JS, CSS, images)
- `pkg/`: Shared utilities
- `authpkg/`: Authentication utilities

## ThreeJS Implementation Notes
- Lazy load ThreeJS for fish tank component
- Keep initial page load fast with progressive enhancement
- Maintain responsive design across different screen sizes