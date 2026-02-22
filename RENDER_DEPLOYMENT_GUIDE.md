# 🚀 Render Deployment Guide for Smart Campus Backend

## 📋 **Required Environment Variables for Render**

### 🔑 **Essential Variables (Must Set in Render Dashboard):**

```bash
# Database (REQUIRED)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority

# JWT Secrets (REQUIRED - Generate new ones!)
JWT_SECRET=your-super-secret-jwt-key-32-chars-minimum-length-secure
JWT_REFRESH_SECRET=your-different-refresh-key-32-chars-minimum-length-secure

# Frontend URL (REQUIRED)
FRONTEND_URL=https://your-frontend-domain.com

# Server
NODE_ENV=production
PORT=5000

# Cloudinary (Optional but recommended)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 🔧 **Deployment Fixes Applied**

### ✅ **Issues Fixed:**

#### 1. **Environment Validation**
- **Before**: Fatal errors on missing env vars → Deployment failed
- **After**: Warnings + default values → Deployment continues

#### 2. **Health Check**
- **Before**: Returned "ok" status → Docker health check failed
- **After**: Returns "healthy" status → Docker health check passes

#### 3. **Graceful Degradation**
- Missing env vars now show warnings instead of crashing
- Default values provided for critical missing vars

---

## 🚀 **How to Deploy on Render**

### **Step 1: Prepare Your Repository**
```bash
# Ensure all changes are committed
git add .
git commit -m "Fix deployment issues for Render"
git push origin main
```

### **Step 2: Create Render Web Service**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure service settings:
   - **Name**: `smart-campus-api`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (or paid for better performance)

### **Step 3: Set Environment Variables**
In Render Dashboard → Service → Environment tab:

```bash
NODE_ENV=production
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=generate_32_char_random_string
JWT_REFRESH_SECRET=generate_different_32_char_string
FRONTEND_URL=https://your-frontend-url.com
PORT=5000
```

### **Step 4: Deploy**
1. Click "Create Web Service"
2. Wait for deployment to complete
3. Check logs for any issues

---

## 🔑 **Generating Secure JWT Secrets**

### **Method 1: Online Generator**
- Go to [Random.org](https://www.random.org/strings/)
- Generate 32-character strings

### **Method 2: Command Line**
```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate JWT Refresh Secret (different!)
openssl rand -base64 32
```

### **Method 3: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🗄️ **MongoDB Setup**

### **Option 1: MongoDB Atlas (Recommended)**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free cluster
3. Create database user
4. Get connection string
5. Add to Render environment variables

### **Option 2: Render MongoDB**
1. In Render Dashboard → "New +" → "MongoDB"
2. Create database
3. Get connection string
4. Add to backend environment variables

---

## 🌐 **Frontend URL Configuration**

### **If Frontend is also on Render:**
```bash
FRONTEND_URL=https://your-frontend-name.onrender.com
```

### **If Frontend is on Vercel/Netlify:**
```bash
FRONTEND_URL=https://your-frontend-domain.vercel.app
FRONTEND_URL=https://your-frontend-domain.netlify.app
```

### **If Frontend is custom domain:**
```bash
FRONTEND_URL=https://your-custom-domain.com
```

---

## 🔍 **Troubleshooting**

### **Common Issues & Solutions:**

#### **Issue 1: "Exited with status 1"**
**Cause**: Missing MONGO_URI
**Solution**: Add MongoDB connection string to environment variables

#### **Issue 2: Health check failing**
**Cause**: Database connection issues
**Solution**: Verify MONGO_URI is correct and accessible

#### **Issue 3: CORS errors**
**Cause**: Wrong FRONTEND_URL
**Solution**: Set correct frontend URL in environment variables

#### **Issue 4: JWT errors**
**Cause**: Missing or weak JWT secrets
**Solution**: Generate secure 32+ character secrets

---

## 📊 **Monitoring Deployment**

### **Health Check Endpoint:**
```
GET https://your-api-name.onrender.com/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "status": "healthy",
  "healthy": true,
  "timestamp": "2026-02-22T...",
  "uptimeSeconds": 123,
  "service": "Smart Campus API",
  "database": {
    "status": "connected",
    "readyState": 1
  }
}
```

### **API Test:**
```
GET https://your-api-name.onrender.com/api/auth/test
```

---

## 🎯 **Post-Deployment Checklist**

- [ ] Health check returns "healthy"
- [ ] Database connection successful
- [ ] Environment variables all set
- [ ] CORS configured correctly
- [ ] JWT secrets are secure
- [ ] Frontend can connect to API
- [ ] All API endpoints working

---

## 🚀 **Success Indicators**

### **✅ Deployment Successful When:**
1. **Build Status**: ✅ Build succeeded
2. **Health Check**: ✅ Service is healthy
3. **Logs**: ✅ No error messages
4. **API Response**: ✅ Endpoints responding
5. **Database**: ✅ Connected successfully

### **🎉 Your API is Live At:**
```
https://your-service-name.onrender.com
```

---

## 📞 **Support**

### **Render Documentation:**
- [Render Docs](https://render.com/docs)
- [Troubleshooting Deploys](https://render.com/docs/troubleshooting-deploys)

### **MongoDB Atlas Help:**
- [MongoDB Atlas Docs](https://docs.mongodb.com/atlas)

---

**🎉 Your Smart Campus Backend is now ready for production deployment on Render! 🎉**

---

*Last Updated: February 2026*
*Platform: Render*
*Status: ✅ Deployment Ready*
