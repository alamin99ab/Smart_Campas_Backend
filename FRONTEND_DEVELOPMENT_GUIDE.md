# 🚀 Smart Campus SaaS - Frontend Development Guide

## 🛠️ Technology Stack

- **Frontend Framework**: React 18+
- **Styling**: Tailwind CSS 3+
- **State Management**: Redux Toolkit / Context API
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **UI Components**: Headless UI / Lucide Icons
- **Charts**: Chart.js / Recharts
- **Date Handling**: Date-fns
- **Notifications**: React Hot Toast
- **File Upload**: React Dropzone

---

## 📦 Project Setup

### 1. Create React App with Tailwind

```bash
# Create new React app
npx create-react-app smart-campus-frontend --template typescript
cd smart-campus-frontend

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install additional dependencies
npm install @reduxjs/toolkit react-redux react-router-dom
npm install axios react-hook-form @hookform/resolvers zod
npm install @headlessui/react @heroicons/react lucide-react
npm install react-hot-toast date-fns
npm install react-dropzone chart.js react-chartjs-2
npm install @tanstack/react-query
```

### 2. Configure Tailwind CSS

**tailwind.config.js**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        secondary: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

**src/index.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

@layer base {
  body {
    @apply font-sans antialiased;
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
  }
  
  .btn-primary {
    @apply bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500;
  }
  
  .btn-secondary {
    @apply bg-secondary-600 text-white hover:bg-secondary-700 focus:ring-secondary-500;
  }
  
  .btn-danger {
    @apply bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500;
  }
  
  .input {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent;
  }
  
  .card {
    @apply bg-white rounded-xl shadow-sm border border-gray-200;
  }
}
```

---

## 🗂️ Project Structure

```
src/
├── components/           # Reusable components
│   ├── ui/              # Basic UI components
│   ├── forms/           # Form components
│   ├── charts/          # Chart components
│   └── layout/          # Layout components
├── pages/               # Page components
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Dashboard pages
│   ├── students/       # Student management
│   ├── teachers/       # Teacher management
│   ├── classes/        # Class management
│   ├── attendance/     # Attendance pages
│   ├── exams/          # Exam pages
│   ├── fees/           # Fee management
│   ├── notices/        # Notice pages
│   └── ai/             # AI features
├── store/              # Redux store
│   ├── slices/         # Redux slices
│   └── api/            # RTK Query API
├── services/           # API services
├── hooks/              # Custom hooks
├── utils/              # Utility functions
├── types/              # TypeScript types
└── constants/          # Constants
```

---

## 🔧 API Configuration

### 1. API Service Setup

**src/services/api.ts**
```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE_URL = 'https://smart-campas-backend.onrender.com/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
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
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle token refresh or logout
          await this.handleTokenRefresh();
        }
        
        // Show error toast
        const message = error.response?.data?.error?.message || 'Something went wrong';
        toast.error(message);
        
        return Promise.reject(error);
      }
    );
  }

  private async handleTokenRefresh() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        
        const { token } = response.data;
        localStorage.setItem('token', token);
      }
    } catch (error) {
      // Refresh failed, logout user
      this.logout();
    }
  }

  private logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  // HTTP Methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.put(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.delete(url, config);
    return response.data;
  }

  // File upload
  async uploadFile(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post('/upload/upload-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }
}

export const apiService = new ApiService();
```

### 2. API Endpoints

**src/services/endpoints.ts**
```typescript
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },

  // Dashboard
  DASHBOARD: {
    PRINCIPAL: '/principal/dashboard',
    TEACHER: '/teacher/dashboard',
    STUDENT: '/student/dashboard',
    SUPER_ADMIN: '/super-admin/dashboard',
  },

  // Schools
  SCHOOLS: {
    LIST: '/super-admin/schools',
    CREATE: '/super-admin/schools',
    GET: (id: string) => `/super-admin/schools/${id}`,
    UPDATE: (id: string) => `/super-admin/schools/${id}`,
    DELETE: (id: string) => `/super-admin/schools/${id}`,
    SUSPEND: (id: string) => `/super-admin/schools/${id}/suspend`,
    ACTIVATE: (id: string) => `/super-admin/schools/${id}/activate`,
  },

  // Students
  STUDENTS: {
    LIST: '/principal/students',
    CREATE: '/principal/students',
    GET: (id: string) => `/principal/students/${id}`,
    UPDATE: (id: string) => `/principal/students/${id}`,
    DELETE: (id: string) => `/principal/students/${id}`,
    BULK_IMPORT: '/principal/students/bulk-import',
    PROFILE: '/student/profile',
  },

  // Teachers
  TEACHERS: {
    LIST: '/principal/teachers',
    CREATE: '/principal/teachers',
    GET: (id: string) => `/principal/teachers/${id}`,
    UPDATE: (id: string) => `/principal/teachers/${id}`,
    DELETE: (id: string) => `/principal/teachers/${id}`,
    CLASSES: '/teacher/classes',
  },

  // Classes
  CLASSES: {
    LIST: '/principal/classes',
    CREATE: '/principal/classes',
    GET: (id: string) => `/principal/classes/${id}`,
    UPDATE: (id: string) => `/principal/classes/${id}`,
    DELETE: (id: string) => `/principal/classes/${id}`,
    STUDENTS: (id: string) => `/principal/classes/${id}/students`,
  },

  // Attendance
  ATTENDANCE: {
    MARK: '/teacher/attendance/mark',
    GET_CLASS: (classId: string, subjectId: string, date: string) => 
      `/teacher/attendance/${classId}/${subjectId}/${date}`,
    REPORTS: '/principal/attendance/reports',
    STUDENT_HISTORY: '/student/attendance',
  },

  // Exams
  EXAMS: {
    LIST: '/principal/exams',
    CREATE: '/principal/exams',
    GET: (id: string) => `/principal/exams/${id}`,
    UPDATE: (id: string) => `/principal/exams/${id}`,
    DELETE: (id: string) => `/principal/exams/${id}`,
    RESULTS: (id: string) => `/principal/exams/${id}/results`,
    MARKS_ENTRY: '/teacher/marks/entry',
    STUDENT_RESULTS: '/student/results',
  },

  // Fees
  FEES: {
    STRUCTURES: '/principal/fee-structures',
    CREATE_STRUCTURE: '/principal/fee-structures',
    INVOICES: '/principal/invoices',
    GENERATE_INVOICES: '/principal/invoices/generate',
    STUDENT_FEES: '/student/fees',
    STUDENT_INVOICES: '/student/invoices',
  },

  // Notices
  NOTICES: {
    LIST: '/notices',
    CREATE: '/notices',
    GET: (id: string) => `/notices/${id}`,
    UPDATE: (id: string) => `/notices/${id}`,
    DELETE: (id: string) => `/notices/${id}`,
    ACKNOWLEDGE: (id: string) => `/notices/${id}/acknowledge`,
    COMMENT: (id: string) => `/notices/${id}/comments`,
    PIN: (id: string) => `/notices/${id}/pin`,
  },

  // AI Features
  AI: {
    PERFORMANCE: (studentId: string) => `/ai/performance/${studentId}`,
    ATTENDANCE_PREDICTION: (studentId: string) => `/ai/attendance/prediction/${studentId}`,
    GENERATE_QUESTIONS: '/ai/questions/generate',
    GRADING_ASSIST: '/ai/grading/assist',
    LEARNING_PATH: (studentId: string) => `/ai/learning-path/${studentId}`,
    CONTENT_RECOMMEND: (studentId: string) => `/ai/content/recommend/${studentId}`,
    PLAGIARISM_CHECK: '/ai/plagiarism/check',
    SUCCESS_PREDICTION: (studentId: string) => `/ai/success/prediction/${studentId}`,
    CHATBOT: '/ai/chatbot',
    GENERATE_REPORT: '/ai/reports/generate',
  },

  // File Upload
  UPLOAD: {
    FILE: '/upload/upload-file',
  },

  // Health
  HEALTH: '/health',
};
```

---

## 📝 TypeScript Types

**src/types/index.ts**
```typescript
// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'principal' | 'teacher' | 'student' | 'parent' | 'accountant';
  schoolId?: string;
  avatar?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
}

// School Types
export interface School {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  principalId: string;
  subscriptionPlan: 'trial' | 'basic' | 'standard' | 'premium' | 'enterprise';
  status: 'active' | 'suspended' | 'inactive';
  settings: SchoolSettings;
  createdAt: string;
}

export interface SchoolSettings {
  academicYear: string;
  semesterSystem: boolean;
  gradingSystem: 'gpa_4' | 'gpa_5' | 'percentage';
  attendanceThreshold: number;
  workingDays: number[];
  schoolTimings: {
    start: string;
    end: string;
  };
}

// Student Types
export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  classId: string;
  section: string;
  rollNumber: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  admissionDate: string;
  status: 'active' | 'inactive' | 'graduated';
  avatar?: string;
  schoolId: string;
}

// Teacher Types
export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  qualification: string;
  experience: number;
  subjects: string[];
  classes: string[];
  salary: number;
  joiningDate: string;
  status: 'active' | 'inactive';
  avatar?: string;
  schoolId: string;
}

// Class Types
export interface Class {
  id: string;
  name: string;
  section: string;
  sessionId: string;
  classTeacherId?: string;
  capacity: number;
  roomNumber: string;
  currentStrength: number;
  subjects: string[];
  schoolId: string;
}

// Subject Types
export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'core' | 'elective' | 'optional';
  credits: number;
  passingMarks: number;
  totalMarks: number;
  description?: string;
  schoolId: string;
}

// Attendance Types
export interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  subjectId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
  markedBy: string;
  schoolId: string;
}

export interface AttendanceReport {
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
}

// Exam Types
export interface Exam {
  id: string;
  name: string;
  type: 'midterm' | 'final' | 'quiz' | 'assignment';
  classId: string;
  subjectId: string;
  date: string;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  instructions?: string;
  schoolId: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  marks: number;
  percentage: number;
  grade: string;
  gpa?: number;
  remarks?: string;
  submittedBy: string;
  submittedAt: string;
}

// Notice Types
export interface Notice {
  id: string;
  title: string;
  description: string;
  type: 'announcement' | 'exam' | 'holiday' | 'event' | 'urgent';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetAudience: {
    roles: string[];
    classes: string[];
    sections: string[];
  };
  attachments: string[];
  expiryDate?: string;
  isPinned: boolean;
  isGlobal: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  schoolId?: string;
}

// Fee Types
export interface FeeStructure {
  id: string;
  name: string;
  classId: string;
  amount: number;
  type: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  dueDate: number;
  lateFee: number;
  description?: string;
  isActive: boolean;
  schoolId: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  feeStructureId: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  month: string;
  year: number;
  generatedBy: string;
  generatedAt: string;
  paidAt?: string;
}

// AI Types
export interface AIPerformanceAnalysis {
  studentId: string;
  overallPerformance: number;
  subjectPerformance: SubjectPerformance[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  predictions: {
    examPerformance: number;
    successProbability: number;
  };
}

export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  performance: number;
  trend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
}

// Dashboard Types
export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  todayAttendance: number;
  monthlyRevenue?: number;
  pendingTasks?: number;
  upcomingEvents?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentActivities: Activity[];
  upcomingEvents: Event[];
  notices: Notice[];
  todaySchedule?: ScheduleItem[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}
```

---

## 🎨 UI Components

### 1. Button Component

**src/components/ui/Button.tsx**
```typescript
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
        secondary: 'bg-secondary-600 text-white hover:bg-secondary-700 focus:ring-secondary-500',
        danger: 'bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500',
        outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary-500',
        ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-primary-500',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant,
  size,
  loading = false,
  icon,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};
```

### 2. Input Component

**src/components/ui/Input.tsx**
```typescript
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
        error: 'border-danger-500 focus:border-danger-500 focus:ring-danger-500',
      },
      size: {
        sm: 'px-2 py-1 text-sm',
        md: 'px-3 py-2 text-base',
        lg: 'px-4 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  className,
  variant,
  size,
  label,
  error,
  helperText,
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={inputVariants({ variant: error ? 'error' : variant, size, className })}
        {...props}
      />
      {error && (
        <p className="text-sm text-danger-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};
```

### 3. Card Component

**src/components/ui/Card.tsx**
```typescript
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex space-x-2">{actions}</div>}
    </div>
  );
};

export const CardContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};
```

### 4. Table Component

**src/components/ui/Table.tsx**
```typescript
import React from 'react';

interface Column<T> {
  key: keyof T;
  title: string;
  render?: (value: any, item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function Table<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className}`}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.className}`}
                >
                  {column.render
                    ? column.render(item[column.key], item)
                    : item[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 🔐 Authentication Components

### 1. Login Form

**src/pages/auth/Login.tsx**
```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authSlice';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      // Error is handled in the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              create a new account
            </Link>
          </p>
        </div>
        
        <Card>
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-primary-600 hover:text-primary-500"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={loading}
            >
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
```

### 2. Auth Store (Redux)

**src/store/authSlice.ts**
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiService } from '@/services/api';
import { User, AuthResponse } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  loading: false,
  error: null,
  isAuthenticated: !!localStorage.getItem('token'),
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.post<AuthResponse>('/auth/login', credentials);
      
      // Store tokens
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error?.message || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await apiService.post('/auth/logout', {
        refreshToken: localStorage.getItem('refreshToken'),
      });
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      localStorage.clear();
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.get<{ user: User }>('/auth/me');
      return response.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to get user');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      // Get Current User
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export const useAuthStore = () => authSlice;
export default authSlice.reducer;
```

---

## 📊 Dashboard Components

### 1. Dashboard Layout

**src/components/layout/DashboardLayout.tsx**
```typescript
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
```

### 2. Stats Card

**src/components/dashboard/StatsCard.tsx**
```typescript
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  color?: 'primary' | 'secondary' | 'danger' | 'warning';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  color = 'primary',
}) => {
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    secondary: 'bg-secondary-100 text-secondary-600',
    danger: 'bg-danger-100 text-danger-600',
    warning: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <Card>
      <CardContent>
        <div className="flex items-center">
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {change && (
              <p className={`text-sm ${
                change.type === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {change.type === 'increase' ? '↑' : '↓'} {Math.abs(change.value)}%
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

### 3. Principal Dashboard

**src/pages/dashboard/PrincipalDashboard.tsx**
```typescript
import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Users, 
  UserCheck, 
  BookOpen, 
  Calendar,
  DollarSign,
  Bell
} from 'lucide-react';
import { API_ENDPOINTS } from '@/services/endpoints';
import { DashboardData } from '@/types';

export const PrincipalDashboard: React.FC = () => {
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', 'principal'],
    queryFn: () => fetch(API_ENDPOINTS.DASHBOARD.PRINCIPAL).then(res => res.json()),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = dashboardData?.stats;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your school overview.</p>
        </div>
        <Button>
          <Bell className="h-4 w-4 mr-2" />
          New Notice
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Total Students"
          value={stats?.totalStudents || 0}
          icon={Users}
          color="primary"
        />
        <StatsCard
          title="Total Teachers"
          value={stats?.totalTeachers || 0}
          icon={UserCheck}
          color="secondary"
        />
        <StatsCard
          title="Total Classes"
          value={stats?.totalClasses || 0}
          icon={BookOpen}
          color="primary"
        />
        <StatsCard
          title="Total Subjects"
          value={stats?.totalSubjects || 0}
          icon={Calendar}
          color="secondary"
        />
        <StatsCard
          title="Today's Attendance"
          value={`${stats?.todayAttendance || 0}%`}
          icon={UserCheck}
          color="primary"
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${stats?.monthlyRevenue || 0}`}
          icon={DollarSign}
          color="secondary"
        />
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Recent Activities"
            subtitle="Latest activities in your school"
          />
          <CardContent>
            <div className="space-y-4">
              {dashboardData?.recentActivities?.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.title}
                    </p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-sm text-gray-500">
                    {activity.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader
            title="Upcoming Events"
            subtitle="Events scheduled for this week"
          />
          <CardContent>
            <div className="space-y-4">
              {dashboardData?.upcomingEvents?.map((event, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-secondary-100 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-secondary-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {event.title}
                    </p>
                    <p className="text-sm text-gray-500">{event.date}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      event.type === 'exam' ? 'bg-red-100 text-red-800' :
                      event.type === 'holiday' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {event.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Notices */}
      <Card>
        <CardHeader
          title="Recent Notices"
          subtitle="Latest notices and announcements"
          actions={
            <Button variant="ghost" size="sm">
              View All
            </Button>
          }
        />
        <CardContent>
          <div className="space-y-4">
            {dashboardData?.notices?.map((notice, index) => (
              <div key={index} className="border-l-4 border-primary-500 pl-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">{notice.title}</h4>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    notice.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    notice.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    notice.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {notice.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{notice.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(notice.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 📝 Form Components

### 1. Student Form

**src/components/forms/StudentForm.tsx**
```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Student } from '@/types';

const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(1, 'Address is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other']),
  classId: z.string().min(1, 'Class is required'),
  section: z.string().min(1, 'Section is required'),
  rollNumber: z.string().min(1, 'Roll number is required'),
  parentName: z.string().min(1, 'Parent name is required'),
  parentPhone: z.string().min(10, 'Parent phone must be at least 10 digits'),
  parentEmail: z.string().email('Invalid parent email'),
});

type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  initialData?: Partial<Student>;
  onSubmit: (data: StudentFormData) => void;
  loading?: boolean;
  classes: Array<{ id: string; name: string; section: string }>;
}

export const StudentForm: React.FC<StudentFormProps> = ({
  initialData,
  onSubmit,
  loading = false,
  classes,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: initialData,
  });

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                {...register('name')}
                error={errors.name?.message}
              />
              <Input
                label="Email"
                type="email"
                {...register('email')}
                error={errors.email?.message}
              />
              <Input
                label="Phone Number"
                type="tel"
                {...register('phone')}
                error={errors.phone?.message}
              />
              <Input
                label="Date of Birth"
                type="date"
                {...register('dateOfBirth')}
                error={errors.dateOfBirth?.message}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <select
                  {...register('gender')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && (
                  <p className="text-sm text-danger-600">{errors.gender.message}</p>
                )}
              </div>
              <Input
                label="Address"
                {...register('address')}
                error={errors.address?.message}
              />
            </div>
          </div>

          {/* Academic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Academic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Class</label>
                <select
                  {...register('classId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.section}
                    </option>
                  ))}
                </select>
                {errors.classId && (
                  <p className="text-sm text-danger-600">{errors.classId.message}</p>
                )}
              </div>
              <Input
                label="Section"
                {...register('section')}
                error={errors.section?.message}
              />
              <Input
                label="Roll Number"
                {...register('rollNumber')}
                error={errors.rollNumber?.message}
              />
            </div>
          </div>

          {/* Parent Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Parent Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Parent Name"
                {...register('parentName')}
                error={errors.parentName?.message}
              />
              <Input
                label="Parent Phone"
                type="tel"
                {...register('parentPhone')}
                error={errors.parentPhone?.message}
              />
              <Input
                label="Parent Email"
                type="email"
                {...register('parentEmail')}
                error={errors.parentEmail?.message}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" type="button">
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {initialData ? 'Update Student' : 'Create Student'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
```

---

## 📊 Chart Components

### 1. Attendance Chart

**src/components/charts/AttendanceChart.tsx**
```typescript
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AttendanceChartProps {
  data: Array<{
    date: string;
    present: number;
    absent: number;
    percentage: number;
  }>;
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({ data }) => {
  const chartData = {
    labels: data.map(item => new Date(item.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Present',
        data: data.map(item => item.present),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Absent',
        data: data.map(item => item.absent),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Attendance Overview',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <Bar data={chartData} options={options} />
    </div>
  );
};
```

---

## 🎯 Page Examples

### 1. Students List Page

**src/pages/students/StudentList.tsx**
```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { 
  Plus, 
  Search, 
  Filter, 
  Download,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { API_ENDPOINTS } from '@/services/endpoints';
import { Student } from '@/types';
import { format } from 'date-fns';

export const StudentList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data: students, isLoading } = useQuery<{
    data: Student[];
    pagination: any;
  }>({
    queryKey: ['students', page, searchTerm],
    queryFn: () =>
      fetch(`${API_ENDPOINTS.STUDENTS.LIST}?page=${page}&search=${searchTerm}`)
        .then(res => res.json()),
  });

  const columns = [
    {
      key: 'name' as keyof Student,
      title: 'Name',
      render: (value: string, item: Student) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center mr-3">
            <span className="text-primary-600 font-medium text-sm">
              {value.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'rollNumber' as keyof Student,
      title: 'Roll No.',
    },
    {
      key: 'classId' as keyof Student,
      title: 'Class',
      render: (value: string) => (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          Class 10-A
        </span>
      ),
    },
    {
      key: 'phone' as keyof Student,
      title: 'Phone',
    },
    {
      key: 'parentName' as keyof Student,
      title: 'Parent',
    },
    {
      key: 'status' as keyof Student,
      title: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value === 'active' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      ),
    },
    {
      key: 'actions' as keyof Student,
      title: 'Actions',
      render: (value: any, item: Student) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-600">Manage all students in your school</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader
          title={`All Students (${students?.pagination?.total || 0})`}
          subtitle="Manage and view all students"
        />
        <CardContent>
          <Table
            data={students?.data || []}
            columns={columns}
            loading={isLoading}
            emptyMessage="No students found"
          />
          
          {/* Pagination */}
          {students?.pagination && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-700">
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, students.pagination.total)} of{' '}
                {students.pagination.total} results
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!students.pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 🎨 Styling Guidelines

### 1. Color Palette

```css
:root {
  /* Primary Colors */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;

  /* Secondary Colors */
  --color-secondary-50: #f0fdf4;
  --color-secondary-100: #dcfce7;
  --color-secondary-200: #bbf7d0;
  --color-secondary-300: #86efac;
  --color-secondary-400: #4ade80;
  --color-secondary-500: #22c55e;
  --color-secondary-600: #16a34a;
  --color-secondary-700: #15803d;
  --color-secondary-800: #166534;
  --color-secondary-900: #14532d;

  /* Danger Colors */
  --color-danger-50: #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-200: #fecaca;
  --color-danger-300: #fca5a5;
  --color-danger-400: #f87171;
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;
  --color-danger-700: #b91c1c;
  --color-danger-800: #991b1b;
  --color-danger-900: #7f1d1d;

  /* Neutral Colors */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
}
```

### 2. Typography Scale

```css
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-base { font-size: 1rem; line-height: 1.5rem; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.text-2xl { font-size: 1.5rem; line-height: 2rem; }
.text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
.text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
```

### 3. Spacing Scale

```css
.space-1 { margin: 0.25rem; }
.space-2 { margin: 0.5rem; }
.space-3 { margin: 0.75rem; }
.space-4 { margin: 1rem; }
.space-6 { margin: 1.5rem; }
.space-8 { margin: 2rem; }
.space-12 { margin: 3rem; }
.space-16 { margin: 4rem; }
```

---

## 🚀 Deployment Guide

### 1. Build for Production

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test production build
npm run start
```

### 2. Environment Variables

Create `.env.production`:
```env
REACT_APP_API_BASE_URL=https://smart-campas-backend.onrender.com/api
REACT_APP_APP_NAME=Smart Campus
REACT_APP_VERSION=1.0.0
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 4. Deploy to Netlify

```bash
# Build
npm run build

# Deploy build folder to Netlify
```

---

## 📱 Mobile Responsive Design

### 1. Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 640px) {
  .container {
    padding: 0 1rem;
  }
  
  .grid {
    grid-template-columns: 1fr;
  }
}

/* Tablet */
@media (min-width: 641px) and (max-width: 1024px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1025px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 2. Mobile Navigation

**src/components/layout/MobileNavigation.tsx**
```typescript
import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export const MobileNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile menu */}
      {isOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white shadow-lg z-50">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* Mobile menu items */}
            <a href="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
              Dashboard
            </a>
            <a href="/students" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
              Students
            </a>
            {/* Add more menu items */}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 🔧 Development Best Practices

### 1. Code Organization

- Use TypeScript for type safety
- Separate concerns (components, services, types)
- Use custom hooks for reusable logic
- Implement proper error boundaries

### 2. Performance Optimization

- Use React.memo for expensive components
- Implement lazy loading for routes
- Use React Query for data caching
- Optimize bundle size with code splitting

### 3. Accessibility

- Use semantic HTML elements
- Implement ARIA labels
- Ensure keyboard navigation
- Test with screen readers

### 4. Security

- Sanitize user inputs
- Implement CSRF protection
- Use secure cookie settings
- Validate data on both client and server

---

## 📚 Additional Resources

### 1. Documentation Links
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Router Documentation](https://reactrouter.com/)
- [React Hook Form Documentation](https://react-hook-form.com/)

### 2. UI Component Libraries
- [Headless UI](https://headlessui.com/)
- [Radix UI](https://radix-ui.com/)
- [Chakra UI](https://chakra-ui.com/)
- [Mantine](https://mantine.dev/)

### 3. Icon Libraries
- [Lucide React](https://lucide.dev/)
- [Heroicons](https://heroicons.com/)
- [React Icons](https://react-icons.github.io/react-icons/)

---

## 🎉 Conclusion

This comprehensive frontend development guide provides everything needed to build a modern, responsive Smart Campus SaaS frontend using React + Tailwind CSS. The guide includes:

- ✅ Complete project setup and configuration
- ✅ Reusable UI components with TypeScript
- ✅ API integration with proper error handling
- ✅ Authentication and state management
- ✅ Responsive design patterns
- ✅ Form handling and validation
- ✅ Charts and data visualization
- ✅ Mobile-first design approach
- ✅ Performance optimization techniques
- ✅ Security best practices

The frontend is designed to work seamlessly with the deployed backend API at `https://smart-campas-backend.onrender.com/api` and provides a complete user experience for all user roles in the Smart Campus system.

**Happy Coding! 🚀**
