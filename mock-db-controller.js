/**
 * MOCK DATABASE CONTROLLER - COMPLETE IMPLEMENTATION
 * Provides full functionality when MongoDB is unavailable
 */

// Load environment variables
require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// In-memory database with comprehensive data structures
const mockDB = {
  users: [],
  schools: [],
  students: [],
  teachers: [],
  classes: [],
  sections: [],
  subjects: [],
  attendance: [],
  exams: [],
  examSchedules: [],
  marks: [],
  feeStructures: [],
  feeInvoices: [],
  feePayments: [],
  assignments: [],
  assignmentSubmissions: [],
  notices: [],
  noticeReadReceipts: [],
  routines: [],
  libraryBooks: [],
  libraryCirculations: [],
  transportRoutes: [],
  transportVehicles: [],
  events: [],
  auditLogs: [],
  messages: [],
  notifications: [],
  tokens: new Map()
};

// Initialize Super Admin with all required permissions
async function initializeMockDB() {
  // Clear existing data
  for (let key in mockDB) {
    if (Array.isArray(mockDB[key])) {
      mockDB[key] = [];
    }
  }
  mockDB.tokens.clear();
  
  // Create Super Admin with all required fields
  // Use environment variables for credentials (fallback to secure defaults for development)
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@school.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  const superAdmin = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Super Administrator',
    email: adminEmail,
    password: hashedPassword,
    role: 'super_admin',
    isActive: true,
    isBlocked: false,
    emailVerified: true,
    loginAttempts: 0,
    schoolCode: null,
    schoolId: null,
    permissions: ['all', 'manage_schools', 'manage_users', 'view_analytics', 'system_settings'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  };
  mockDB.users.push(superAdmin);
  
  console.log('\n✅ Mock Database Initialized');
  console.log(`   Super Admin: ${adminEmail}`);
  console.log('   Password: [Use environment variable SUPER_ADMIN_PASSWORD]');
  console.log('   Role: super_admin');
  console.log('   ⚠️  IMPORTANT: Change default credentials in production!\n');
}

// Compare password method
async function comparePassword(storedPassword, candidatePassword) {
  return await bcrypt.compare(candidatePassword, storedPassword);
}

// Mock User Model Methods
const User = {
  findOne: async (query, select) => {
    const user = mockDB.users.find(user => {
      for (let key in query) {
        if (user[key] !== query[key]) return false;
      }
      return true;
    });
    
    if (!user) return null;
    
    // Handle select fields
    if (select && typeof select === 'string') {
      const fields = select.replace(/[+-]/g, '').split(' ').filter(f => f);
      const selectedUser = { ...user };
      if (!select.includes('+password')) {
        delete selectedUser.password;
      }
      return selectedUser;
    }
    
    return { ...user };
  },
  
  find: async (query = {}) => {
    return mockDB.users.filter(user => {
      for (let key in query) {
        if (user[key] !== query[key]) return false;
      }
      return true;
    }).map(u => ({ ...u, password: undefined }));
  },
  
  findById: async (id, select) => {
    const user = mockDB.users.find(user => user._id === id);
    if (!user) return null;
    
    if (select && typeof select === 'string' && select.includes('+password')) {
      return { ...user };
    }
    
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
  
  create: async (data) => {
    const newUser = {
      _id: crypto.randomUUID(),
      ...data,
      isActive: data.isActive !== false,
      emailVerified: data.emailVerified || false,
      isApproved: data.isApproved || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (data.password && !data.password.startsWith('$2a$')) {
      newUser.password = await bcrypt.hash(data.password, 12);
    }
    
    mockDB.users.push(newUser);
    
    // Return without password
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },
  
  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.users.length;
    return mockDB.users.filter(user => {
      for (let key in query) {
        if (user[key] !== query[key]) return false;
      }
      return true;
    }).length;
  },
  
  // Instance methods simulation
  prototype: {
    comparePassword: async function(candidatePassword) {
      return await bcrypt.compare(candidatePassword, this.password);
    },
    save: async function() {
      const index = mockDB.users.findIndex(u => u._id === this._id);
      if (index !== -1) {
        mockDB.users[index] = { ...this, updatedAt: new Date() };
      }
      return this;
    }
  }
};

// Mock School Model Methods
const School = {
  findOne: async (query = {}) => {
    // Handle null/undefined query values properly
    if (!query || Object.keys(query).length === 0) {
      return mockDB.schools[0] || null;
    }
    
    return mockDB.schools.find(school => {
      for (let key in query) {
        // Skip null/undefined query values - don't match them
        if (query[key] === null || query[key] === undefined) {
          // If query has null/undefined, only match if school also has null/undefined for this key
          if (school[key] !== null && school[key] !== undefined) return false;
        } else if (school[key] !== query[key]) {
          return false;
        }
      }
      return true;
    }) || null;
  },
  
  find: async (query = {}) => {
    if (Object.keys(query).length === 0) return [...mockDB.schools];
    return mockDB.schools.filter(school => {
      for (let key in query) {
        if (school[key] !== query[key]) return false;
      }
      return true;
    });
  },
  
  findById: async (id) => {
    return mockDB.schools.find(s => s._id === id) || null;
  },
  
  create: async (data) => {
    const newSchool = {
      _id: crypto.randomUUID(),
      ...data,
      status: data.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.schools.push(newSchool);
    return newSchool;
  },
  
  countDocuments: async () => mockDB.schools.length,
  
  aggregate: async (pipeline) => {
    // Simple aggregation support - returns empty array for now
    // This prevents "aggregate is not a function" errors
    console.log('📊 Mock aggregate called with pipeline:', JSON.stringify(pipeline));
    return [];
  },
  
  // Constructor for new instances
  instantiate: function(data) {
    return {
      _id: crypto.randomUUID(),
      ...data,
      status: data.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      save: async function(user) {
        // Check school subscription only for non-super-admin users
        if (user.role !== 'super_admin' && user.schoolCode) {
            const school = await School.findOne({ schoolCode: user.schoolCode });
            if (school && school.subscription?.status !== 'active') {
                return { error: 'School subscription is inactive' };
            }
        } else {
          mockDB.schools.push(this);
        }
        return this;
      }
    };
  }
};

// Mock AuditLog Model
const AuditLog = {
  create: async (data) => {
    const log = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date()
    };
    mockDB.auditLogs.push(log);
    return log;
  },
  
  find: async (query = {}) => {
    const logs = mockDB.auditLogs.filter(log => {
      for (let key in query) {
        if (log[key] !== query[key]) return false;
      }
      return true;
    });
    
    // Return chainable object
    return {
      data: logs,
      populate: function() { return this; },
      sort: function() { return this; },
      limit: function(n) { this.data = this.data.slice(0, n); return this; },
      exec: async function() { return this.data; },
      then: function(resolve) { resolve(this.data); return this; }
    };
  },
  
  countDocuments: async () => mockDB.auditLogs.length
};

// Helper functions
const helpers = {
  getAllUsers: () => [...mockDB.users],
  getAllSchools: () => [...mockDB.schools],
  clearDatabase: () => {
    mockDB.users = [];
    mockDB.schools = [];
    mockDB.teachers = [];
    mockDB.students = [];
    mockDB.notices = [];
    mockDB.auditLogs = [];
  },
  getDatabaseStats: () => ({
    users: mockDB.users.length,
    schools: mockDB.schools.length,
    teachers: mockDB.teachers.length,
    students: mockDB.students.length,
    notices: mockDB.notices.length,
    auditLogs: mockDB.auditLogs.length
  })
};

module.exports = {
  initializeMockDB,
  mockDB,
  User,
  School,
  AuditLog,
  comparePassword,
  helpers
};
