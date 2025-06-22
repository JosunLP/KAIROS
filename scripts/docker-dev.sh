#!/bin/bash

# KAIROS Development Environment Script
# Usage: ./scripts/docker-dev.sh [command]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "KAIROS Development Environment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start development environment"
    echo "  stop        Stop development environment"
    echo "  restart     Restart development environment"
    echo "  logs        Show logs (all services)"
    echo "  logs-app    Show application logs"
    echo "  logs-db     Show database logs"
    echo "  logs-ml     Show ML service logs"
    echo "  shell       Open shell in application container"
    echo "  db-shell    Open shell in database container"
    echo "  db-reset    Reset database (WARNING: deletes all data)"
    echo "  build       Rebuild all images"
    echo "  clean       Clean up containers and volumes"
    echo "  status      Show status of all services"
    echo "  studio      Start Prisma Studio"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs-app"
    echo "  $0 shell"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from example..."
        if [ -f "env.example" ]; then
            cp env.example .env
            print_success "Created .env file from env.example"
        else
            print_error "env.example not found. Please create a .env file manually."
            exit 1
        fi
    fi
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment..."
    check_docker
    check_env

    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

    print_success "Development environment started!"
    print_status "Services:"
    echo "  - Application: http://localhost:3000"
    echo "  - Database: localhost:5433"
    echo "  - ML Service: http://localhost:8081"
    echo "  - Prisma Studio: http://localhost:5555"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping development environment..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
    print_success "Development environment stopped!"
}

# Function to restart development environment
restart_dev() {
    print_status "Restarting development environment..."
    stop_dev
    start_dev
}

# Function to show logs
show_logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
    else
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f "$service"
    fi
}

# Function to open shell in container
open_shell() {
    local container=${1:-"kairos"}
    print_status "Opening shell in $container container..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec "$container" sh
}

# Function to reset database
reset_db() {
    print_warning "This will delete ALL data in the development database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Resetting development database..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
        sleep 5
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile init up db-init
        print_success "Database reset complete!"
    else
        print_status "Database reset cancelled."
    fi
}

# Function to rebuild images
rebuild_images() {
    print_status "Rebuilding all images..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
    print_success "Images rebuilt successfully!"
}

# Function to clean up
cleanup() {
    print_warning "This will remove all containers and volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up containers and volumes..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
        docker system prune -f
        print_success "Cleanup complete!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to show status
show_status() {
    print_status "Development environment status:"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
}

# Function to start Prisma Studio
start_studio() {
    print_status "Starting Prisma Studio..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up prisma-studio
}

# Main script logic
case "${1:-help}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    logs)
        show_logs
        ;;
    logs-app)
        show_logs kairos
        ;;
    logs-db)
        show_logs postgres
        ;;
    logs-ml)
        show_logs ml-service
        ;;
    shell)
        open_shell kairos
        ;;
    db-shell)
        open_shell postgres
        ;;
    db-reset)
        reset_db
        ;;
    build)
        rebuild_images
        ;;
    clean)
        cleanup
        ;;
    status)
        show_status
        ;;
    studio)
        start_studio
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
