FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy project source code
COPY . .

# Create data directory for volume mounting and set permissions
RUN mkdir -p /app/data && chown -R node:node /app

# Set default production environment variables
ENV NODE_ENV=production \
    PORT=4317 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data

# Run as non-root user for container security
USER node

# Expose application port
EXPOSE 4317

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:4317/api/status').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Entrypoint command
CMD ["npm", "start"]
