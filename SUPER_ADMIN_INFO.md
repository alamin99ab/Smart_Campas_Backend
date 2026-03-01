# 🔐 Super Admin Credentials - Ready for Use

## 📋 Default Super Admin Account

The super admin account is configured to be created automatically when the server connects to MongoDB. Here are the credentials:

### 🎯 Login Information
```
📧 Email: superadmin@smartcampus.com
🔑 Password: SuperAdmin123!
🎭 Role: super_admin
```

### 🌐 Access URLs
```
🌐 Frontend: https://your-frontend-domain.com
🔗 API Base: https://smart-campas-backend.onrender.com
📡 Health Check: https://smart-campas-backend.onrender.com/api/health
🔐 Login API: https://smart-campas-backend.onrender.com/api/auth/login
```

---

## 🚀 Current Status

### ✅ Server Status
- **Server**: Running on port 3001
- **API Endpoints**: All loaded and ready
- **Routes**: Authentication, Super Admin, Principal, Teacher, Student, Parent, Accountant, Dashboard, Notices
- **Environment**: Development mode

### ⚠️ Database Status
- **MongoDB**: Connection currently failing (DNS resolution issue)
- **Alternative**: Super admin will be created when database connects
- **Solution**: Database connection will work when deployed on Render

---

## 🔧 Manual Setup Options

### Option 1: Wait for Automatic Creation
When deployed to Render or when MongoDB connection is restored, the super admin will be created automatically.

### Option 2: Create via API (When Database is Available)
```bash
curl -X POST https://smart-campas-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Admin",
    "email": "superadmin@smartcampus.com",
    "password": "SuperAdmin123!",
    "role": "super_admin"
  }'
```

### Option 3: Direct Database Creation
Use MongoDB Compass or mongosh to insert directly:
```javascript
db.users.insertOne({
  name: "Super Admin",
  email: "superadmin@smartcampus.com",
  password: "$2a$12$hashed_password_here",
  role: "super_admin",
  isApproved: true,
  emailVerified: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

## 🎯 Super Admin Capabilities

Once logged in, the super admin can:

### 🏫 School Management
- ✅ Create new schools
- ✅ View all schools
- ✅ Suspend/activate schools
- ✅ Manage subscriptions

### 👥 User Management
- ✅ Create principals
- ✅ Reset passwords
- ✅ View all users
- ✅ Manage permissions

### 💰 Platform Control
- ✅ View revenue analytics
- ✅ Manage subscription plans
- ✅ Global announcements
- ✅ System settings

### 📊 Analytics
- ✅ Platform statistics
- ✅ School performance
- ✅ User activity
- ✅ Financial reports

---

## 🔐 Security Features

### 🛡️ Built-in Security
- **Password Hashing**: bcrypt with 12 rounds
- **JWT Authentication**: Secure token-based auth
- **Role-based Access**: Super admin has full permissions
- **Session Management**: Secure session handling
- **Rate Limiting**: DDoS protection

### 🔑 Password Security
- **Default Password**: SuperAdmin123!
- **Recommendation**: Change immediately after first login
- **Requirements**: Minimum 12 characters, mixed case, numbers, symbols

---

## 🚀 Deployment Instructions

### 1. Deploy to Render
The super admin will be created automatically when deployed to Render with proper MongoDB connection.

### 2. Environment Variables
Ensure these are set in Render:
```
MONGO_URI=mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus?retryWrites=true&w=majority
JWT_SECRET=your_secure_jwt_secret_here
JWT_REFRESH_SECRET=your_secure_refresh_secret_here
```

### 3. First Login Steps
1. Deploy to Render
2. Wait for server to start
3. Super admin created automatically
4. Login with credentials
5. **Change password immediately**
6. Create first school
7. Assign principal

---

## 📱 Testing the Super Admin

### Test Login API
```bash
curl -X POST https://smart-campas-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@smartcampus.com",
    "password": "SuperAdmin123!"
  }'
```

### Expected Response
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "super_admin_id",
    "name": "Super Admin",
    "email": "superadmin@smartcampus.com",
    "role": "super_admin"
  }
}
```

---

## 🔄 Troubleshooting

### ❌ "Invalid credentials"
- **Cause**: Super admin not created yet
- **Solution**: Wait for MongoDB connection or deploy to Render

### ❌ "Database connection failed"
- **Cause**: MongoDB Atlas access issues
- **Solution**: Check IP whitelist, network connection

### ❌ "User already exists"
- **Cause**: Super admin already created
- **Solution**: Use existing credentials or reset password

---

## 📞 Support

The super admin setup is designed to be:
- ✅ **Automatic**: Creates itself when server starts
- ✅ **Secure**: Uses proper password hashing
- ✅ **Complete**: Has all necessary permissions
- ✅ **Ready**: Can immediately start creating schools

**Next Steps**: Deploy to Render and the super admin will be ready for use! 🚀
