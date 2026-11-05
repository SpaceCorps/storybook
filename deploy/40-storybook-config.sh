#!/bin/sh
# Writes the nginx server config at container start. The site is served openly, with no login.
# /healthz is for the host's health check.
set -eu

cat > /etc/nginx/conf.d/default.conf <<'CONF'
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  server_tokens off;
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;

  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy no-referrer always;
  add_header X-Robots-Tag "noindex, nofollow" always;

  location = /healthz {
    default_type text/plain;
    return 200 "ok";
  }

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Hashed build assets never change, so let browsers keep them.
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options nosniff always;
  }
}
CONF
