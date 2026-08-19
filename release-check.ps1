param(
    [switch]$SkipHealthCheck
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$HealthCheckScript = Join-Path $BackendDir "dev_health_check.py"
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "[STEP] $Message"
}

function Get-PythonExe {
    if (Test-Path $VenvPython) {
        return (Resolve-Path $VenvPython).Path
    }
    return "python"
}

function Wait-ForPort([int]$Port, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($listener) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

$pythonExe = Get-PythonExe
Write-Host "[INFO] Using Python: $pythonExe"

Write-Step "Backend tests"
Push-Location $BackendDir
& $pythonExe -m pytest
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Backend tests failed"
}
Pop-Location

Write-Step "Frontend lint"
Push-Location $FrontendDir
npm run lint
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Frontend lint failed"
}
Pop-Location

Write-Step "Frontend production build"
Push-Location $FrontendDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Frontend build failed"
}
Pop-Location

if (-not $SkipHealthCheck) {
    Write-Step "Developer health check"

    $existingFrontend = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    $startedFrontendProcess = $null

    try {
        if (-not $existingFrontend) {
            Write-Host "[INFO] Frontend is not running on port 3000. Starting temporary dev server..."
            $startedFrontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" -WorkingDirectory $FrontendDir -PassThru -WindowStyle Hidden
            if (-not (Wait-ForPort -Port 3000 -TimeoutSeconds 40)) {
                throw "Frontend dev server did not open port 3000 in time"
            }
            Write-Host "[INFO] Frontend dev server ready on port 3000"
        } else {
            Write-Host "[INFO] Frontend already running on port 3000"
        }

        & $pythonExe $HealthCheckScript
        if ($LASTEXITCODE -ne 0) {
            throw "Developer health check failed"
        }
    }
    finally {
        if ($startedFrontendProcess) {
            Write-Host "[INFO] Stopping temporary frontend dev server..."
            taskkill /PID $startedFrontendProcess.Id /T /F *> $null
        }
    }
}

Write-Host ""
Write-Host "[SUCCESS] Release checks passed"
