#!/bin/bash

# KAIROS Production Environment Script
# Usage: ./scripts/docker-prod.sh [command]

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
    echo "KAIROS Production Environment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start production environment"
    echo "  stop        Stop production environment"
    echo "  restart     Restart production environment"
    echo "  deploy      Full production deployment"
    echo "  logs        Show logs (all services)"
    echo "  logs-app    Show application logs"
    echo "  logs-db     Show database logs"
    echo "  logs-ml     Show ML service logs"
    echo "  shell       Open shell in application container"
    echo "  db-shell    Open shell in database container"
    echo "  backup      Create database backup"
    echo "  restore     Restore database from backup"
    echo "  build       Rebuild all images"
    echo "  update      Update and restart services"
    echo "  status      Show status of all services"
    echo "  health      Check health of all services"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  $0 logs-app"
    echo "  $0 backup"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to check if .env file exists and has required values
check_env() {
    if [ ! -f ".env" ]; then
        print_error ".env file not found. Please create one from env.example"
        exit 1
    fi

    # Check for required production variables
    if ! grep -q "POSTGRES_PASSWORD=" .env || grep -q "POSTGRES_PASSWORD=your_secure_password_here" .env; then
        print_error "POSTGRES_PASSWORD must be set in .env file"
        exit 1
    fi

    if ! grep -q "NODE_ENV=production" .env; then
        print_warning "NODE_ENV should be set to 'production' in .env file"
    fi
}

# Function to start production environment
start_prod() {
    print_status "Starting production environment..."
    check_docker
    check_env

    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile cache up -d

    print_success "Production environment started!"
    print_status "Services:"
    echo "  - Application: http://localhost:3000"
    echo "  - Database: localhost:5432"
    echo "  - ML Service: http://localhost:8080"
    echo "  - Redis: localhost:6379"
}

# Function to stop production environment
stop_prod() {
    print_status "Stopping production environment..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
    print_success "Production environment stopped!"
}

# Function to restart production environment
restart_prod() {
    print_status "Restarting production environment..."
    stop_prod
    start_prod
}

# Function to deploy production environment
deploy_prod() {
    print_status "Starting production deployment..."
    check_docker
    check_env

    # Build images
    print_status "Building production images..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

    # Start services
    print_status "Starting production services..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile cache up -d

    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10

    # Initialize database
    print_status "Initializing database..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile init up db-init

    print_success "Production deployment complete!"
    print_status "Services:"
    echo "  - Application: http://localhost:3000"
    echo "  - Database: localhost:5432"
    echo "  - ML Service: http://localhost:8080"
    echo "  - Redis: localhost:6379"
}

# Function to show logs
show_logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
    else
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f "$service"
    fi
}

# Function to open shell in container
open_shell() {
    local container=${1:-"kairos"}
    print_status "Opening shell in $container container..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec "$container" sh
}

# Function to create database backup
create_backup() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    print_status "Creating database backup: $backup_file"

    docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U "${POSTGRES_USER:-kairos}" "${POSTGRES_DB:-kairos}" > "$backup_file"

    print_success "Backup created: $backup_file"
}

# Function to restore database from backup
restore_backup() {
    local backup_file=${1:-""}

    if [ -z "$backup_file" ]; then
        print_error "Please specify backup file: $0 restore <backup_file>"
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi

    print_warning "This will overwrite the current database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Restoring database from backup: $backup_file"
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
            psql -U "${POSTGRES_USER:-kairos}" "${POSTGRES_DB:-kairos}" < "$backup_file"
        print_success "Database restored successfully!"
    else
        print_status "Database restore cancelled."
    fi
}

# Function to rebuild images
rebuild_images() {
    print_status "Rebuilding production images..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
    print_success "Images rebuilt successfully!"
}

# Function to update services
update_services() {
    print_status "Updating production services..."

    # Pull latest images
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull

    # Rebuild if needed
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

    # Restart services
    restart_prod

    print_success "Services updated successfully!"
}

# Function to show status
show_status() {
    print_status "Production environment status:"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
}

# Function to check health
check_health() {
    print_status "Checking service health..."

    # Check if services are running
    local status=$(docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps -q)
    if [ -z "$status" ]; then
        print_error "No services are running"
        exit 1
    fi

    # Check health of each service
    local services=("kairos" "postgres" "ml-service" "redis")
    for service in "${services[@]}"; do
        if docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps "$service" | grep -q "Up"; then
            print_success "$service: Running"
        else
            print_error "$service: Not running"
        fi
    done

    # Check application health endpoint
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Application health check: OK"
    else
        print_error "Application health check: FAILED"
    fi
}

# Main script logic
case "${1:-help}" in
    start)
        start_prod
        ;;
    stop)
        stop_prod
        ;;
    restart)
        restart_prod
        ;;
    deploy)
        deploy_prod
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
    backup)
        create_backup
        ;;
    restore)
        restore_backup "$2"
        ;;
    build)
        rebuild_images
        ;;
    update)
        update_services
        ;;
    status)
        show_status
        ;;
    health)
        check_health
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
