# 🚀 Smart Campus SaaS - Production Ready API

## 🎯 Overview

Smart Campus SaaS is a comprehensive educational management platform built with Node.js, Express.js, and MongoDB. It provides complete multi-tenant SaaS architecture for educational institutions worldwide.

## ✨ Features

### 🏫 Multi-Tenant SaaS Architecture
- **6 User Roles**: Super Admin, Principal, Teacher, Student, Parent, Accountant
- **Data Isolation**: Complete school-based data separation
- **Subscription Management**: 5-tier pricing model
- **Scalable Infrastructure**: Ready for thousands of schools

### 📚 Academic Management
- **Class Management**: Multi-class, multi-section support
- **Subject Management**: Complete curriculum setup
- **Routine Management**: Advanced with conflict detection
- **Attendance System**: Subject-wise with analytics
- **Exam & Results**: GPA calculation, marksheet generation

### 💰 Business Features
- **Fee Management**: Complete billing system
- **Notice System**: Targeted communication
- **Analytics Dashboard**: Role-based insights
- **Audit Logging**: Complete activity tracking

### 🤖 AI-Powered Features
- **Student Performance Analysis**: AI-powered insights
- **Attendance Pattern Prediction**: Predictive analytics
- **Intelligent Question Generation**: Auto-generate content
- **AI Grading Assistant**: Teacher support tool
- **Personalized Learning Paths**: Custom recommendations

### 🔒 Enterprise Security
- **JWT Authentication**: With refresh tokens
- **XSS Protection**: Input sanitization
- **Rate Limiting**: DDoS protection
- **CORS Configuration**: Cross-origin security
- **Audit Logging**: Complete activity tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 4.4+
- Docker (optional)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/smart-campus-backend.git
cd smart-campus-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start the server**
```bash
npm start
```

## 🐳 Docker Deployment

### Build and Run
```bash
# Build image
docker build -t smart-campus-api .

# Run container
docker run -p 3001:3001 --env-file .env smart-campus-api
```

### Docker Compose
```bash
docker-compose up -d
```

## 🌐 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication Endpoints
```
POST   /auth/login              - User login
POST   /auth/register           - User registration
POST   /auth/forgot-password     - Password reset
POST   /auth/refresh-token      - Refresh JWT token
```

### User Role Endpoints
```
👑 Super Admin: /super-admin/*
🏫 Principal:   /principal/*
👨‍🏫 Teacher:    /teacher/*
🎓 Student:     /student/*
👨‍👩 Parent:     /parent/*
💰 Accountant:  /accountant/*
```

### Health Check
```
GET /api/health
```

## 🔧 Environment Variables

### Required
```bash
NODE_ENV=production
PORT=3001
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/smartcampus
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters_long_here
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_minimum_32_characters_long_here
```

### Optional
```bash
# Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# AI Services
OPENAI_API_KEY=your_openai_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# File Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
```

## 🚀 Deployment

### Render.com
1. Push code to GitHub
2. Connect repository to Render
3. Configure environment variables
4. Deploy automatically

### AWS
1. Build Docker image
2. Push to ECR
3. Deploy to ECS
4. Configure load balancer

### DigitalOcean
1. Create Droplet
2. Install Docker
3. Deploy container
4. Configure Nginx

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/api/health
```

### Logs
```bash
# PM2 logs
pm2 logs smart-campus-api

# Docker logs
docker logs smart-campus-api
```

## 🔒 Security

### Authentication
- JWT with refresh tokens
- bcrypt password hashing (12 rounds)
- Role-based access control

### Protection
- XSS protection
- SQL injection protection
- Rate limiting
- CORS configuration
- Security headers

## 📈 Performance

### Optimization
- Database indexing
- Connection pooling
- Response compression
- Caching strategies
- Load balancing ready

## 📋 API Rate Limits

```bash
General: 100 requests per 15 minutes
Authentication: 10 requests per minute
Upload: 5 requests per minute
```

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Coverage
- Authentication endpoints
- All user role endpoints
- Security testing
- Performance testing

## 📞 Support

### Documentation
- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [Troubleshooting](./docs/troubleshooting.md)

### Issues
- Report bugs via GitHub Issues
- Feature requests via GitHub Discussions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 🎯 Production Status

✅ **Production Ready**
- All 200+ API endpoints functional
- Enterprise-grade security implemented
- Multi-tenant architecture complete
- AI-powered features available
- Comprehensive testing suite
- Docker deployment ready
- Monitoring and logging configured

---

**🚀 Smart Campus SaaS - Ready to transform education globally!**
