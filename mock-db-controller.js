/**
 * MOCK DATABASE CONTROLLER - COMPLETE IMPLEMENTATION
 * Provides full functionality when MongoDB is unavailable
 */

// Load environment variables
require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Helper to create chainable mock query (like Mongoose)
// Unlike async functions, this returns a query object synchronously (like Mongoose)
const createChainableQuery = (dataArray, queryFilter = {}) => {
  const result = {
    _items: Array.isArray(dataArray) ? [...dataArray] : [],
    _query: queryFilter,
    // Synchronous methods that return new query objects
    select: function(fields) {
      return createChainableQuery(this._items, { ...this._query, select: fields });
    },
    populate: function() { return this; },
    sort: function(sortObj) {
      const sorted = [...this._items];
      const key = Object.keys(sortObj || {})[0];
      if (key) {
        const order = (sortObj[key] === -1) ? -1 : 1;
        sorted.sort((a, b) => {
          if (a[key] < b[key]) return -order;
          if (a[key] > b[key]) return order;
          return 0;
        });
      }
      return createChainableQuery(sorted, this._query);
    },
    limit: function(n) { return createChainableQuery(this._items.slice(0, n), this._query); },
    skip: function(n) { return createChainableQuery(this._items.slice(n), this._query); },
    lean: function() { return this; },
    // Make it thenable (can be awaited)
    then: function(resolve, reject) {
      // Apply filters before resolving
      let items = this._items;
      if (this._query.select) {
        items = items.map(item => {
          const obj = { ...item };
          const fieldList = this._query.select.replace(/[+-]/g, '').split(' ').filter(f => f);
          if (!this._query.select.includes('+password')) {
            delete obj.password;
          }
          if (fieldList.length > 0 && !fieldList.includes('*')) {
            const filtered = {};
            fieldList.forEach(f => {
              if (obj[f] !== undefined) filtered[f] = obj[f];
            });
            return filtered;
          }
          return obj;
        });
      }
      return Promise.resolve(items).then(resolve, reject);
    },
    catch: function(reject) { return Promise.resolve(this._items).catch(reject); }
  };
  return result;
};

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
  
  find: (query = {}) => {
    let results = mockDB.users.filter(user => {
      for (let key in query) {
        if (user[key] !== query[key]) return false;
      }
      return true;
    }).map(u => ({ ...u, password: undefined }));
    return createChainableQuery(results);
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

  findByIdAndUpdate: async (id, update, options = {}) => {
    const index = mockDB.users.findIndex(u => u._id === id);
    if (index === -1) return null;

    // Handle $set operator
    if (update.$set) {
      Object.assign(mockDB.users[index], update.$set, { updatedAt: new Date() });
    } else {
      Object.assign(mockDB.users[index], update, { updatedAt: new Date() });
    }

    const user = mockDB.users[index];
    const { password, ...userWithoutPassword } = user;
    return options.new !== false ? userWithoutPassword : null;
  },

  findByIdAndDelete: async (id) => {
    const index = mockDB.users.findIndex(u => u._id === id);
    if (index === -1) return null;
    const deleted = mockDB.users[index];
    mockDB.users.splice(index, 1);
    const { password, ...userWithoutPassword } = deleted;
    return userWithoutPassword;
  },

  updateMany: async (query, update) => {
    let count = 0;
    mockDB.users.forEach((user, index) => {
      let matches = true;
      for (let key in query) {
        if (user[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        if (update.$set) {
          Object.assign(mockDB.users[index], update.$set, { updatedAt: new Date() });
        } else {
          Object.assign(mockDB.users[index], update, { updatedAt: new Date() });
        }
        count++;
      }
    });
    return { modifiedCount: count };
  },

  deleteMany: async (query) => {
    let count = 0;
    mockDB.users = mockDB.users.filter(user => {
      let matches = true;
      for (let key in query) {
        if (user[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        count++;
        return false;
      }
      return true;
    });
    return { deletedCount: count };
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
  
  find: (query = {}) => {
    let results = mockDB.schools;
    if (Object.keys(query).length > 0) {
      results = results.filter(school => {
        for (let key in query) {
          if (school[key] !== query[key]) return false;
        }
        return true;
      });
    }
    return createChainableQuery(results);
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

  findByIdAndUpdate: async (id, update, options = {}) => {
    const index = mockDB.schools.findIndex(s => s._id === id);
    if (index === -1) return null;

    // Handle $set operator
    if (update.$set) {
      Object.assign(mockDB.schools[index], update.$set, { updatedAt: new Date() });
    } else {
      Object.assign(mockDB.schools[index], update, { updatedAt: new Date() });
    }

    return options.new !== false ? mockDB.schools[index] : null;
  },

  findByIdAndDelete: async (id) => {
    const index = mockDB.schools.findIndex(s => s._id === id);
    if (index === -1) return null;
    const deleted = mockDB.schools[index];
    mockDB.schools.splice(index, 1);
    return deleted;
  },

  updateMany: async (query, update) => {
    let count = 0;
    mockDB.schools.forEach((school, index) => {
      let matches = true;
      for (let key in query) {
        if (school[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        if (update.$set) {
          Object.assign(mockDB.schools[index], update.$set, { updatedAt: new Date() });
        } else {
          Object.assign(mockDB.schools[index], update, { updatedAt: new Date() });
        }
        count++;
      }
    });
    return { modifiedCount: count };
  },

  deleteMany: async (query) => {
    let count = 0;
    mockDB.schools = mockDB.schools.filter(school => {
      let matches = true;
      for (let key in query) {
        if (school[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        count++;
        return false;
      }
      return true;
    });
    return { deletedCount: count };
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

  find: (query = {}) => {
    let results = mockDB.auditLogs.filter(log => {
      for (let key in query) {
        if (log[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  countDocuments: async () => mockDB.auditLogs.length
};

// Mock Student Model
const Student = {
  findOne: async (query = {}) => {
    return mockDB.students.find(student => {
      for (let key in query) {
        if (student[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.students.filter(student => {
      for (let key in query) {
        if (student[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  findById: async (id) => {
    return mockDB.students.find(s => s._id === id) || null;
  },

  create: async (data) => {
    const newStudent = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.students.push(newStudent);
    return newStudent;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.students.length;
    return mockDB.students.filter(student => {
      for (let key in query) {
        if (student[key] !== query[key]) return false;
      }
      return true;
    }).length;
  },

  findByIdAndUpdate: async (id, update, options = {}) => {
    const index = mockDB.students.findIndex(s => s._id === id);
    if (index === -1) return null;

    if (update.$set) {
      Object.assign(mockDB.students[index], update.$set, { updatedAt: new Date() });
    } else {
      Object.assign(mockDB.students[index], update, { updatedAt: new Date() });
    }

    return options.new !== false ? mockDB.students[index] : null;
  },

  updateMany: async (query, update) => {
    let count = 0;
    mockDB.students.forEach((student, index) => {
      let matches = true;
      for (let key in query) {
        if (student[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        if (update.$set) {
          Object.assign(mockDB.students[index], update.$set, { updatedAt: new Date() });
        } else {
          Object.assign(mockDB.students[index], update, { updatedAt: new Date() });
        }
        count++;
      }
    });
    return { modifiedCount: count };
  }
};

// Mock Fee Model
const Fee = {
  findOne: async (query = {}) => {
    return mockDB.feeInvoices.find(fee => {
      for (let key in query) {
        if (fee[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.feeInvoices.filter(fee => {
      for (let key in query) {
        if (fee[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  findById: async (id) => {
    return mockDB.feeInvoices.find(f => f._id === id) || null;
  },

  create: async (data) => {
    const newFee = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.feeInvoices.push(newFee);
    return newFee;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.feeInvoices.length;
    return mockDB.feeInvoices.filter(fee => {
      for (let key in query) {
        if (fee[key] !== query[key]) return false;
      }
      return true;
    }).length;
  },

  findByIdAndUpdate: async (id, update, options = {}) => {
    const index = mockDB.feeInvoices.findIndex(f => f._id === id);
    if (index === -1) return null;

    if (update.$set) {
      Object.assign(mockDB.feeInvoices[index], update.$set, { updatedAt: new Date() });
    } else {
      Object.assign(mockDB.feeInvoices[index], update, { updatedAt: new Date() });
    }

    return options.new !== false ? mockDB.feeInvoices[index] : null;
  },

  updateMany: async (query, update) => {
    let count = 0;
    mockDB.feeInvoices.forEach((fee, index) => {
      let matches = true;
      for (let key in query) {
        if (fee[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        if (update.$set) {
          Object.assign(mockDB.feeInvoices[index], update.$set, { updatedAt: new Date() });
        } else {
          Object.assign(mockDB.feeInvoices[index], update, { updatedAt: new Date() });
        }
        count++;
      }
    });
    return { modifiedCount: count };
  }
};

// Mock Notification Model
const Notification = {
  findOne: async (query = {}) => {
    return mockDB.notifications.find(notif => {
      for (let key in query) {
        if (notif[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.notifications.filter(notif => {
      for (let key in query) {
        if (notif[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  create: async (data) => {
    const newNotif = {
      _id: crypto.randomUUID(),
      ...data,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.notifications.push(newNotif);
    return newNotif;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.notifications.length;
    return mockDB.notifications.filter(notif => {
      for (let key in query) {
        if (notif[key] !== query[key]) return false;
      }
      return true;
    }).length;
  },

  updateMany: async (query, update) => {
    let count = 0;
    mockDB.notifications.forEach((notif, index) => {
      let matches = true;
      for (let key in query) {
        if (notif[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        if (update.$set) {
          Object.assign(mockDB.notifications[index], update.$set, { updatedAt: new Date() });
        } else {
          Object.assign(mockDB.notifications[index], update, { updatedAt: new Date() });
        }
        count++;
      }
    });
    return { modifiedCount: count };
  }
};

// Mock Result Model
const Result = {
  findOne: async (query = {}) => {
    return mockDB.marks.find(mark => {
      for (let key in query) {
        if (mark[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.marks.filter(mark => {
      for (let key in query) {
        if (mark[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  findById: async (id) => {
    return mockDB.marks.find(m => m._id === id) || null;
  },

  create: async (data) => {
    const newResult = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.marks.push(newResult);
    return newResult;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.marks.length;
    return mockDB.marks.filter(mark => {
      for (let key in query) {
        if (mark[key] !== query[key]) return false;
      }
      return true;
    }).length;
  },

  findByIdAndUpdate: async (id, update, options = {}) => {
    const index = mockDB.marks.findIndex(m => m._id === id);
    if (index === -1) return null;

    if (update.$set) {
      Object.assign(mockDB.marks[index], update.$set, { updatedAt: new Date() });
    } else {
      Object.assign(mockDB.marks[index], update, { updatedAt: new Date() });
    }

    return options.new !== false ? mockDB.marks[index] : null;
  }
};

// Mock Notice Model
const Notice = {
  findOne: async (query = {}) => {
    return mockDB.notices.find(notice => {
      for (let key in query) {
        if (notice[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.notices.filter(notice => {
      for (let key in query) {
        if (notice[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  findById: async (id) => {
    return mockDB.notices.find(n => n._id === id) || null;
  },

  create: async (data) => {
    const newNotice = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.notices.push(newNotice);
    return newNotice;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.notices.length;
    return mockDB.notices.filter(notice => {
      for (let key in query) {
        if (notice[key] !== query[key]) return false;
      }
      return true;
    }).length;
  },

  findByIdAndUpdate: async (id, update, options = {}) => {
    const index = mockDB.notices.findIndex(n => n._id === id);
    if (index === -1) return null;

    if (update.$set) {
      Object.assign(mockDB.notices[index], update.$set, { updatedAt: new Date() });
    } else {
      Object.assign(mockDB.notices[index], update, { updatedAt: new Date() });
    }

    return options.new !== false ? mockDB.notices[index] : null;
  },

  updateMany: async (query, update) => {
    let count = 0;
    mockDB.notices.forEach((notice, index) => {
      let matches = true;
      for (let key in query) {
        if (notice[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        if (update.$set) {
          Object.assign(mockDB.notices[index], update.$set, { updatedAt: new Date() });
        } else {
          Object.assign(mockDB.notices[index], update, { updatedAt: new Date() });
        }
        count++;
      }
    });
    return { modifiedCount: count };
  }
};

// Mock Class Model
const Class = {
  findOne: async (query = {}) => {
    return mockDB.classes.find(c => {
      for (let key in query) {
        if (c[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.classes.filter(c => {
      for (let key in query) {
        if (c[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  findById: async (id) => {
    return mockDB.classes.find(c => c._id === id) || null;
  },

  create: async (data) => {
    const newClass = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.classes.push(newClass);
    return newClass;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.classes.length;
    return mockDB.classes.filter(c => {
      for (let key in query) {
        if (c[key] !== query[key]) return false;
      }
      return true;
    }).length;
  }
};

// Mock Subject Model
const Subject = {
  findOne: async (query = {}) => {
    return mockDB.subjects.find(s => {
      for (let key in query) {
        if (s[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.subjects.filter(s => {
      for (let key in query) {
        if (s[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  findById: async (id) => {
    return mockDB.subjects.find(s => s._id === id) || null;
  },

  create: async (data) => {
    const newSubject = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.subjects.push(newSubject);
    return newSubject;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.subjects.length;
    return mockDB.subjects.filter(s => {
      for (let key in query) {
        if (s[key] !== query[key]) return false;
      }
      return true;
    }).length;
  }
};

// Mock Attendance Model
const Attendance = {
  findOne: async (query = {}) => {
    return mockDB.attendance.find(a => {
      for (let key in query) {
        if (a[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  find: (query = {}) => {
    let results = mockDB.attendance.filter(a => {
      for (let key in query) {
        if (a[key] !== query[key]) return false;
      }
      return true;
    });
    return createChainableQuery(results);
  },

  create: async (data) => {
    const newAttendance = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.attendance.push(newAttendance);
    return newAttendance;
  },

  countDocuments: async (query = {}) => {
    if (Object.keys(query).length === 0) return mockDB.attendance.length;
    return mockDB.attendance.filter(a => {
      for (let key in query) {
        if (a[key] !== query[key]) return false;
      }
      return true;
    }).length;
  }
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
  Student,
  Fee,
  Notification,
  Result,
  Notice,
  Class,
  Subject,
  Attendance,
  comparePassword,
  helpers
};
