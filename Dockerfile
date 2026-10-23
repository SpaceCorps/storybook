# Static Storybook for Sliplane: build once, serve with nginx. Sliplane builds this from the `main`
# branch (the release branch), so a merge to main is what publishes a new Storybook.
FROM node:24-slim AS build
WORKDIR /src
RUN corepack enable
COPY . .
RUN corepack prepare pnpm@11.25.0 --activate \
 && pnpm install --frozen-lockfile \
 && pnpm run build-storybook

FROM nginx:1-alpine
RUN apk add --no-cache openssl
COPY --from=build /src/storybook-static /usr/share/nginx/html
# nginx runs every /docker-entrypoint.d/*.sh before it starts; this one writes the server config.
COPY deploy/40-storybook-config.sh /docker-entrypoint.d/40-storybook-config.sh
RUN chmod +x /docker-entrypoint.d/40-storybook-config.sh
EXPOSE 80
