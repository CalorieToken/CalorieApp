param(
    [switch]$SkipHealthCheck
)

$ErrorActionPreference = "Stop"
$env:NEXT_TELEMETRY_DISABLED = "1"

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

Write-Step "Backend Python compilation"
Push-Location $BackendDir
& $pythonExe -m compileall -q app
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Backend Python compilation failed"
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

Write-Step "Git whitespace validation"
git -C $Root diff --check
if ($LASTEXITCODE -ne 0) {
    throw "Git whitespace validation failed"
}

Write-Step "Tracked artifact boundary"
$trackedFiles = @(git -C $Root ls-files)
if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect tracked files"
}

$forbiddenTrackedFiles = @(
    $trackedFiles | Where-Object {
        $normalized = $_ -replace "\\", "/"
        $isAllowedEnvironmentTemplate = $normalized -match '(^|/)(\.env\.example|[^/]+\.env\.example|[^/]+\.env\.staging\.example)$'
        $isForbidden = $normalized -match '(^|/)(\.env($|\.)|node_modules/|\.next/|\.venv/|__pycache__/|[^/]+\.(db|sqlite|sqlite3)$)'
        $isForbidden -and -not $isAllowedEnvironmentTemplate
    }
)

if ($forbiddenTrackedFiles.Count -gt 0) {
    Write-Host "[ERROR] Forbidden runtime or secret-bearing paths are tracked:"
    $forbiddenTrackedFiles | ForEach-Object { Write-Host "  $_" }
    throw "Tracked artifact boundary failed"
}

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
