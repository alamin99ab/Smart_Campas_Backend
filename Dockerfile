# 🚀 SMART CAMPUS API - PRODUCTION READY
# Single-stage build for simplicity and reliability

FROM node:18-alpine

# Install security updates and dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Ensure production mode and install only runtime dependencies
ENV NODE_ENV=production
RUN npm install --omit=dev && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S smartcampus -u 1001 -G nodejs

# Create necessary directories and set ownership
RUN mkdir -p /app/logs /app/uploads /app/temp /app/certs && \
    chown -R smartcampus:nodejs /app

# Set permissions
RUN chmod -R 755 /app && \
    chmod -R 777 /app/logs /app/uploads /app/temp /app/certs

# Switch to non-root user
USER smartcampus

# Health check - uses PORT env var
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Expose port (Render uses PORT env var)
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]

# Labels for metadata
LABEL maintainer="Smart Campus Development Team" \
      version="5.0.0" \
      description="Smart Campus Backend API" \
      org.smartcampus.name="smart-campus-backend" \
      org.smartcampus.version="5.0.0"
