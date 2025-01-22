# Build stage
FROM golang:1.23-rc-alpine AS builder

RUN apk add --no-cache gcc musl-dev git
RUN go install github.com/a-h/templ/cmd/templ@latest

WORKDIR /app
COPY . .
RUN go mod download
RUN templ generate
RUN CGO_ENABLED=1 go build -o main .

# Final stage
FROM alpine:latest

WORKDIR /app
COPY --from=builder /app/main .
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views

EXPOSE 80
CMD ["./main"]
