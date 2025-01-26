# Build stage
FROM golang:1.23-rc-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev git

# Install templ CLI
RUN go install github.com/a-h/templ/cmd/templ@latest

# Enable CGO for SQLite
ENV CGO_ENABLED=1

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Generate templ files
RUN templ generate

# Build application
RUN go build -o main .

# Run stage
FROM alpine:latest

WORKDIR /app

# Copy build artifacts
COPY --from=builder /app/main .
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views

RUN adduser -D -u 1001 appuser && chown -R appuser:appuser /app && chmod -R 755 /app

USER appuser

EXPOSE 80
CMD ["./main"]
