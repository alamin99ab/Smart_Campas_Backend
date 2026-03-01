// MongoDB Shell Script - Super Admin Setup
// Run this in MongoDB Shell (mongosh)

// Connect to your database
use smartcampus;

// Hash the password (Node.js required for bcrypt)
// For manual setup, use this pre-hashed password:
const hashedPassword = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W";

// Create super admin user
db.users.insertOne({
    name: "Super Admin",
    email: "superadmin@smartcampus.com",
    password: hashedPassword,
    role: "super_admin",
    isApproved: true,
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    loginAttempts: 0,
    isBlocked: false,
    emailVerificationToken: null,
    resetPasswordToken: null
});

// Verify creation
db.users.findOne({ email: "superadmin@smartcampus.com", role: "super_admin" });

print("✅ Super admin created successfully!");
print("📧 Email: superadmin@smartcampus.com");
print("🔑 Password: SuperAdmin123!");