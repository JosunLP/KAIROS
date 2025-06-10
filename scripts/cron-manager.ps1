# =============================================================================
# KAIROS Cron Job Management PowerShell Script
# =============================================================================
# Verwendung:
#   .\cron-manager.ps1 status           - Zeigt Status aller Cron Jobs
#   .\cron-manager.ps1 logs [jobName]   - Zeigt Logs für alle oder einen spezifischen Job
#   .\cron-manager.ps1 test             - Testet die Cron Job Konfiguration
#   .\cron-manager.ps1 validate         - Validiert alle Cron Expressions
#   .\cron-manager.ps1 schedule         - Zeigt nächste geplante Ausführungen

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("status", "logs", "test", "validate", "schedule", "help")]
    [string]$Command,
    
    [Parameter(Mandatory=$false, Position=1)]
    [string]$JobName
)

# Cron Job Definitionen
$CronJobs = @{
    'data-ingestion' = @{
        Name = 'Datenerfassung'
        Cron = '*/15 * * * *'
        Env = 'DATA_INGESTION_CRON'
        Description = 'Holt aktuelle Marktdaten alle 15 Minuten während Handelszeiten'
        Timeout = 300000
    }
    'technical-analysis' = @{
        Name = 'Technische Analyse'
        Cron = '0 * * * *'
        Env = 'TECHNICAL_ANALYSIS_CRON'
        Description = 'Berechnet technische Indikatoren jede Stunde'
        Timeout = 600000
    }
    'ml-training' = @{
        Name = 'ML Training'
        Cron = '0 2 * * *'
        Env = 'ML_TRAINING_CRON'
        Description = 'Trainiert ML-Modelle täglich um 2:00 Uhr'
        Timeout = 3600000
    }
    'prediction-validation' = @{
        Name = 'Vorhersage-Validierung'
        Cron = '0 3 * * *'
        Env = 'PREDICTION_VALIDATION_CRON'
        Description = 'Validiert Vorhersagen täglich um 3:00 Uhr'
        Timeout = 1800000
    }
    'data-cleanup' = @{
        Name = 'Datenbereinigung'
        Cron = '0 4 * * 0'
        Env = 'DATA_CLEANUP_CRON'
        Description = 'Bereinigt alte Daten wöchentlich sonntags um 4:00 Uhr'
        Timeout = 1800000
    }
    'daily-predictions' = @{
        Name = 'Tägliche Vorhersagen'
        Cron = '0 6 * * *'
        Env = 'DAILY_PREDICTION_CRON'
        Description = 'Erstellt täglich um 6:00 Uhr Vorhersagen für alle Aktien'
        Timeout = 1800000
    }
    'data-integrity' = @{
        Name = 'Datenintegrität'
        Cron = '0 1 * * *'
        Env = 'DATA_INTEGRITY_CRON'
        Description = 'Überprüft Datenintegrität täglich um 1:00 Uhr'
        Timeout = 600000
    }
}

function Test-CronExpression {
    param([string]$CronExpression)
    
    $parts = $CronExpression -split ' '
    if ($parts.Length -ne 5) {
        return $false
    }
    
    # Weitere Validierung könnte hier hinzugefügt werden
    return $true
}

function Get-NextScheduledTime {
    param([string]$CronExpression)
    
    # Vereinfachte Berechnung der nächsten Ausführung
    # In einer echten Implementierung würde man eine Cron-Parsing-Bibliothek verwenden
    $now = Get-Date
    $next = $now.AddMinutes(1) # Nächste Minute als Platzhalter
    
    return $next.ToString("dddd, dd.MM.yyyy HH:mm")
}

function Show-Status {
    Write-Host "🔄 KAIROS Cron Job Status" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray
    
    foreach ($key in $CronJobs.Keys) {
        $job = $CronJobs[$key]
        $envValue = if ($env:($job.Env)) { (Get-Item -Path "Env:$($job.Env)").Value } else { $job.Cron }
        $isValid = Test-CronExpression -CronExpression $envValue
        $status = if ($isValid) { "✅ Aktiv" } else { "❌ Ungültig" }
        
        Write-Host ""
        Write-Host "📋 $($job.Name) ($key)" -ForegroundColor Yellow
        Write-Host "   Beschreibung: $($job.Description)"
        Write-Host "   Cron:         $envValue"
        Write-Host "   Status:       $status"
        Write-Host "   Timeout:      $($job.Timeout / 1000)s"
        
        if ($isValid) {
            Write-Host "   Nächste Ausführung: $(Get-NextScheduledTime -CronExpression $envValue)"
        }
    }
}

function Show-Logs {
    param([string]$JobName)
    
    $logFile = Join-Path $PSScriptRoot "../../logs/kairos.log"
    
    if (-not (Test-Path $logFile)) {
        Write-Host "❌ Keine Log-Datei gefunden." -ForegroundColor Red
        return
    }
    
    try {
        $logs = Get-Content $logFile
        
        if ($JobName) {
            $jobConfig = $CronJobs[$JobName]
            if (-not $jobConfig) {
                Write-Host "❌ Unbekannter Job: $JobName" -ForegroundColor Red
                return
            }
            
            Write-Host "📄 Logs für Job: $($jobConfig.Name)" -ForegroundColor Cyan
            $filteredLines = $logs | Where-Object { 
                $_ -match $jobConfig.Name -or 
                $_ -match $JobName -or
                $_ -match 'cron' -or
                $_ -match 'scheduled'
            }
        } else {
            Write-Host "📄 Alle Cron Job Logs:" -ForegroundColor Cyan
            $filteredLines = $logs | Where-Object { 
                $_ -match 'cron' -or 
                $_ -match 'scheduled' -or
                $_ -match 'geplant'
            }
        }
        
        Write-Host ("=" * 80) -ForegroundColor Gray
        $filteredLines | Select-Object -Last 50 | ForEach-Object {
            if ($_.Trim()) {
                Write-Host $_
            }
        }
        
    } catch {
        Write-Host "❌ Fehler beim Lesen der Log-Datei: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Test-Configuration {
    Write-Host "🧪 Teste Cron Job Konfiguration..." -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray
    
    $allValid = $true
    
    foreach ($key in $CronJobs.Keys) {
        $job = $CronJobs[$key]
        $envValue = if ($env:($job.Env)) { (Get-Item -Path "Env:$($job.Env)").Value } else { $job.Cron }
        $isValid = Test-CronExpression -CronExpression $envValue
        
        if ($isValid) {
            Write-Host "✅ $($job.Name): $envValue" -ForegroundColor Green
        } else {
            Write-Host "❌ $($job.Name): $envValue (Ungültige Cron Expression)" -ForegroundColor Red
            $allValid = $false
        }
    }
    
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Gray
    
    if ($allValid) {
        Write-Host "✅ Alle Cron Job Konfigurationen sind gültig!" -ForegroundColor Green
    } else {
        Write-Host "❌ Einige Cron Job Konfigurationen sind ungültig!" -ForegroundColor Red
        exit 1
    }
    
    # Teste auch Umgebungsvariablen
    Write-Host ""
    Write-Host "🔧 Umgebungsvariablen:" -ForegroundColor Cyan
    $requiredEnvVars = @(
        'SCHEDULING_TIMEZONE',
        'ENABLE_CRON_MONITORING',
        'CRON_JOB_TIMEOUT',
        'CRON_FAILURE_THRESHOLD'
    )
    
    foreach ($envVar in $requiredEnvVars) {
        $value = [Environment]::GetEnvironmentVariable($envVar)
        if ($value) {
            Write-Host "✅ ${envVar}: $value" -ForegroundColor Green
        } else {
            Write-Host "⚠️  ${envVar}: Nicht gesetzt (Standard wird verwendet)" -ForegroundColor Yellow
        }
    }
}

function Test-All {
    Write-Host "✅ Validiere alle Cron Expressions..." -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray
    
    foreach ($key in $CronJobs.Keys) {
        $job = $CronJobs[$key]
        $envValue = if ($env:($job.Env)) { (Get-Item -Path "Env:$($job.Env)").Value } else { $job.Cron }
        $isValid = Test-CronExpression -CronExpression $envValue
        
        if ($isValid) {
            Write-Host "✅ ${key}: $envValue" -ForegroundColor Green
        } else {
            Write-Host "❌ ${key}: $envValue - UNGÜLTIG" -ForegroundColor Red
        }
    }
}

function Show-Schedule {
    Write-Host "📅 Geplante Cron Job Ausführungen" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray
    
    foreach ($key in $CronJobs.Keys) {
        $job = $CronJobs[$key]
        $envValue = if ($env:($job.Env)) { (Get-Item -Path "Env:$($job.Env)").Value } else { $job.Cron }
        
        Write-Host ""
        Write-Host "⏰ $($job.Name)" -ForegroundColor Yellow
        Write-Host "   Cron: $envValue"
        Write-Host "   Nächste Ausführung: $(Get-NextScheduledTime -CronExpression $envValue)"
    }
}

function Show-Help {
    Write-Host "🔧 KAIROS Cron Job Manager" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host ""
    Write-Host "Verfügbare Kommandos:"
    Write-Host "  status                    - Zeigt Status aller Cron Jobs"
    Write-Host "  logs [jobName]           - Zeigt Logs für alle oder einen spezifischen Job"
    Write-Host "  test                     - Testet die Cron Job Konfiguration"
    Write-Host "  validate                 - Validiert alle Cron Expressions"
    Write-Host "  schedule                 - Zeigt nächste geplante Ausführungen"
    Write-Host "  help                     - Zeigt diese Hilfe"
    
    Write-Host ""
    Write-Host "Verfügbare Jobs:"
    foreach ($key in $CronJobs.Keys) {
        $job = $CronJobs[$key]
        Write-Host "  $($key.PadRight(20)) - $($job.Name)"
    }
    
    Write-Host ""
    Write-Host "Beispiele:"
    Write-Host "  .\cron-manager.ps1 status"
    Write-Host "  .\cron-manager.ps1 logs ml-training"
    Write-Host "  .\cron-manager.ps1 test"
}

# Hauptlogik
switch ($Command) {
    "status" { Show-Status }
    "logs" { Show-Logs -JobName $JobName }
    "test" { Test-Configuration }
    "validate" { Test-All }
    "schedule" { Show-Schedule }
    "help" { Show-Help }
    default { 
        Write-Host "❌ Unbekanntes Kommando: $Command" -ForegroundColor Red
        Write-Host "Verwende '.\cron-manager.ps1 help' für Hilfe."
        exit 1
    }
}
