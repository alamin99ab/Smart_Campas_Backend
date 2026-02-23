# 🎓 Smart Campus Backend API

## 📋 Overview

Smart Campus Backend is a comprehensive REST API for educational institution management. Built with Node.js, Express, and MongoDB, it provides complete functionality for managing schools, users, academics, and administrative tasks.

## 🚀 Features

### 🔐 Authentication & Security
- JWT-based authentication with refresh tokens
- Role-based access control (Super Admin, Principal, Teacher, Student)
- Password hashing with bcrypt
- Rate limiting and security middleware
- Input validation and sanitization

### 👥 User Management
- Multi-role user system
- Profile management
- Session tracking
- Device management
- Two-factor authentication support

### 🏫 School Management
- School registration and management
- Subscription management
- Principal assignment
- School information management

### 📚 Academic Management
- Class and subject management
- Teacher-student assignments
- Grade management
- Attendance tracking
- Examination management

### 📢 Communication
- Notice board system
- SMS notifications (Twilio)
- Email notifications
- Public announcements

### 💳 Financial Management
- Fee collection and tracking
- Payment receipts
- Financial reporting
- Invoice generation

### 📊 Analytics & Reporting
- System analytics
- Performance reports
- Export functionality (Excel, PDF)
- Data visualization support

## 🛠️ Tech Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting
- **File Upload**: Multer + Cloudinary
- **Email**: Nodemailer
- **SMS**: Twilio
- **Logging**: Winston
- **Documentation**: Comprehensive API docs

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm 8+
- MongoDB 5.0+ or MongoDB Atlas
- Git

### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd smart-campus-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Start production server
npm start
```

## ⚙️ Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
# Server
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Cloudinary (File Upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 📚 API Documentation

### Base URL
- **Development**: `http://localhost:5000/api`
- **Production**: `https://your-domain.com/api`

### Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### 🔐 Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile

#### 👥 Users
- `GET /users` - Get all users (Admin)
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

#### 🏫 Schools
- `GET /schools` - Get all schools
- `POST /schools` - Create school
- `PUT /schools/:id` - Update school
- `DELETE /schools/:id` - Delete school

#### 📚 Academics
- `GET /classes` - Get all classes
- `POST /classes` - Create class
- `GET /subjects` - Get all subjects
- `POST /subjects` - Create subject

#### 📢 Notices
- `GET /notices` - Get all notices
- `POST /notices` - Create notice
- `PUT /notices/:id` - Update notice
- `DELETE /notices/:id` - Delete notice

#### 📊 System
- `GET /system/status` - System health check
- `GET /system/analytics` - System analytics
- `GET /system/dashboard` - Dashboard data

### Public Endpoints (No Authentication)
- `GET /public/notices/:schoolCode` - Public notices
- `GET /public/results/:schoolCode` - Public results
- `GET /public/school-info/:schoolCode` - School information

## 🎯 Default Credentials

### Super Admin Account
- **Email**: `superadmin@smartcampus.com`
- **Password**: `SuperAdmin@2026`
- **School Code**: `SMART2026`

## 🚀 Deployment

### Production Setup
See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy Options

#### Render (Recommended)
```bash
# Connect repository to Render
# Auto-deploy on push to main branch
```

#### Heroku
```bash
heroku create your-app-name
heroku config:set NODE_ENV=production
git push heroku main
```

#### Docker
```bash
# Build image
docker build -t smart-campus-backend .

# Run container
docker run -p 5000:5000 --env-file .env smart-campus-backend
```

## 📊 Project Structure

```
smart-campus-backend/
├── config/              # Configuration files
├── controllers/         # Route controllers
├── middleware/          # Custom middleware
├── models/             # MongoDB models
├── routes/             # API routes
├── scripts/            # Utility scripts
├── utils/              # Helper functions
├── uploads/            # File uploads (temporary)
├── logs/              # Application logs
├── .env.example        # Environment template
├── index.js           # Application entry point
├── Dockerfile         # Docker configuration
└── package.json       # Dependencies and scripts
```

## 🔧 Development

### Available Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests
npm run health      # Health check
```

### Testing
```bash
# Health check
curl http://localhost:5000/api/health

# Test authentication
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@smartcampus.com","password":"SuperAdmin@2026","schoolCode":"SMART2026"}'
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Comprehensive input sanitization
- **CORS Protection**: Cross-origin resource sharing control
- **Helmet.js**: Security headers
- **Password Hashing**: Secure password storage
- **Role-Based Access**: Granular permission control

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the [documentation](./PRODUCTION_DEPLOYMENT.md)
- Review API endpoints and examples

## 🎯 Roadmap

### Version 1.1
- [ ] Mobile app API endpoints
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Real-time notifications

### Version 1.2
- [ ] AI-powered features
- [ ] Advanced reporting
- [ ] Integration with third-party services
- [ ] Performance optimizations

---

## 🎊 Ready to Use!

Your Smart Campus Backend API is production-ready and fully documented! 

**🚀 Deploy now and start managing your educational institution efficiently!**

### Quick Links:
- 📖 [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- 🔧 [Environment Configuration](./.env.example)
- 📊 [API Endpoints](#api-documentation)
- 🎯 [Default Credentials](#default-credentials)
