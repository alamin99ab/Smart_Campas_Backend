# Smart Campus API - Production Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev 2>/dev/null || npm install --production

# Copy application source
COPY . .

# Create logs directory
RUN mkdir -p logs uploads

# Don't run as root
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>process.exit(r.statusCode===200&&d.includes('healthy')?0:1)); }).on('error',()=>process.exit(1));"

ENV NODE_ENV=production
CMD ["node", "index.js"]
