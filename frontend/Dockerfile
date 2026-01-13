# Multi-stage build für optimierte Größe
FROM node:20-alpine AS builder

WORKDIR /app

# Package files kopieren
COPY package*.json ./
RUN npm ci --silent

# Source Code kopieren und build
COPY . .
RUN npm run build:prod

# Production Image
FROM nginx:alpine

    # Built application kopieren
    COPY --from=builder /app/www /usr/share/nginx/html

    # Custom nginx config für SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Non-root user für Security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S angular -u 1001
RUN chown -R angular:nodejs /usr/share/nginx/html
RUN chown -R angular:nodejs /var/cache/nginx
RUN chown -R angular:nodejs /var/log/nginx
RUN chown -R angular:nodejs /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown -R angular:nodejs /var/run/nginx.pid

USER angular

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
