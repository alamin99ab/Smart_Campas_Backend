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

# Install dependencies only for production
RUN npm install --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S smartcampus -u 1001 -G nodejs

# Create necessary directories and set ownership
RUN mkdir -p /app/logs /app/uploads /app/temp /app/certs /app/blockchain && \
    chown -R smartcampus:nodejs /app

# Set permissions
RUN chmod -R 755 /app && \
    chmod -R 777 /app/logs /app/uploads /app/temp /app/certs /app/blockchain

# Switch to non-root user
USER smartcampus

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Security settings
RUN echo "node hard core 1" >> /etc/sysctl.conf && \
    echo "net.ipv4.ip_forward = 0" >> /etc/sysctl.conf

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# Labels for metadata
LABEL maintainer="Smart Campus Development Team" \
      version="4.0.0" \
      description="Smart Campus Backend with AI, Blockchain, IoT, and Real-time features" \
      org.smartcampus.name="smart-campus-backend" \
      org.smartcampus.version="4.0.0" \
      features="ai,blockchain,iot,realtime,mobile,security,multilang,microservices"
