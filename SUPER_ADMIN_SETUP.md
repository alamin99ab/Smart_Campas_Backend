# 🔐 Super Admin Setup Guide

## 📋 Methods to Create Super Admin

There are **3 methods** to create a super admin user in the database:

---

## 🚀 Method 1: Using the Setup Script (Recommended)

### Step 1: Set Environment Variables
Create or update your `.env` file:
```bash
MONGO_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority
```

### Step 2: Run the Script
```bash
node scripts/create-super-admin.js
```

### Step 3: Follow the Prompts
The script will:
- Connect to your database
- Check if super admin already exists
- Create new super admin if not exists
- Display credentials

**Output:**
```
✅ Super admin created successfully!

📋 SUPER ADMIN CREDENTIALS:
================================
📧 Email: superadmin@smartcampus.com
🔑 Password: SuperAdmin123!
👤 Name: Super Admin
🎭 Role: super_admin
================================
```

---

## 🌱 Method 2: Using the Seed Script

### Step 1: Run the Seed Script
```bash
node scripts/seed-super-admin.js
```

### Step 2: Script Actions
- Connects to database
- Deletes any existing super admin
- Creates new super admin with default credentials
- Displays login information

---

## 📝 Method 3: Manual Database Insert

### Step 1: Connect to MongoDB
```bash
mongosh "mongodb+srv://your-username:your-password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority"
```

### Step 2: Switch to Database
```javascript
use smartcampus
```

### Step 3: Hash Password (Node.js)
```javascript
const bcrypt = require('bcryptjs');
const password = 'SuperAdmin123!';
const hashedPassword = await bcrypt.hash(password, 12);
console.log(hashedPassword);
```

### Step 4: Insert Super Admin
```javascript
db.users.insertOne({
    name: "Super Admin",
    email: "superadmin@smartcampus.com",
    password: "hashed_password_here",
    role: "super_admin",
    isApproved: true,
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
});
```

---

## 🔑 Default Super Admin Credentials

### Email: `superadmin@smartcampus.com`
### Password: `SuperAdmin123!`
### Role: `super_admin`

---

## 🚨 Important Security Notes

### ⚠️ Change Default Password
After first login, **immediately change** the password:
1. Login with default credentials
2. Go to Profile Settings
3. Change password to a secure one

### 🔐 Recommended Password Format
- Minimum 12 characters
- Include uppercase letters
- Include lowercase letters  
- Include numbers
- Include special characters

### 🛡️ Security Best Practices
1. **Never commit credentials to Git**
2. **Use environment variables for production**
3. **Enable two-factor authentication**
4. **Regular password rotation**
5. **Monitor login attempts**

---

## 🌐 Access Points

### Frontend Login
```
URL: https://your-frontend-domain.com/login
Email: superadmin@smartcampus.com
Password: SuperAdmin123!
```

### API Login
```bash
curl -X POST https://smart-campas-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@smartcampus.com",
    "password": "SuperAdmin123!"
  }'
```

---

## 🔧 Troubleshooting

### ❌ Error: "Super admin already exists"
**Solution:** The script will prompt to update password
```bash
node scripts/create-super-admin.js
# Choose 'y' when prompted to update password
```

### ❌ Error: "MongoDB connection failed"
**Solution:** Check your MONGO_URI in .env file
```bash
# Verify connection string
mongosh "your-mongo-uri"
```

### ❌ Error: "Permission denied"
**Solution:** Ensure MongoDB user has read/write permissions
```bash
# Grant permissions in MongoDB Atlas
# Database Access → User → Edit Privileges
```

### ❌ Error: "Module not found"
**Solution:** Install dependencies
```bash
npm install bcryptjs mongoose
```

---

## 📊 Super Admin Permissions

The super admin has **full platform control**:

### 🏫 School Management
- Create new schools
- Suspend/activate schools
- View all school data
- Manage subscriptions

### 👥 User Management
- Create principals
- Reset passwords
- Manage all users
- View system logs

### 💰 Financial Control
- View revenue analytics
- Manage billing
- Subscription plans
- Payment tracking

### 🔧 System Administration
- Platform settings
- Global notices
- System maintenance
- Database management

---

## 🔄 Updating Super Admin

### Change Email
```javascript
db.users.updateOne(
  { role: "super_admin" },
  { $set: { email: "new-email@domain.com" } }
);
```

### Change Password
```javascript
// First hash new password
const bcrypt = require('bcryptjs');
const newPassword = "NewSecurePassword123!";
const hashedPassword = await bcrypt.hash(newPassword, 12);

// Update in database
db.users.updateOne(
  { role: "super_admin" },
  { $set: { 
      password: hashedPassword,
      passwordChangedAt: new Date()
    }
  }
);
```

### Update Name
```javascript
db.users.updateOne(
  { role: "super_admin" },
  { $set: { name: "New Admin Name" } }
);
```

---

## 📱 Mobile App Access

### React Native Login
```javascript
const loginSuperAdmin = async () => {
  try {
    const response = await fetch('https://smart-campas-backend.onrender.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@smartcampus.com',
        password: 'SuperAdmin123!'
      }),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

---

## 🎯 Next Steps After Setup

1. **✅ Login with super admin credentials**
2. **🔐 Change default password immediately**
3. **🏫 Create your first school**
4. **👤 Assign principal to school**
5. **⚙️ Configure school settings**
6. **📊 Set up subscription plans**
7. **🔔 Test notification system**

---

## 📞 Support

If you encounter issues:

1. **Check MongoDB connection**
2. **Verify environment variables**
3. **Review script permissions**
4. **Check MongoDB Atlas permissions**

**Default credentials are for initial setup only. Change them immediately after first login!** 🔒
