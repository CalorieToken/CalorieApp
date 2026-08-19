param(
    [switch]$KillAllPython,
    [switch]$Reload
)

# CalorieApp backend startup helper.
# Purpose: guarantee a clean backend start on port 8000.

$BACKEND_PORT = 8000
$FRONTEND_PORT = 3000
$BACKEND_URL = "http://127.0.0.1:$BACKEND_PORT"
$FRONTEND_URL = "http://localhost:$FRONTEND_PORT"

Write-Host ""
Write-Host "[CalorieApp] Backend startup helper"
Write-Host "  Backend  : $BACKEND_URL"
Write-Host "  Frontend : $FRONTEND_URL"
Write-Host "  Reload   : $Reload"
Write-Host ""

Push-Location $PSScriptRoot

try {
    $frontendListeners = Get-NetTCPConnection -LocalPort $FRONTEND_PORT -State Listen -ErrorAction SilentlyContinue
    if ($frontendListeners) {
        Write-Host "[INFO] Frontend listening on port $FRONTEND_PORT (PID $($frontendListeners[0].OwningProcess))."
    } else {
        Write-Host "[INFO] Frontend not detected on port $FRONTEND_PORT."
    }

    $uvicornProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*uvicorn app.main:app*' }

    if ($uvicornProcs) {
        $count = ($uvicornProcs | Measure-Object).Count
        Write-Host "[CLEAN] Found $count existing uvicorn process(es). Stopping..."
        foreach ($proc in $uvicornProcs) {
            Write-Host "        Stopping PID $($proc.ProcessId)"
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }

    $portListeners = Get-NetTCPConnection -LocalPort $BACKEND_PORT -State Listen -ErrorAction SilentlyContinue
    if ($portListeners) {
        foreach ($listener in $portListeners) {
            Write-Host "[CLEAN] Stopping port $BACKEND_PORT listener (PID $($listener.OwningProcess))"
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }

    if ($KillAllPython) {
        Write-Warning "KillAllPython is enabled. Terminating all python.exe processes."
        taskkill /F /IM python.exe 2>$null | Out-Null
    }

    Start-Sleep -Milliseconds 500

    $venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        $pythonExe = (Resolve-Path $venvPython).Path
        Write-Host "[INFO] Using venv Python: $pythonExe"
    } else {
        $pythonExe = "python"
        Write-Host "[INFO] Using system Python from PATH."
    }

    Write-Host ""
    Write-Host "[START] Starting backend on $BACKEND_URL"
    Write-Host ""

    if ($Reload) {
        Write-Host "[START] Reload mode enabled (may create watcher process)."
        & $pythonExe -m uvicorn app.main:app --reload --host 127.0.0.1 --port $BACKEND_PORT
    } else {
        & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT
    }
}
finally {
    Pop-Location
}
