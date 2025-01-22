# Build stage
FROM golang:1.23-rc-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev git

# Install templ CLI
RUN go install github.com/a-h/templ/cmd/templ@latest

# Enable CGO for SQLite
ENV CGO_ENABLED=1

WORKDIR /app

# Copy module files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy entire source code
COPY . .

# Generate templ files
RUN templ generate

# Build the application
RUN go build -v -o main .

# Run stage
FROM alpine:latest

WORKDIR /app

# Copy required files from builder
COPY --from=builder /app/main .
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views

# Create data directory and set permissions
RUN mkdir -p /app/data && \
    chown -R 1000:1000 /app && \
    chmod -R 755 /app/public && \
    chmod -R 755 /app/views && \
    chmod 755 /app/main

# Runtime configuration
USER 1000
EXPOSE 80

# Ensure data directory exists and run application
CMD ["sh", "-c", "mkdir -p /app/data && ./main"]
