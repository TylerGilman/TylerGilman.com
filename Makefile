run: build
	@./bin/app

build: generate
	@go build -o bin/app .

generate:
	@echo "Generating templ files..."
	@templ generate

css:
	# Generate all CSS files
	npx tailwindcss -i views/css/base.css -o public/styles/base.css & \
	npx tailwindcss -i views/css/home.css -o public/styles/home.css & \
	npx tailwindcss -i views/css/blog.css -o public/styles/blog.css & \
	npx tailwindcss -i views/css/projects.css -o public/styles/projects.css

css-watch:
	# Watch and generate all CSS files
	npx tailwindcss -i views/css/base.css -o public/styles/base.css --watch & \
	npx tailwindcss -i views/css/home.css -o public/styles/home.css --watch & \
	npx tailwindcss -i views/css/blog.css -o public/styles/blog.css --watch & \
	npx tailwindcss -i views/css/projects.css -o public/styles/projects.css --watch

dev:
	@echo "Starting development server with live reload..."
	@templ generate --watch &
	@go run .

dev-all:
	@echo "Starting complete development environment..."
	@templ generate --watch &
	@npx tailwindcss -i views/css/base.css -o public/styles/base.css --watch &
	@npx tailwindcss -i views/css/home.css -o public/styles/home.css --watch &
	@npx tailwindcss -i views/css/blog.css -o public/styles/blog.css --watch &
	@npx tailwindcss -i views/css/projects.css -o public/styles/projects.css --watch &
	@go run .

.PHONY: run build generate css css-watch dev dev-all