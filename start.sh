#!/bin/bash

# Smart Campus Backend Startup Script for Render

echo "🚀 Starting Smart Campus Backend..."

# Check Node version
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Check if required directories exist
mkdir -p logs uploads

# Set default environment variables if not set
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-5000}

# Generate default JWT secrets if not provided (for deployment safety)
if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  Warning: JWT_SECRET not set, generating temporary secret"
    export JWT_SECRET="temp-jwt-secret-change-in-production-$(date +%s)"
fi

if [ -z "$JWT_REFRESH_SECRET" ]; then
    echo "⚠️  Warning: JWT_REFRESH_SECRET not set, generating temporary secret"
    export JWT_REFRESH_SECRET="temp-refresh-secret-change-in-production-$(date +%s)"
fi

if [ -z "$FRONTEND_URL" ]; then
    echo "⚠️  Warning: FRONTEND_URL not set, using default"
    export FRONTEND_URL="https://localhost:3000"
fi

echo "📋 Environment Variables:"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  MONGO_URI: ${MONGO_URI:+[SET]}"
echo "  JWT_SECRET: ${JWT_SECRET:+[SET]}"
echo "  JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:+[SET]}"
echo "  FRONTEND_URL: $FRONTEND_URL"

# Wait for MongoDB connection (if needed)
if [ -n "$MONGO_URI" ]; then
    echo "🗄️  Testing MongoDB connection..."
    timeout 30s node -e "
        const mongoose = require('mongoose');
        mongoose.connect('$MONGO_URI', {
            serverSelectionTimeoutMS: 5000,
            bufferCommands: false
        }).then(() => {
            console.log('✅ MongoDB connection successful');
            process.exit(0);
        }).catch(err => {
            console.error('❌ MongoDB connection failed:', err.message);
            process.exit(1);
        });
    "
    
    if [ $? -ne 0 ]; then
        echo "❌ MongoDB connection failed, but continuing anyway..."
    fi
fi

echo "🎯 Starting server..."
exec node index.js
