# 🔐 Super Admin Setup - Complete Guide

## 📋 Credentials
```
📧 Email: superadmin@smartcampus.com
🔑 Password: SuperAdmin123!
🎭 Role: super_admin
```

## 🚀 Setup Options

### Option 1: Automatic (Recommended for Deployment)
When deployed to Render, the super admin will be created automatically.

### Option 2: MongoDB Shell Setup
1. Open MongoDB Shell: `mongosh`
2. Connect: `mongosh "mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus"`
3. Run the commands from `mongo-shell-script.js`

### Option 3: MongoDB Compass Setup
1. Connect with your connection string
2. Go to `smartcampus` database
3. Go to `users` collection
4. Insert this document:

```json
{
  "name": "Super Admin",
  "email": "superadmin@smartcampus.com",
  "password": "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W",
  "role": "super_admin",
  "isApproved": true,
  "emailVerified": true,
  "isActive": true,
  "createdAt": { "$date": "2024-06-15T00:00:00.000Z" },
  "updatedAt": { "$date": "2024-06-15T00:00:00.000Z" },
  "loginAttempts": 0,
  "isBlocked": false
}
```

## 🌐 Access Information
- **API Base**: https://smart-campas-backend.onrender.com
- **Login API**: https://smart-campas-backend.onrender.com/api/auth/login
- **Health Check**: https://smart-campas-backend.onrender.com/api/health

## 🔐 Security Notes
- Change password after first login
- Enable two-factor authentication
- Never share credentials
- Use HTTPS in production

## 🧪 Test Login
```bash
curl -X POST https://smart-campas-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@smartcampus.com","password":"SuperAdmin123!"}'
```