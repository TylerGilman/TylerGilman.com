# Development Dockerfile
FROM golang:1.21-bullseye AS builder

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Generate templ files
RUN go install github.com/a-h/templ/cmd/templ@latest
RUN templ generate

# Build application
RUN go build -o main .

# Run stage
FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
    netcat \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create data directory
RUN mkdir -p /app/data

# Copy build artifacts
COPY --from=builder /app/main .
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views

# Create non-root user
RUN useradd -u 1001 -m appuser && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app

USER appuser

EXPOSE 8080
CMD ["./main"]