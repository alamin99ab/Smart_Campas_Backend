# Smart Campus Frontend Development Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Authentication Integration](#authentication-integration)
6. [API Integration](#api-integration)
7. [Component Development](#component-development)
8. [State Management](#state-management)
9. [Styling & UI](#styling--ui)
10. [Build & Deployment](#build--deployment)
11. [GitHub Setup](#github-setup)

## 🛠️ Prerequisites

### Required Software
```bash
# Node.js (v16 or higher)
node --version

# npm or yarn
npm --version
# or
yarn --version

# Git
git --version
```

### Development Tools
- **VS Code** (Recommended)
- **Chrome DevTools**
- **Postman** (for API testing)
- **MongoDB Compass** (optional)

## 🚀 Project Setup

### 1. Initialize React Project
```bash
# Using Create React App
npx create-react-app smart-campus-frontend
cd smart-campus-frontend

# Or using Vite (Recommended)
npm create vite@latest smart-campus-frontend -- --template react
cd smart-campus-frontend
```

### 2. Install Dependencies
```bash
# Core Dependencies
npm install axios react-router-dom @reduxjs/toolkit react-redux

# UI Components
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
# or
npm install antd @ant-design/icons

# Charts & Visualization
npm install recharts chart.js react-chartjs-2

# Date Handling
npm install dayjs date-fns

# Forms & Validation
npm install react-hook-form @hookform/resolvers yup

# Notifications
npm install react-hot-toast sonner

# File Upload
npm install react-dropzone

# Development Dependencies
npm install -D tailwindcss autoprefixer postcss
```

### 3. Configure Tailwind CSS
```bash
npx tailwindcss init -p
```

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
        },
        secondary: {
          50: '#f8fafc',
          500: '#64748b',
          600: '#475569',
        }
      }
    },
  },
  plugins: [],
}
```

## 🏗️ Technology Stack

### Recommended Stack
```javascript
{
  "framework": "React 18",
  "language": "JavaScript/TypeScript",
  "bundler": "Vite",
  "styling": "Tailwind CSS",
  "ui": "Material-UI or Ant Design",
  "state": "Redux Toolkit",
  "routing": "React Router v6",
  "http": "Axios",
  "forms": "React Hook Form + Yup",
  "charts": "Recharts",
  "date": "Day.js",
  "notifications": "Sonner",
  "deployment": "Vercel/Netlify"
}
```

## 📁 Project Structure

```
smart-campus-frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/          # Reusable components
│   │   ├── common/         # Button, Input, Modal, etc.
│   │   ├── layout/         # Header, Sidebar, Footer
│   │   └── ui/            # Loading, Spinner, etc.
│   ├── pages/              # Page components
│   │   ├── auth/           # Login, Register, Forgot
│   │   ├── dashboard/       # Dashboard
│   │   ├── students/        # Student management
│   │   ├── notices/         # Notice board
│   │   ├── routine/         # Class routine
│   │   ├── attendance/      # Attendance
│   │   ├── results/         # Results
│   │   └── profile/         # User profile
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   ├── store/              # Redux store
│   ├── utils/              # Helper functions
│   ├── constants/          # App constants
│   ├── types/              # TypeScript types
│   └── styles/             # Global styles
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## 🔐 Authentication Integration

### 1. Auth Service Setup
```javascript
// src/services/authService.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken,
          });
          const { token } = response.data;
          localStorage.setItem('token', token);
          // Retry original request
          return api.request(error.config);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  },
  getProfile: () => api.get('/auth/profile'),
};
```

### 2. Auth Context
```javascript
// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    user: null,
    token: localStorage.getItem('token'),
    loading: false,
  });

  const login = async (credentials) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await authService.login(credentials);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

## 🌐 API Integration

### 1. Base API Service
```javascript
// src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Generic request methods
  async get(url, params = {}) {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  async post(url, data = {}) {
    const response = await this.client.post(url, data);
    return response.data;
  }

  async put(url, data = {}) {
    const response = await this.client.put(url, data);
    return response.data;
  }

  async delete(url) {
    const response = await this.client.delete(url);
    return response.data;
  }
}

export const apiService = new ApiService();
```

### 2. Module Services
```javascript
// src/services/studentService.js
import { apiService } from './api';

export const studentService = {
  getStudents: (params = {}) => apiService.get('/students', params),
  getStudent: (id) => apiService.get(`/students/${id}`),
  createStudent: (data) => apiService.post('/students', data),
  updateStudent: (id, data) => apiService.put(`/students/${id}`, data),
  deleteStudent: (id) => apiService.delete(`/students/${id}`),
  getStudentsByClass: (className, section) => 
    apiService.get('/students/by-class', { class: className, section }),
};

// src/services/noticeService.js
export const noticeService = {
  getNotices: (params = {}) => apiService.get('/notices', params),
  getNotice: (id) => apiService.get(`/notices/${id}`),
  createNotice: (data) => apiService.post('/notices', data),
  updateNotice: (id, data) => apiService.put(`/notices/${id}`, data),
  deleteNotice: (id) => apiService.delete(`/notices/${id}`),
};
```

## 🧩 Component Development

### 1. Reusable Components
```jsx
// src/components/common/Button.jsx
import React from 'react';
import { twMerge } from 'tailwind-merge';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '',
  disabled = false,
  onClick,
  ...props 
}) => {
  const baseClasses = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const classes = twMerge(
    baseClasses,
    variants[variant],
    sizes[size],
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );

  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
```

### 2. Layout Components
```jsx
// src/components/layout/Layout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
```

### 3. Page Components
```jsx
// src/pages/students/StudentList.jsx
import React, { useState, useEffect } from 'react';
import { studentService } from '../../services/studentService';
import Button from '../../components/common/Button';
import Loading from '../../components/ui/Loading';

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await studentService.getStudents();
        setStudents(data.students || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Students</h1>
        <Button onClick={() => window.location.href = '/students/add'}>
          Add Student
        </Button>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Class
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Roll
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => (
              <tr key={student._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {student.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {student.studentClass} - {student.section}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {student.roll}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentList;
```

## 📦 State Management

### 1. Redux Store Setup
```javascript
// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import studentSlice from './slices/studentSlice';
import noticeSlice from './slices/noticeSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    students: studentSlice,
    notices: noticeSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 2. Redux Slices
```javascript
// src/store/slices/studentSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { studentService } from '../../services/studentService';

export const fetchStudents = createAsyncThunk(
  'students/fetchStudents',
  async (params, { rejectWithValue }) => {
    try {
      const response = await studentService.getStudents(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const studentSlice = createSlice({
  name: 'students',
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.students || [];
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = studentSlice.actions;
export default studentSlice.reducer;
```

## 🎨 Styling & UI

### 1. Tailwind CSS Configuration
```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

/* Custom components */
.card {
  @apply bg-white rounded-lg shadow-md p-6;
}

.input-field {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500;
}
```

### 2. Component Styling
```jsx
// Using Tailwind classes
<div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
  <h2 className="text-2xl font-bold text-gray-900 mb-4">
    Login
  </h2>
  <input className="input-field mb-4" placeholder="Email" />
  <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
    Sign In
  </button>
</div>
```

## 🚀 Build & Deployment

### 1. Environment Configuration
```bash
# .env.production
VITE_API_URL=https://your-api-domain.com/api
VITE_APP_NAME=Smart Campus
VITE_VERSION=1.0.0
```

### 2. Build Commands
```bash
# Development
npm run dev

# Production Build
npm run build

# Preview Build
npm run preview

# Lint
npm run lint

# Type Check
npm run type-check
```

### 3. Vite Configuration
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

## 📦 GitHub Setup

### 1. Initialize Git Repository
```bash
# Navigate to project directory
cd smart-campus-frontend

# Initialize Git
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: Smart Campus Frontend"
```

### 2. Create GitHub Repository
1. Go to [GitHub](https://github.com)
2. Click "New repository"
3. Repository name: `smart-campus-frontend`
4. Description: `Smart Campus Management System Frontend`
5. Public/Private: Choose as needed
6. Click "Create repository"

### 3. Push to GitHub
```bash
# Add remote origin
git remote add origin https://github.com/yourusername/smart-campus-frontend.git

# Push to GitHub
git push -u origin main

# Or for first time with branch
git push -u origin main --force
```

### 4. GitHub Actions (CI/CD)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID }}
        vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 🚀 Deployment Platforms

### 1. Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or connect GitHub repo in Vercel dashboard for auto-deployment
```

### 2. Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### 3. GitHub Pages
```bash
# Update vite.config.js for GitHub Pages
export default defineConfig({
  base: '/smart-campus-frontend/',
  // ... other config
});

# Build and deploy
npm run build
git add dist
git commit -m "Add build files"
git subtree push --prefix dist origin gh-pages
```

## 📱 Responsive Design

### 1. Mobile-First Approach
```jsx
// Responsive classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards */}
</div>

// Mobile menu
<button className="md:hidden" onClick={toggleMobileMenu}>
  <MenuIcon />
</button>
```

### 2. Breakpoints
```javascript
// tailwind.config.js
theme: {
  screens: {
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    '2xl': '1536px',
  },
}
```

## 🔧 Development Workflow

### 1. Git Workflow
```bash
# Feature branch
git checkout -b feature/student-management
git add .
git commit -m "feat: add student management page"
git push origin feature/student-management

# Create Pull Request
# Review and merge to main
```

### 2. Code Quality
```bash
# ESLint
npm run lint

# Prettier
npm run format

# Type checking
npm run type-check

# Testing
npm test
```

## 📚 Additional Resources

### Documentation
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [React Router](https://reactrouter.com/)

### UI Components
- [Material-UI](https://mui.com/)
- [Ant Design](https://ant.design/)
- [Chakra UI](https://chakra-ui.com/)
- [Headless UI](https://headlessui.com/)

### Icons
- [Heroicons](https://heroicons.com/)
- [Lucide](https://lucide.dev/)
- [React Icons](https://react-icons.github.io/react-icons/)

---

## 🎉 Ready to Build!

This guide provides everything needed to build a production-ready Smart Campus frontend. Follow the steps sequentially and you'll have a fully functional frontend that integrates perfectly with your backend API.

**Next Steps:**
1. Set up the project structure
2. Implement authentication
3. Build core pages (Dashboard, Students, Notices, etc.)
4. Add responsive design
5. Deploy to your preferred platform
6. Connect with the backend API

Good luck building your Smart Campus frontend! 🚀
