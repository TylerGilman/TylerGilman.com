package config

import (
  "crypto/tls"
  "fmt"
  "net/http"

  "github.com/go-chi/chi/v5"
)

func SetupHTTPSServer(router chi.Router) (*http.Server, error) {
  // Load the Cloudflare Origin certificate and key
  cert, err := tls.LoadX509KeyPair("/home/tgilman/etc/ssl/cloudflare/nereustechnology.net.pem", "/home/tgilman/etc/ssl/cloudflare/nereustechnology.net.key")
  if err != nil {
    return nil, fmt.Errorf("error loading certificate and key: %v", err)
  }

  // Configure the TLS
  tlsConfig := &tls.Config{
    Certificates: []tls.Certificate{cert},
    MinVersion:   tls.VersionTLS12, // Ensure minimum TLS 1.2
  }

  // Create a server with the TLS config
  return &http.Server{
    Addr:      ":443", // HTTPS port
    Handler:   router,
    TLSConfig: tlsConfig,
  }, nil
}
