# Smart School Management System - Production Deployment Guide

## 🚀 Quick Deployment Options

### Option 1: Deploy to Render (Recommended - Easiest)
**Time: 5 minutes**

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Production ready"
   git push origin main
   ```

2. **Create Render Account:**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub
   - Click "New Web Service"
   - Connect your repository

3. **Configure Environment Variables:**
   ```
   NODE_ENV=production
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
   FRONTEND_URL=https://your-frontend-domain.com
   ```

4. **Deploy:**
   - Render automatically builds from `render.yaml`
   - Health check: `https://your-app.onrender.com/api/health`

---

### Option 2: Deploy with Docker
**Time: 10 minutes**

1. **Build Docker Image:**
   ```bash
   docker build -t smart-school-api .
   ```

2. **Run Container:**
   ```bash
   docker run -p 3001:3001 \
     -e NODE_ENV=production \
     -e PORT=3001 \
     -e MONGO_URI=your_mongodb_uri \
     -e JWT_SECRET=your_jwt_secret \
     -e JWT_REFRESH_SECRET=your_refresh_secret \
     smart-school-api
   ```

3. **Test:**
   ```bash
   curl http://localhost:3001/api/health
   ```

---

### Option 3: Deploy with Docker Compose
**Time: 10 minutes**

1. **Create .env file:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Start Services:**
   ```bash
   docker-compose up -d
   ```

3. **Check Logs:**
   ```bash
   docker-compose logs -f
   ```

---

## 📋 Required Environment Variables

### Core Variables (Required)
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | `min-32-characters-secret` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `min-32-characters-secret` |

### Security Variables (Recommended)
| Variable | Description | Default |
|----------|-------------|---------|
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Optional Variables
| Variable | Description | Required? |
|----------|-------------|-----------|
| `FRONTEND_URL` | Your frontend URL | For CORS |
| `EMAIL_HOST` | SMTP server | Optional |
| `EMAIL_USER` | SMTP username | Optional |
| `EMAIL_PASS` | SMTP password | Optional |
| `CLOUDINARY_*` | Cloud storage | For uploads |

---

## 🔍 Pre-Deployment Checklist

### ✅ Code Quality
- [ ] All tests passing
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Environment variables configured
- [ ] .env.example updated

### ✅ Security
- [ ] JWT secrets are strong (min 32 chars)
- [ ] MongoDB URI uses authentication
- [ ] CORS configured for frontend domain
- [ ] Rate limiting enabled
- [ ] Input validation working

### ✅ Database
- [ ] MongoDB Atlas cluster created
- [ ] Database user with proper permissions
- [ ] IP whitelist configured (0.0.0.0/0 for Render)
- [ ] Backup strategy in place

### ✅ Monitoring
- [ ] Health check endpoint working
- [ ] Error logging configured
- [ ] Performance monitoring setup

---

## 🧪 Testing Production Deployment

### 1. Health Check
```bash
curl https://your-app.onrender.com/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "Smart School API is running",
  "version": "5.0.0",
  "environment": "production"
}
```

### 2. Authentication Test
```bash
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"${SUPER_ADMIN_EMAIL}","password":"${SUPER_ADMIN_PASSWORD}"}'
```

**Note:** Replace with your actual credentials from environment variables.

### 3. Database Connection Test
```bash
curl https://your-app.onrender.com/api/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🛠️ Troubleshooting

### Issue: "Cannot connect to MongoDB"
**Solution:**
1. Check MONGO_URI format: `mongodb+srv://username:password@cluster.mongodb.net/dbname`
2. Whitelist 0.0.0.0/0 in MongoDB Atlas
3. Verify database user credentials

### Issue: "JWT errors"
**Solution:**
1. Ensure JWT_SECRET is at least 32 characters
2. Check JWT_SECRET and JWT_REFRESH_SECRET are different
3. Verify token format in requests: `Authorization: Bearer TOKEN`

### Issue: "CORS errors"
**Solution:**
1. Set FRONTEND_URL to your actual frontend domain
2. Check ALLOWED_ORIGINS includes your domain
3. Verify CORS middleware is configured

### Issue: "Build fails on Render"
**Solution:**
1. Check Dockerfile is in root directory
2. Verify package.json has start script
3. Check render.yaml syntax
4. View build logs in Render dashboard

---

## 📊 Performance Optimization

### Database
- Use MongoDB Atlas (managed service)
- Enable database monitoring
- Set up automated backups
- Use connection pooling

### Application
- Enable gzip compression (done in index.js)
- Use Redis for caching (optional)
- Implement request rate limiting
- Monitor memory usage

### Docker
- Use multi-stage builds (Dockerfile already optimized)
- Run as non-root user
- Keep image size small
- Use .dockerignore

---

## 🔐 Security Best Practices

1. **Never commit .env files**
2. **Use strong JWT secrets** (min 32 characters)
3. **Enable HTTPS** (Render provides this automatically)
4. **Set up rate limiting** (already configured)
5. **Validate all inputs** (implemented)
6. **Use bcrypt for passwords** (12 rounds)
7. **Monitor for suspicious activity**

---

## 📞 Post-Deployment

### Super Admin Credentials
```
Email: ${SUPER_ADMIN_EMAIL} (from .env file)
Password: ${SUPER_ADMIN_PASSWORD} (from .env file)
Default: admin@school.local / ChangeMe123!
```

**⚠️ IMPORTANT:** Change default credentials in production by setting environment variables:
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

### API Base URL
```
https://your-app.onrender.com/api
```

### Health Check
```
https://your-app.onrender.com/api/health
```

---

## 🔄 Continuous Deployment

### Automatic Deploys (Render)
- Push to `main` branch
- Render automatically rebuilds and deploys
- Health checks ensure zero-downtime

### Manual Deploy
```bash
# Build and push Docker image
docker build -t your-dockerhub/smart-school-api .
docker push your-dockerhub/smart-school-api

# Deploy to server
ssh your-server "docker pull your-dockerhub/smart-school-api && docker-compose up -d"
```

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Production Checklist](https://nodejs.org/en/docs/guides/production/)

---

**🎉 Your Smart School API is ready for production!**
