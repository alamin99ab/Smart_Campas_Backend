# 🚀 Smart Campus Backend - Production Deployment Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Deployment Options](#deployment-options)
5. [Security Configuration](#security-configuration)
6. [Monitoring & Logging](#monitoring--logging)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Required Software:
- **Node.js** (v16+)
- **npm** (v8+)
- **MongoDB** (v5.0+) or MongoDB Atlas
- **Git**

### Required Services:
- **MongoDB Database** (MongoDB Atlas recommended)
- **Email Service** (Gmail, SendGrid, etc.)
- **File Storage** (Cloudinary)
- **SMS Service** (Twilio - optional)

---

## 🌍 Environment Setup

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd smart-campus-backend
```

### 2. Install Dependencies
```bash
npm install --production
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit with your production values
nano .env
```

### 4. Required Environment Variables
```bash
# Server
NODE_ENV=production
PORT=5000

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/smartcampus

# JWT Secrets (Use strong secrets!)
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters_long
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_minimum_32_characters_long

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 🗄️ Database Configuration

### MongoDB Atlas (Recommended)
1. **Create Account**: [MongoDB Atlas](https://www.mongodb.com/atlas)
2. **Create Cluster**: Choose M0+ (free tier available)
3. **Configure Network**: Whitelist your server IP
4. **Create Database User**: Secure username and password
5. **Get Connection String**: Copy MongoDB URI

### Connection String Format:
```
mongodb+srv://username:password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority
```

### Local MongoDB (Development Only)
```bash
# Install MongoDB
sudo apt-get install mongodb

# Start Service
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Connection String
MONGO_URI=mongodb://localhost:27017/smartcampus
```

---

## 🚀 Deployment Options

### Option 1: Render (Recommended)

#### 1. Create Render Account
- Visit [render.com](https://render.com)
- Sign up and create new Web Service

#### 2. Configure Service
```yaml
# render.yaml
services:
  - type: web
    name: smart-campus-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
```

#### 3. Deploy
```bash
# Connect GitHub repository
# Render will auto-deploy on push
```

### Option 2: Heroku

#### 1. Install Heroku CLI
```bash
npm install -g heroku
```

#### 2. Create App
```bash
heroku create smart-campus-backend
```

#### 3. Set Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set MONGO_URI=your_mongodb_uri
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set JWT_REFRESH_SECRET=your_refresh_secret
```

#### 4. Deploy
```bash
git push heroku main
```

### Option 3: DigitalOcean App Platform

#### 1. Create App
- Visit [DigitalOcean](https://cloud.digitalocean.com/apps)
- Create new App
- Connect GitHub repository

#### 2. Configure Build
```yaml
# .do/app.yaml
name: smart-campus-backend
services:
- name: web
  source_dir: /
  github:
    repo: your-username/smart-campus-backend
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: 5000
```

### Option 4: VPS/Dedicated Server

#### 1. Server Setup
```bash
# Update System
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Clone Repository
git clone <your-repo-url>
cd smart-campus-backend

# Install Dependencies
npm install --production

# Configure Environment
cp .env.example .env
nano .env
```

#### 2. Start with PM2
```bash
# Start Application
pm2 start index.js --name "smart-campus-backend"

# Save PM2 Configuration
pm2 save

# Setup PM2 Startup
pm2 startup
```

#### 3. Configure Nginx (Optional)
```nginx
# /etc/nginx/sites-available/smart-campus-backend
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔐 Security Configuration

### 1. Environment Security
```bash
# Secure .env file
chmod 600 .env

# Never commit .env to git
echo ".env" >> .gitignore
```

### 2. JWT Security
```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Database Security
- Use strong passwords
- Enable authentication
- Configure IP whitelisting
- Enable SSL/TLS

### 4. API Security
```javascript
// Rate limiting already configured
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 📊 Monitoring & Logging

### 1. Application Logs
```bash
# View PM2 Logs
pm2 logs smart-campus-backend

# View Application Logs
tail -f logs/app.log
```

### 2. Health Check Endpoint
```bash
# Test Health
curl https://your-domain.com/api/health

# Expected Response
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Monitoring Services
- **Render**: Built-in monitoring
- **Heroku**: Metrics and logs
- **DigitalOcean**: App monitoring
- **PM2**: Process monitoring

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Error
```bash
# Check MongoDB URI
echo $MONGO_URI

# Test Connection
mongosh "$MONGO_URI"
```

#### 2. Port Already in Use
```bash
# Find Process
sudo lsof -i :5000

# Kill Process
sudo kill -9 <PID>
```

#### 3. Environment Variables Not Loading
```bash
# Check .env file exists
ls -la .env

# Check permissions
chmod 644 .env
```

#### 4. Memory Issues
```bash
# Check Memory Usage
pm2 monit

# Restart Application
pm2 restart smart-campus-backend
```

### Debug Mode
```bash
# Enable Debug Logging
DEBUG=* npm start

# Or set in .env
DEBUG=*
```

---

## 📋 Pre-Deployment Checklist

### ✅ Security
- [ ] Environment variables configured
- [ ] Strong JWT secrets generated
- [ ] Database credentials secure
- [ ] HTTPS enabled
- [ ] Rate limiting configured

### ✅ Performance
- [ ] Dependencies optimized (`npm install --production`)
- [ ] Database indexes created
- [ ] Caching configured
- [ ] Compression enabled

### ✅ Monitoring
- [ ] Health endpoint accessible
- [ ] Logging configured
- [ ] Error tracking setup
- [ ] Uptime monitoring

### ✅ Backup
- [ ] Database backup strategy
- [ ] File backup strategy
- [ ] Recovery plan documented

---

## 🚀 Deployment Commands

### Quick Deploy (Render)
```bash
git push origin main
# Render auto-deploys
```

### Manual Deploy (VPS)
```bash
# Pull Latest Code
git pull origin main

# Install Dependencies
npm install --production

# Restart Application
pm2 restart smart-campus-backend
```

### Health Check
```bash
# Test API
curl -f https://your-domain.com/api/health || echo "Health check failed"
```

---

## 📞 Support

### Health Check Endpoints:
- **API Health**: `/api/health`
- **System Status**: `/api/system/status`

### Common Ports:
- **API**: 5000
- **MongoDB**: 27017
- **HTTPS**: 443
- **HTTP**: 80

### Log Locations:
- **Application Logs**: `logs/app.log`
- **Error Logs**: `logs/error.log`
- **PM2 Logs**: `~/.pm2/logs/`

---

## 🎯 Production Best Practices

1. **Always use HTTPS** in production
2. **Never commit secrets** to version control
3. **Regularly update dependencies**
4. **Monitor application performance**
5. **Implement backup strategies**
6. **Use environment-specific configurations**
7. **Test thoroughly before deployment**
8. **Implement proper error handling**

---

## 🎉 Success!

Your Smart Campus Backend is now production-ready! 🚀

### Next Steps:
1. Deploy to your chosen platform
2. Configure domain and SSL
3. Set up monitoring
4. Test all endpoints
5. Connect frontend application

### Default Super Admin:
- **Email**: `superadmin@smartcampus.com`
- **Password**: `SuperAdmin@2026`
- **School Code**: `SMART2026`

**🎊 Congratulations! Your Smart Campus system is live!**
