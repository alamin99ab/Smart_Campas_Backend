# 🚀 SMART CAMPUS SaaS - PRODUCTION DEPLOYMENT GUIDE

## 📋 OVERVIEW

This guide provides comprehensive instructions for deploying the Smart Campus SaaS system to production with industry-level standards, security, and scalability.

## 🏗️ SYSTEM REQUIREMENTS

### Minimum Requirements
- **Node.js**: 18.0.0 or higher
- **MongoDB**: 5.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 50GB SSD minimum
- **CPU**: 2 cores minimum, 4 cores recommended

### Recommended Production Setup
- **Node.js**: 20.x LTS
- **MongoDB Atlas** (or MongoDB 6.0+ with replica set)
- **Redis**: 6.0+ for caching
- **Nginx**: Reverse proxy
- **SSL/TLS**: Let's Encrypt or custom certificate
- **Monitoring**: PM2 or Docker

## 🔧 ENVIRONMENT CONFIGURATION

### 1. Environment Variables Setup

Copy the example environment file:
```bash
cp .env.example .env
```

### 2. Required Production Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=5000

# Database (Required)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority

# JWT Security (Required)
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters_long_here
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_minimum_32_characters_long_here
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=7d

# Frontend URL (Required)
FRONTEND_URL=https://yourdomain.com
USE_COOKIE=false

# Email Service (Required)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# File Storage (Required)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# AI Features (Optional)
OPENAI_API_KEY=your_openai_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
ENABLE_AI_FEATURES=true

# Security (Required)
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### 3. Security Configuration

Generate secure JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📦 DEPLOYMENT METHODS

### Method 1: PM2 Deployment (Recommended)

#### Install PM2
```bash
npm install -g pm2
```

#### Create PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'smart-campus-api',
    script: 'index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

#### Deploy with PM2
```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

# Monitor application
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart smart-campus-api
```

### Method 2: Docker Deployment

#### Build Docker Image
```bash
docker build -t smart-campus-api .
```

#### Run with Docker
```bash
docker run -d \
  --name smart-campus-api \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  smart-campus-api
```

#### Docker Compose
Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    restart: unless-stopped
    depends_on:
      - mongodb
      - redis

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:6.0-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
```

Deploy with Docker Compose:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Method 3: Cloud Platform Deployment

#### Heroku Deployment
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-smart-campus

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGO_URI=your_mongodb_uri
heroku config:set JWT_SECRET=your_jwt_secret
# ... set other variables

# Deploy
git add .
git commit -m "Deploy to production"
git push heroku main
```

#### AWS Elastic Beanstalk
```bash
# Install EB CLI
npm install -g awsebcli

# Initialize EB
eb init smart-campus-api

# Create environment
eb create production

# Deploy
eb deploy
```

## 🔒 SECURITY CONFIGURATION

### 1. Nginx Reverse Proxy

Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream smartcampus {
        server localhost:5000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://smartcampus;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Health check
        location /api/health {
            proxy_pass http://smartcampus;
            access_log off;
        }
    }
}
```

### 2. SSL Certificate Setup

#### Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Firewall Configuration
```bash
# Allow necessary ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 📊 MONITORING & LOGGING

### 1. Application Monitoring

#### PM2 Monitoring
```bash
# Monitor application
pm2 monit

# Check status
pm2 status

# View metrics
pm2 show smart-campus-api
```

#### Health Check Endpoint
```bash
curl https://yourdomain.com/api/health
```

### 2. Log Management

#### Log Rotation
Create `/etc/logrotate.d/smart-campus`:
```
/path/to/your/app/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. Error Tracking

#### Sentry Integration (Optional)
```bash
npm install @sentry/node
```

Add to `index.js`:
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: process.env.NODE_ENV,
});
```

## 🗄️ DATABASE SETUP

### MongoDB Atlas (Recommended)

1. Create MongoDB Atlas account
2. Create cluster
3. Configure network access
4. Create database user
5. Get connection string
6. Update `MONGO_URI` in `.env`

### Self-Hosted MongoDB

#### Replica Set Setup
```bash
# Initialize replica set
mongo --eval "rs.initiate()"

# Check replica set status
mongo --eval "rs.status()"
```

## 🔄 BACKUP STRATEGY

### 1. Database Backup
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGO_URI" --out="/backups/mongodb_$DATE"

# Keep only last 7 days
find /backups -name "mongodb_*" -mtime +7 -exec rm -rf {} \;
```

#### Cron Job for Daily Backup
```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

### 2. File Backup
```bash
# Backup application files
tar -czf /backups/app_$(date +%Y%m%d_%H%M%S).tar.gz /path/to/app
```

## 🚀 PERFORMANCE OPTIMIZATION

### 1. Database Indexing
```javascript
// Create indexes in MongoDB
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ schoolId: 1, role: 1 });
db.notices.createIndex({ schoolId: 1, publishDate: -1 });
db.attendance.createIndex({ studentId: 1, date: -1 });
```

### 2. Caching Strategy
```javascript
// Redis caching example
const redis = require('redis');
const client = redis.createClient();

// Cache frequently accessed data
app.get('/api/schools', async (req, res) => {
  const cacheKey = 'schools:list';
  const cached = await client.get(cacheKey);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  const schools = await School.find({});
  await client.setex(cacheKey, 3600, JSON.stringify(schools));
  res.json(schools);
});
```

### 3. CDN Configuration
```javascript
// Serve static files via CDN
const CDN_URL = process.env.CDN_URL || '';

app.use('/uploads', express.static('uploads', {
  maxAge: '1y',
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));
```

## 🧪 TESTING IN PRODUCTION

### 1. Health Check Script
```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="https://yourdomain.com/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Service is healthy"
else
    echo "❌ Service is unhealthy (HTTP $RESPONSE)"
    # Send alert or restart service
    pm2 restart smart-campus-api
fi
```

### 2. Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test-config.yml
```

## 📱 SCALING CONSIDERATIONS

### 1. Horizontal Scaling
- Use load balancer (Nginx, AWS ALB)
- Deploy multiple instances
- Implement session clustering

### 2. Database Scaling
- Read replicas for read-heavy operations
- Sharding for large datasets
- Connection pooling

### 3. Caching Layers
- Redis for session storage
- CDN for static assets
- Application-level caching

## 🔧 MAINTENANCE

### 1. Regular Updates
```bash
# Update dependencies monthly
npm update
npm audit fix

# Security patches
npm audit
```

### 2. Monitoring Dashboard
- Set up Grafana for metrics
- Configure alerts for downtime
- Monitor resource usage

### 3. Backup Verification
```bash
# Test backup restoration
mongorestore --uri="$MONGO_URI" --drop /backups/mongodb_latest
```

## 🚨 TROUBLESHOOTING

### Common Issues

#### 1. Database Connection
```bash
# Check MongoDB connection
mongo "$MONGO_URI" --eval "db.adminCommand('ismaster')"
```

#### 2. Memory Issues
```bash
# Check memory usage
pm2 monit

# Increase memory limit
pm2 delete smart-campus-api
pm2 start ecosystem.config.js --node-args="--max-old-space-size=2048"
```

#### 3. SSL Certificate Issues
```bash
# Check certificate expiry
openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout | grep "Not After"

# Renew certificate
sudo certbot renew
```

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Error tracking setup

### Post-Deployment
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Team training completed

## 🎯 PRODUCTION READINESS

Your Smart Campus SaaS system is production-ready when:

✅ **Security**: All security measures implemented
✅ **Performance**: Optimized for expected load
✅ **Scalability**: Can handle growth
✅ **Monitoring**: Health checks and alerts active
✅ **Backup**: Automated backup system
✅ **Documentation**: Complete deployment guide
✅ **Testing**: Comprehensive test suite passing

## 🚀 GO LIVE!

Once all checks are complete, you're ready to deploy to production:

```bash
# Final deployment
pm2 start ecosystem.config.js

# Verify deployment
curl https://yourdomain.com/api/health

# Monitor
pm2 monit
```

**Congratulations! Your Smart Campus SaaS is now live in production!** 🎉
