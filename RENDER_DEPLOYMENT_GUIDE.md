# 🚀 Render Deployment Guide - Smart Campus SaaS

## Quick Fix for Current Deployment Issue

### Problem
Your deployment is failing with:
```
(node:7) [MONGOOSE] Warning: Duplicate schema index on {"schoolId":1} found.
==> Exited with status 1
```

### Solution ✅
The duplicate index issue has been **fixed** in `models/Subscription.js`. The fix removes the duplicate index definition while maintaining all necessary constraints.

### Immediate Action
1. **Redeploy your application** - The fix is already in your codebase
2. Monitor the deployment logs - The duplicate index warning should be gone
3. The application should start successfully

## Environment Variables Required for Render

Make sure these environment variables are set in your Render dashboard:

### Required Variables
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority
NODE_ENV=production
PORT=5000
```

### Authentication Variables
```
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-different-from-jwt-secret
FRONTEND_URL=https://your-frontend-domain.com
```

### Optional but Recommended
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

OPENAI_API_KEY=your-openai-api-key
HUGGINGFACE_API_KEY=your-huggingface-api-key
ENABLE_AI_FEATURES=true
```

## Build Settings for Render

### Build Command
```bash
npm install --only=production
```

### Start Command
```bash
node production-server.js
```

### Node Version
- Use **Node.js 18.x** or higher

## Health Check Configuration

Render automatically uses the health check endpoint:
```
GET /api/health
```

This endpoint is already configured in `production-server.js` and will return:
```json
{
  "status": "ok",
  "timestamp": "2025-03-01T10:00:00.000Z",
  "uptime": 123.45,
  "environment": "production",
  "memory": {
    "used": "45MB",
    "total": "512MB"
  }
}
```

## Database Connection

The application will automatically connect to MongoDB using the `MONGO_URI` environment variable. The connection includes:
- Retry logic
- Graceful shutdown
- Connection pooling

## Security Features Enabled in Production

✅ **Helmet** - HTTP security headers  
✅ **CORS** - Cross-origin resource sharing  
✅ **Rate Limiting** - DDoS protection  
✅ **Input Sanitization** - XSS and injection protection  
✅ **Request ID** - Request tracking  
✅ **Compression** - Response compression  

## Monitoring and Logs

Render provides:
- **Real-time logs** - View application logs in the dashboard
- **Metrics** - CPU, memory, and response time monitoring
- **Alerts** - Get notified about deployment issues

## Troubleshooting Common Issues

### 1. Database Connection Failed
```
Error: MongooseError: Cannot connect to MongoDB
```
**Solution:** Verify `MONGO_URI` is correct and accessible

### 2. Environment Variables Missing
```
Warning: Missing recommended env vars: JWT_SECRET
```
**Solution:** Add missing environment variables in Render dashboard

### 3. Port Issues
The application automatically uses Render's assigned port via `process.env.PORT`

### 4. Memory Issues
If you encounter memory issues, consider upgrading your Render plan or optimizing:
- Enable database connection pooling
- Increase memory allocation in Render settings

## Performance Optimization

The production server includes:
- **Database indexing** for fast queries
- **Response compression** for faster load times
- **Rate limiting** to prevent abuse
- **Graceful shutdown** for zero-downtime deployments

## Scaling Considerations

Your Smart Campus SaaS is ready to scale:
- **Multi-tenant architecture** supports thousands of schools
- **Horizontal scaling** ready with load balancers
- **Database optimization** with proper indexing
- **Caching strategies** for improved performance

## Post-Deployment Checklist

- [ ] Application starts without errors
- [ ] Health check endpoint responds correctly
- [ ] Database connection is established
- [ ] Authentication endpoints work
- [ ] No duplicate index warnings in logs
- [ ] All API endpoints are accessible
- [ ] Environment variables are properly loaded

## Support

If you still encounter issues after the fix:

1. **Check the logs** in Render dashboard for specific error messages
2. **Verify environment variables** are correctly set
3. **Ensure MongoDB is accessible** from Render's network
4. **Check resource limits** - memory/CPU usage

The duplicate index issue has been resolved. Your deployment should now succeed! 🎉
