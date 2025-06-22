# KAIROS Development Environment Script (PowerShell)
# Usage: .\scripts\docker-dev.ps1 [command]

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to show usage
function Show-Usage {
    Write-Host "KAIROS Development Environment Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\docker-dev.ps1 [command]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  start       Start development environment"
    Write-Host "  stop        Stop development environment"
    Write-Host "  restart     Restart development environment"
    Write-Host "  logs        Show logs (all services)"
    Write-Host "  logs-app    Show application logs"
    Write-Host "  logs-db     Show database logs"
    Write-Host "  logs-ml     Show ML service logs"
    Write-Host "  shell       Open shell in application container"
    Write-Host "  db-shell    Open shell in database container"
    Write-Host "  db-reset    Reset database (WARNING: deletes all data)"
    Write-Host "  build       Rebuild all images"
    Write-Host "  clean       Clean up containers and volumes"
    Write-Host "  status      Show status of all services"
    Write-Host "  studio      Start Prisma Studio"
    Write-Host "  help        Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\docker-dev.ps1 start"
    Write-Host "  .\scripts\docker-dev.ps1 logs-app"
    Write-Host "  .\scripts\docker-dev.ps1 shell"
}

# Function to check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check if .env file exists
function Test-EnvFile {
    if (-not (Test-Path ".env")) {
        Write-Warning ".env file not found. Creating from example..."
        if (Test-Path "env.example") {
            Copy-Item "env.example" ".env"
            Write-Success "Created .env file from env.example"
        }
        else {
            Write-Error "env.example not found. Please create a .env file manually."
            exit 1
        }
    }
}

# Function to start development environment
function Start-Dev {
    Write-Status "Starting development environment..."

    if (-not (Test-Docker)) {
        Write-Error "Docker is not running. Please start Docker first."
        exit 1
    }

    Test-EnvFile

    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

    Write-Success "Development environment started!"
    Write-Status "Services:"
    Write-Host "  - Application: http://localhost:3000"
    Write-Host "  - Database: localhost:5433"
    Write-Host "  - ML Service: http://localhost:8081"
    Write-Host "  - Prisma Studio: http://localhost:5555"
}

# Function to stop development environment
function Stop-Dev {
    Write-Status "Stopping development environment..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
    Write-Success "Development environment stopped!"
}

# Function to restart development environment
function Restart-Dev {
    Write-Status "Restarting development environment..."
    Stop-Dev
    Start-Dev
}

# Function to show logs
function Show-Logs {
    param([string]$Service = "")

    if ($Service -eq "") {
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
    }
    else {
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f $Service
    }
}

# Function to open shell in container
function Open-Shell {
    param([string]$Container = "kairos")
    Write-Status "Opening shell in $Container container..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec $Container sh
}

# Function to reset database
function Reset-Database {
    Write-Warning "This will delete ALL data in the development database!"
    $response = Read-Host "Are you sure? (y/N)"

    if ($response -eq "y" -or $response -eq "Y") {
        Write-Status "Resetting development database..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
        Start-Sleep -Seconds 5
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile init up db-init
        Write-Success "Database reset complete!"
    }
    else {
        Write-Status "Database reset cancelled."
    }
}

# Function to rebuild images
function Rebuild-Images {
    Write-Status "Rebuilding all images..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
    Write-Success "Images rebuilt successfully!"
}

# Function to clean up
function Cleanup {
    Write-Warning "This will remove all containers and volumes!"
    $response = Read-Host "Are you sure? (y/N)"

    if ($response -eq "y" -or $response -eq "Y") {
        Write-Status "Cleaning up containers and volumes..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
        docker system prune -f
        Write-Success "Cleanup complete!"
    }
    else {
        Write-Status "Cleanup cancelled."
    }
}

# Function to show status
function Show-Status {
    Write-Status "Development environment status:"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
}

# Function to start Prisma Studio
function Start-Studio {
    Write-Status "Starting Prisma Studio..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up prisma-studio
}

# Main script logic
switch ($Command.ToLower()) {
    "start" { Start-Dev }
    "stop" { Stop-Dev }
    "restart" { Restart-Dev }
    "logs" { Show-Logs }
    "logs-app" { Show-Logs "kairos" }
    "logs-db" { Show-Logs "postgres" }
    "logs-ml" { Show-Logs "ml-service" }
    "shell" { Open-Shell "kairos" }
    "db-shell" { Open-Shell "postgres" }
    "db-reset" { Reset-Database }
    "build" { Rebuild-Images }
    "clean" { Cleanup }
    "status" { Show-Status }
    "studio" { Start-Studio }
    "help" { Show-Usage }
    default {
        Write-Error "Unknown command: $Command"
        Write-Host ""
        Show-Usage
        exit 1
    }
}
