FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o main

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .
COPY ./public ./public
COPY ./views ./views
EXPOSE 443
EXPOSE 80

CMD ["./main"]
