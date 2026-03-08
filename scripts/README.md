# 📁 Scripts Directory

This directory contains utility scripts for the Smart Campus SaaS platform.

## 🚀 Available Scripts

### 1. Add Super Admin Script (`add-super-admin.js`)

**Complete script with advanced features for creating super admin users.**

#### Features:
- ✅ Creates super admin with proper role and permissions
- ✅ Validates existing super admin and prevents duplicates
- ✅ Force update option with `--force` flag
- ✅ Multiple admin creation with `--multiple` flag
- ✅ Proper password hashing with bcrypt
- ✅ Detailed console output with colors
- ✅ Error handling and validation
- ✅ Database connection management

#### Usage:
```bash
# Create default super admin
npm run admin-full

# Force update existing super admin
npm run setup-admin

# Create multiple super admins
node scripts/add-super-admin.js --multiple

# Show help
node scripts/add-super-admin.js --help
```

#### Default Credentials:
- **Email:** `alamin@admin.com`
- **Password:** `A12@r12@++`
- **Phone:** `01778060662`
- **Role:** `super_admin`

### 2. Quick Admin Script (`quick-admin.js`)

**Simplified script for quick super admin creation.**

#### Features:
- ⚡ Fast and simple execution
- ✅ Basic super admin creation
- ✅ Automatic duplicate detection
- ✅ Minimal console output

#### Usage:
```bash
# Quick super admin creation
npm run admin

# Direct execution
node scripts/quick-admin.js
```

## 🔧 Prerequisites

Before running any script, ensure:

1. **Environment Variables**: Set up your `.env` file with:
   ```
   MONGO_URI=mongodb+srv://your-connection-string
   BCRYPT_ROUNDS=12
   ```

2. **Database Connection**: MongoDB should be accessible

3. **Dependencies**: Install all required packages:
   ```bash
   npm install
   ```

## 🛡️ Security Features

- **Password Hashing**: Uses bcrypt with 12 rounds
- **Role Validation**: Ensures proper super admin role
- **Email Verification**: Auto-verifies super admin email
- **Approval Status**: Auto-approves super admin account
- **No School Association**: Super admin has no schoolId (platform-wide access)

## 📋 Super Admin Permissions

The created super admin has:
- Platform-wide access to all schools
- Ability to create and manage schools
- User management across all institutions
- System configuration and settings
- Subscription management
- Analytics and reporting access

## ⚠️ Important Notes

1. **Change Default Password**: Always change the default password after first login
2. **Single Super Admin**: Typically only one super admin is needed
3. **Backup Database**: Consider backing up your database before running scripts
4. **Environment Specific**: Use different credentials for production

## 🔍 Troubleshooting

### Common Issues:

1. **Connection Error**:
   ```
   ❌ Database connection failed
   ```
   **Solution**: Check MONGO_URI in .env file

2. **Duplicate Email**:
   ```
   ❌ Email already exists
   ```
   **Solution**: Use `--force` flag to update existing admin

3. **Permission Error**:
   ```
   ❌ Permission denied
   ```
   **Solution**: Ensure proper database access rights

### Debug Mode:
For detailed debugging, modify the script to enable verbose logging.

## 📝 Script Output Examples

### Successful Creation:
```
🚀 Smart Campus SaaS - Add Super Admin Script
================================================

✅ Database connected successfully
🔍 Checking if super admin already exists...
🔐 Hashing password...
👤 Creating super admin user...
✅ Super admin created successfully!

📋 Super Admin Details:
   Name: Alamin Admin
   Email: alamin@admin.com
   Role: super_admin
   Phone: 01778060662
   Approved: true
   Email Verified: true
   Active: true

🔑 Login Credentials:
   Email: alamin@admin.com
   Password: A12@r12@++

⚠️  IMPORTANT: Change the default password after first login!
🌐 You can now login at: http://localhost:5024/api/auth/login

🎉 Script completed successfully!
```

## 🚀 Next Steps

After creating the super admin:

1. **Login**: Use the credentials to access the admin panel
2. **Create Schools**: Start by creating your first school
3. **Assign Principals**: Designate principals for each school
4. **Configure Settings**: Set up platform-wide configurations
5. **Change Password**: Update the default password immediately

## 📞 Support

For issues or questions:
- Check the troubleshooting section above
- Review the main project documentation
- Ensure all environment variables are properly configured
