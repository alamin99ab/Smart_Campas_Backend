# 🎓 Smart Campus API

Production-ready backend API for Smart Campus Management System.

---

## 🚀 Quick Start

### Installation

```bash
npm install --production
```

### Configuration

1. Copy `.env.example` to `.env`
2. Fill in required environment variables:
   - `MONGO_URI` - MongoDB connection string
   - `JWT_SECRET` - 32+ character secret
   - `JWT_REFRESH_SECRET` - 32+ character secret (different from JWT_SECRET)
   - `FRONTEND_URL` - Your frontend domain

### Start Server

```bash
npm start
```

Server runs on `http://localhost:5000` (or PORT from .env)

---

## 📚 Documentation

- **API Documentation**: `API_DOCUMENTATION.md`
- **Quick Reference**: `API_ENDPOINTS_QUICK_REFERENCE.md`
- **Frontend Integration**: `FRONTEND_INTEGRATION_GUIDE.md`
- **Deployment Guide**: `DEPLOY_NOW.md`
- **Production Deployment**: `PRODUCTION_DEPLOYMENT.md`

---

## 🔐 Environment Variables

See `.env.example` for all available environment variables.

**Required:**
- `MONGO_URI`
- `JWT_SECRET` (32+ chars)
- `JWT_REFRESH_SECRET` (32+ chars, different from JWT_SECRET)
- `FRONTEND_URL`

---

## 🐳 Docker Deployment

```bash
docker build -t smart-campus-api .
docker run -p 5000:5000 --env-file .env smart-campus-api
```

---

## ☁️ Cloud Deployment

### Railway
1. Connect GitHub repo
2. Add MongoDB service
3. Set environment variables
4. Deploy

See `DEPLOY_NOW.md` for detailed steps.

### Render
1. Connect GitHub repo
2. Use `render.yaml` blueprint
3. Set environment variables
4. Deploy

---

## 📊 Features

- ✅ User Authentication & Authorization
- ✅ Student Management
- ✅ Attendance Tracking
- ✅ Result & Grade Management
- ✅ Fee Management
- ✅ Notice & Announcement System
- ✅ Class Routine Management
- ✅ Teacher Assignment
- ✅ Admission Management
- ✅ Dashboard & Analytics
- ✅ Notifications
- ✅ Events & Calendar
- ✅ Global Search

---

## 🔒 Security

- JWT Authentication
- Password Hashing (bcrypt)
- Rate Limiting
- XSS Protection
- NoSQL Injection Prevention
- Prototype Pollution Prevention
- Helmet.js Security Headers
- CORS Configuration
- Input Validation

---

## 📝 API Endpoints

Base URL: `http://localhost:5000/api`

See `API_DOCUMENTATION.md` for complete API reference.

---

## 🏗️ Project Structure

```
backend/
├── controllers/     # Route controllers
├── models/          # MongoDB models
├── routes/          # Express routes
├── middleware/      # Custom middleware
├── utils/           # Utility functions
├── config/          # Configuration files
├── logs/            # Application logs
└── index.js         # Entry point
```

---

## 📄 License

ISC

---

**Version:** 1.0.0  
**Last Updated:** February 21, 2026
