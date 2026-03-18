#!/bin/bash
# Production Deployment Script for Smart School Management System
# Usage: ./deploy.sh [render|docker|local]

set -e  # Exit on error

echo "🚀 Smart School API - Production Deployment"
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Load environment variables
export $(cat .env | xargs)

echo -e "${YELLOW}Environment: $NODE_ENV${NC}"
echo ""

# Function to deploy to Render
deploy_render() {
    echo "🌐 Deploying to Render..."
    
    # Check if git is initialized
    if [ ! -d .git ]; then
        echo -e "${YELLOW}⚠️  Git not initialized. Initializing...${NC}"
        git init
        git add .
        git commit -m "Initial commit - Production ready"
    fi
    
    # Check if remote exists
    if ! git remote get-url origin > /dev/null 2>&1; then
        echo -e "${RED}❌ No git remote configured.${NC}"
        echo "Please add your GitHub repository:"
        echo "git remote add origin https://github.com/username/repo.git"
        exit 1
    fi
    
    # Push to GitHub
    echo "📤 Pushing code to GitHub..."
    git add .
    git commit -m "Production deployment $(date)" || true
    git push origin main || git push origin master
    
    echo -e "${GREEN}✅ Code pushed to GitHub${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Go to https://render.com"
    echo "2. Create a new Web Service from your GitHub repo"
    echo "3. Configure environment variables in Render dashboard"
    echo "4. Render will automatically deploy from render.yaml"
}

# Function to deploy with Docker
deploy_docker() {
    echo "🐳 Building Docker image..."
    
    # Build image
    docker build -t smart-school-api:latest .
    
    echo -e "${GREEN}✅ Docker image built${NC}"
    
    # Run container
    echo "🚀 Starting container..."
    docker run -d \
        --name smart-school-api \
        -p $PORT:$PORT \
        -e NODE_ENV=$NODE_ENV \
        -e PORT=$PORT \
        -e MONGO_URI=$MONGO_URI \
        -e JWT_SECRET=$JWT_SECRET \
        -e JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET \
        -e FRONTEND_URL=$FRONTEND_URL \
        smart-school-api:latest
    
    echo -e "${GREEN}✅ Container started${NC}"
    echo ""
    echo "Health check:"
    sleep 3
    curl -s http://localhost:$PORT/api/health | grep -q "success" && echo -e "${GREEN}✅ API is healthy${NC}" || echo -e "${RED}❌ Health check failed${NC}"
}

# Function to deploy locally
deploy_local() {
    echo "💻 Starting local production server..."
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm ci --only=production
    
    # Start server
    echo "🚀 Starting server..."
    npm start
}

# Main deployment logic
case "${1:-local}" in
    render)
        deploy_render
        ;;
    docker)
        deploy_docker
        ;;
    local)
        deploy_local
        ;;
    *)
        echo "Usage: $0 [render|docker|local]"
        echo ""
        echo "Options:"
        echo "  render  - Deploy to Render.com (requires GitHub repo)"
        echo "  docker  - Deploy using Docker"
        echo "  local   - Run locally in production mode (default)"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment completed!${NC}"
