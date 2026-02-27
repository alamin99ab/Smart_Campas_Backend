# 🚀 NEXT-LEVEL SMART CAMPUS - PRODUCTION READY
# Multi-stage build for optimal image size and security

# Build stage
FROM node:18-alpine AS builder

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
    adduser -S smartcampus -u 1001

# Set ownership
RUN chown -R smartcampus:nodejs /app
USER smartcampus

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=smartcampus:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=smartcampus:nodejs /app/package*.json /app/
COPY --from=builder --chown=smartcampus:nodejs /app/scripts /app/scripts
COPY --from=builder --chown=smartcampus:nodejs /app/services /app/services
COPY --from=builder --chown=smartcampus:nodejs /app/routes /app/routes
COPY --from=builder --chown=smartcampus:nodejs /app/middleware /app/middleware
COPY --from=builder --chown=smartcampus:nodejs /app/models /app/models
COPY --from=builder --chown=smartcampus:nodejs /app/utils /app/utils
COPY --from=builder --chown=smartcampus:nodejs /app/docs /app/docs
COPY --from=builder --chown=smartcampus:nodejs /app/*.js /app/

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /app/temp /app/certs /app/blockchain && \
    chown -R smartcampus:nodejs /app/logs /app/uploads /app/temp /app/certs /app/blockchain

# Set permissions
RUN chmod -R 755 /app && \
    chmod -R 777 /app/logs /app/uploads /app/temp /app/certs /app/blockchain

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

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# Labels for metadata
LABEL maintainer="Smart Campus Development Team" \
      version="3.0.0" \
      description="Next-Level Smart Campus Backend with AI, Blockchain, IoT, and Real-time features" \
      org.smartcampus.name="smart-campus-backend" \
      org.smartcampus.version="3.0.0" \
      features="ai,blockchain,iot,realtime,mobile,security,multilang,microservices"
