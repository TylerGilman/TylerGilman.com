#!/bin/bash

# Kill any existing instances of the app
pkill app || true
pkill -f "go run ." || true

# Wait a moment for the port to be freed
sleep 1

# Clear the screen
clear

echo "Building CSS and Go app..."

# Generate CSS
echo "# Generate all CSS files"
npx tailwindcss -i views/css/base.css -o public/styles/base.css & \
npx tailwindcss -i views/css/home.css -o public/styles/home.css & \
npx tailwindcss -i views/css/blog.css -o public/styles/blog.css & \
npx tailwindcss -i views/css/projects.css -o public/styles/projects.css

# Generate templ files
echo "Generating templ files..."
# Detect available generators to use
if command -v templ &> /dev/null; then
    templ generate
elif command -v go &> /dev/null; then
    go generate ./...
fi

# Start the app
echo "Starting app..."
go run .