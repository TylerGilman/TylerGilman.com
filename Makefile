run: build
	@./bin/app

build:
	@go build -o bin/app .

css:
	# Generate base CSS
	npx tailwindcss -i views/css/base.css -o public/styles/base.css & \
	# Generate home page CSS
	npx tailwindcss -i views/css/home.css -o public/styles/home.css & \
	# Generate blog page CSS
	npx tailwindcss -i views/css/blog.css -o public/styles/blog.css & \
	# Generate projects page CSS
	npx tailwindcss -i views/css/projects.css -o public/styles/projects.css --watch
