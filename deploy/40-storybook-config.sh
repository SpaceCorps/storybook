#!/bin/sh
# Writes the nginx server config at container start.
#
# The design system is private, so the site is behind HTTP basic auth by default. Set
# STORYBOOK_USER and STORYBOOK_PASSWORD (a Sliplane secret env var) to choose the login. The
# container refuses to start without a password unless STORYBOOK_PUBLIC=1 says the site is meant
# to be open. /healthz is always open so the host's health check works.
set -eu

AUTH=""
if [ "${STORYBOOK_PUBLIC:-0}" != "1" ]; then
  if [ -z "${STORYBOOK_PASSWORD:-}" ]; then
    echo "STORYBOOK_PASSWORD is not set. Set it, or set STORYBOOK_PUBLIC=1 to serve without a login." >&2
    exit 1
  fi
  USER_NAME="${STORYBOOK_USER:-spacecorps}"
  HASH="$(printf '%s' "$STORYBOOK_PASSWORD" | openssl passwd -apr1 -stdin)"
  printf '%s:%s\n' "$USER_NAME" "$HASH" > /etc/nginx/.htpasswd
  # The worker processes run as `nginx`, so the group must be able to read the hash.
  chown root:nginx /etc/nginx/.htpasswd
  chmod 640 /etc/nginx/.htpasswd
  AUTH='auth_basic "SpaceCorps Storybook"; auth_basic_user_file /etc/nginx/.htpasswd;'
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
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
    auth_basic off;
    default_type text/plain;
    return 200 "ok";
  }

  location / {
    ${AUTH}
    try_files \$uri \$uri/ /index.html;
  }

  # Hashed build assets never change, so let browsers keep them.
  location /assets/ {
    ${AUTH}
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options nosniff always;
  }
}
EOF
