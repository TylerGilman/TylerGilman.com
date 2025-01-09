# Build stage
FROM golang:1.21-alpine AS builder

# Install GCC and related libraries for CGO
RUN apk add --no-cache gcc musl-dev

# Enable CGO
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
EXPOSE 80
CMD ["./main"]
