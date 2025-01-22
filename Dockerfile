# Build stage
FROM golang:1.23-rc-alpine AS builder

RUN apk add --no-cache gcc musl-dev
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
