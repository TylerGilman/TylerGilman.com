# Build stage
FROM golang:1.23-rc-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev git

# Enable CGO for SQLite
ENV CGO_ENABLED=1

WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o main

# Run stage
FROM alpine:latest

WORKDIR /app
COPY --from=builder /app/main .
COPY ./public ./public
COPY ./views ./views

# Create database file with proper permissions
RUN touch blog.db && chmod 666 blog.db

EXPOSE 80
CMD ["./main"]
