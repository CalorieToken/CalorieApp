param(
    [string]$CheckpointId,
    [switch]$SkipReleaseCheck,
    [switch]$SkipManifest,
    [ValidateRange(1, 10)]
    [int]$ReleaseCheckAttempts = 3,
    [string]$Note = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$checkpointsDir = (Resolve-Path $PSScriptRoot).Path

if (-not $CheckpointId) {
    $CheckpointId = "{0}-project-checkpoint" -f ([DateTime]::UtcNow.ToString("yyyy-MM-dd-HHmmss"))
}

$checkpointDir = Join-Path $checkpointsDir $CheckpointId
if (Test-Path $checkpointDir) {
    throw "Checkpoint already exists: $CheckpointId"
}

New-Item -ItemType Directory -Path $checkpointDir | Out-Null
$script:checkpointDirToCleanup = $checkpointDir

trap {
    if ($script:checkpointDirToCleanup -and (Test-Path $script:checkpointDirToCleanup)) {
        Write-Warning "Checkpoint creation failed. Removing partial folder: $script:checkpointDirToCleanup"
        Remove-Item -Recurse -Force $script:checkpointDirToCleanup -ErrorAction SilentlyContinue
    }
    throw
}

$createdUtc = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
$releaseOutputPath = Join-Path $checkpointDir "release-check-output.txt"
$manifestPath = Join-Path $checkpointDir "source-file-manifest.sha256.txt"
$summaryPath = Join-Path $checkpointDir "CHECKPOINT.md"
$latestPath = Join-Path $checkpointsDir "LATEST.txt"
$indexPath = Join-Path $checkpointsDir "INDEX.md"

if (-not $SkipReleaseCheck) {
    Write-Host "[STEP] Running release gate"
    $releaseSuccess = $false
    for ($attempt = 1; $attempt -le $ReleaseCheckAttempts; $attempt++) {
        if (Test-Path $releaseOutputPath) {
            Remove-Item $releaseOutputPath -Force -ErrorAction SilentlyContinue
        }

        Write-Host "[INFO] Release gate attempt $attempt of $ReleaseCheckAttempts"
        Push-Location $repoRoot
        try {
            powershell -NoProfile -ExecutionPolicy Bypass -File ./release-check.ps1 2>&1 |
                Tee-Object -FilePath $releaseOutputPath
            if ($LASTEXITCODE -eq 0) {
                $releaseSuccess = $true
                break
            }
            Write-Warning "Release gate failed with exit code $LASTEXITCODE"
        }
        finally {
            Pop-Location
        }
    }

    if (-not $releaseSuccess) {
        throw "Release gate failed after $ReleaseCheckAttempts attempt(s)"
    }
}

if (-not $SkipManifest) {
    Write-Host "[STEP] Generating source manifest"
    $targets = @(
        "README.md",
        "TECHNICAL_EVALUATION.md",
        "release-check.ps1",
        ".gitignore",
        ".github/copilot-instructions.md",
        "backend/app",
        "backend/tests",
        "backend/requirements.txt",
        "backend/start-backend.ps1",
        "backend/dev_health_check.py",
        "backend/README.md",
        "frontend/app",
        "frontend/components",
        "frontend/package.json",
        "frontend/tsconfig.json",
        "frontend/next.config.js",
        "docs"
    )

    $files = @()
    foreach ($target in $targets) {
        $path = Join-Path $repoRoot $target
        if (-not (Test-Path $path)) {
            continue
        }

        if ((Get-Item $path).PSIsContainer) {
            $files += Get-ChildItem -Path $path -Recurse -File |
                Where-Object {
                    $_.FullName -notmatch "\\(node_modules|\.next|\.venv|__pycache__|\.pytest_cache|checkpoints)\\"
                }
        }
        else {
            $files += Get-Item $path
        }
    }

    $files = $files | Sort-Object FullName -Unique
    $hashes = $files | Get-FileHash -Algorithm SHA256
    $hashes |
        ForEach-Object {
            "{0}  {1}" -f $_.Hash.ToLower(), ($_.Path.Replace($repoRoot + "\\", "").Replace("\\", "/"))
        } |
        Set-Content -Path $manifestPath -Encoding UTF8
}

$manifestEntries = 0
if (Test-Path $manifestPath) {
    $manifestEntries = (Get-Content $manifestPath).Count
}

$releaseOutputBytes = 0
if (Test-Path $releaseOutputPath) {
    $releaseOutputBytes = (Get-Item $releaseOutputPath).Length
}

$validationStatus = "Validation green"
if ($SkipReleaseCheck) {
    $validationStatus = "Validation skipped"
}

$evidenceParts = @()
if (Test-Path $releaseOutputPath) {
    $evidenceParts += "release-check output"
}
if (Test-Path $manifestPath) {
    $evidenceParts += "SHA256 source manifest"
}
if ($evidenceParts.Count -eq 0) {
    $evidenceSummary = "metadata only"
}
else {
    $evidenceSummary = ($evidenceParts -join " + ")
}

$noteLine = "- Note: none"
if ($Note -and $Note.Trim().Length -gt 0) {
    $noteLine = "- Note: $($Note.Trim())"
}

$summary = @"
# CalorieApp Project Checkpoint

- Checkpoint ID: $CheckpointId
- Captured at (UTC): $createdUtc
- Validation State: $validationStatus
$noteLine

## Included Evidence

1. release-check-output.txt
- Present: $([bool](Test-Path $releaseOutputPath))
- File size: $releaseOutputBytes bytes

2. source-file-manifest.sha256.txt
- Present: $([bool](Test-Path $manifestPath))
- Entry count: $manifestEntries

## Scope Notes

- Runtime artifacts such as node_modules, .next, .venv, caches, and checkpoints folder are excluded from hash manifest.
- Live SQLite database files are excluded from hash manifest for deterministic source snapshots.
"@

Set-Content -Path $summaryPath -Value $summary -Encoding UTF8
Set-Content -Path $latestPath -Value ($CheckpointId + "`n") -Encoding UTF8

$checkpointDirs = Get-ChildItem -Path $checkpointsDir -Directory |
    Where-Object { $_.Name -ne ".git" } |
    Sort-Object LastWriteTimeUtc -Descending, Name -Descending

$latestId = ""
if (Test-Path $latestPath) {
    $latestId = (Get-Content $latestPath -First 1).Trim()
}
if (-not $latestId -and $checkpointDirs.Count -gt 0) {
    $latestId = $checkpointDirs[0].Name
}

$rows = @()
foreach ($dir in $checkpointDirs) {
    $id = $dir.Name
    $dateValue = "unknown"
    if ($id -match "^(\d{4}-\d{2}-\d{2})") {
        $dateValue = $Matches[1]
    }

    $rowStatus = "Partial evidence"
    $rowEvidence = @()
    if (Test-Path (Join-Path $dir.FullName "release-check-output.txt")) {
        $rowEvidence += "release-check output"
        $rowStatus = "Validation evidence present"
    }
    if (Test-Path (Join-Path $dir.FullName "source-file-manifest.sha256.txt")) {
        $rowEvidence += "SHA256 source manifest"
    }
    if (Test-Path (Join-Path $dir.FullName "CHECKPOINT.md")) {
        if ($rowEvidence.Count -eq 0) {
            $rowEvidence += "summary metadata"
        }
    }

    if ($rowEvidence.Count -eq 0) {
        $rowEvidence += "none"
    }

    $rows += "| $dateValue | $id | $rowStatus | $($rowEvidence -join ' + ') |"
}

if ($rows.Count -eq 0) {
    $rows = @("| n/a | none | none | none |")
}

$index = @"
# Checkpoint Index

This file tracks all project checkpoints in chronological order.

## Latest

- Current latest checkpoint: $latestId
- Path: checkpoints/$latestId
- Summary file: checkpoints/$latestId/CHECKPOINT.md

## Milestone History

| Date (UTC) | Checkpoint ID | Status | Evidence |
| --- | --- | --- | --- |
$($rows -join "`n")

## Update Procedure

1. Create a new checkpoint with:

   powershell -NoProfile -ExecutionPolicy Bypass -File ./checkpoints/new-checkpoint.ps1

2. Confirm LATEST.txt points to the new checkpoint ID.
3. Keep old checkpoint folders immutable except factual metadata fixes.
"@

Set-Content -Path $indexPath -Value $index -Encoding UTF8

Write-Host "[SUCCESS] Created checkpoint: $CheckpointId"
Write-Host "[INFO] Folder: checkpoints/$CheckpointId"
Write-Host "[INFO] Latest pointer updated: checkpoints/LATEST.txt"
Write-Host "[INFO] Index updated: checkpoints/INDEX.md"
$script:checkpointDirToCleanup = $null
