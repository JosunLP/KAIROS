#!/bin/bash

# KAIROS Docker Environment Setup Script
# This script helps you set up the Docker environment with proper .env configuration

set -e

echo "🚀 KAIROS Docker Environment Setup"
echo "=================================="

# Check if .env file exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled. Your existing .env file will be preserved."
        exit 0
    fi
fi

# Copy the appropriate environment file
if [ -f "env.dev.example" ]; then
    echo "📋 Copying development environment template..."
    cp env.dev.example .env
    echo "✅ Development environment template copied to .env"
else
    echo "📋 Copying default environment template..."
    cp env.example .env
    echo "✅ Default environment template copied to .env"
fi

echo ""
echo "🔧 Next Steps:"
echo "1. Edit .env file with your API keys and settings:"
echo "   nano .env"
echo ""
echo "2. Start the development environment:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d"
echo ""
echo "3. Check the logs:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f"
echo ""
echo "4. Access the application:"
echo "   - Main App: http://localhost:3000"
echo "   - ML Service: http://localhost:8081"
echo "   - Prisma Studio: http://localhost:5555"
echo ""

# Check if user wants to start the environment now
read -p "Do you want to start the Docker environment now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🐳 Starting Docker environment..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

    echo ""
    echo "✅ Docker environment started!"
    echo "📊 Check the logs with:"
    echo "   docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f"
    echo ""
    echo "🔍 Health check:"
    echo "   curl http://localhost:3000/health"
fi

echo ""
echo "🎉 Setup complete! Happy coding with KAIROS! 🚀"
