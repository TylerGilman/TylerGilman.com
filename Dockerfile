# Build stage
FROM golang:1.23-rc-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev git

# Install templ CLI
RUN go install github.com/a-h/templ/cmd/templ@latest

# Enable CGO
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

# Set permissions
RUN chmod -R 755 /app/public && \
    chmod -R 755 /app/views

# Runtime configuration
EXPOSE 80
CMD ["./main"]
