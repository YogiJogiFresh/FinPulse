# FinPulse Release Script
# Usage: npm run electron:release
# Prompts for version bump type, builds, and creates a GitHub release.

param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$rootPkg = Join-Path $root "package.json"
$electronPkg = Join-Path $root "electron" "package.json"
$releaseDir = Join-Path $root "electron" "release"

# Read current version
$electronJson = Get-Content $electronPkg -Raw | ConvertFrom-Json
$currentVersion = $electronJson.version
Write-Host "`n  Current version: $currentVersion" -ForegroundColor Cyan

# Parse semver
$parts = $currentVersion -split '\.'
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

# Prompt for bump type
Write-Host ""
Write-Host "  Select version bump:" -ForegroundColor Yellow
Write-Host "    [1] patch  -> $major.$minor.$($patch + 1)"
Write-Host "    [2] minor  -> $major.$($minor + 1).0"
Write-Host "    [3] major  -> $($major + 1).0.0"
Write-Host ""

$choice = Read-Host "  Enter choice (1/2/3)"

switch ($choice) {
    "1" { $patch++; }
    "2" { $minor++; $patch = 0; }
    "3" { $major++; $minor = 0; $patch = 0; }
    default { Write-Host "  Invalid choice. Aborting." -ForegroundColor Red; exit 1 }
}

$newVersion = "$major.$minor.$patch"
Write-Host "`n  Bumping version: $currentVersion -> $newVersion" -ForegroundColor Green

# Update both package.json files
function Update-PackageVersion($filePath, $version) {
    $content = Get-Content $filePath -Raw
    $content = $content -replace '"version":\s*"[^"]+"', "`"version`": `"$version`""
    Set-Content $filePath -Value $content -NoNewline
}

Update-PackageVersion $rootPkg $newVersion
Update-PackageVersion $electronPkg $newVersion
Write-Host "  Updated package.json files" -ForegroundColor Gray

# Clean release directory
if (Test-Path $releaseDir) {
    Write-Host "  Cleaning electron/release/..." -ForegroundColor Gray
    Remove-Item -Path "$releaseDir\*" -Recurse -Force
}

# Build
Write-Host "`n  Building FinPulse v$newVersion..." -ForegroundColor Yellow
Push-Location $root
try {
    npm run electron:build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
} finally {
    Pop-Location
}

# Verify installer exists
$installer = Join-Path $releaseDir "FinPulse Setup $newVersion.exe"
$latestYml = Join-Path $releaseDir "latest.yml"
$blockmap = Join-Path $releaseDir "FinPulse Setup $newVersion.exe.blockmap"

if (-not (Test-Path $installer)) {
    Write-Host "  ERROR: Installer not found at $installer" -ForegroundColor Red
    exit 1
}

Write-Host "`n  Build successful!" -ForegroundColor Green
Write-Host "  Installer: $installer"

# Git commit and push
Write-Host "`n  Committing version bump..." -ForegroundColor Gray
Push-Location $root
try {
    git add package.json electron/package.json
    git commit -m "chore: bump version to v$newVersion`n`nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    git push origin main
} finally {
    Pop-Location
}

# Create GitHub release
Write-Host "`n  Creating GitHub Release v$newVersion..." -ForegroundColor Yellow

$releaseArgs = @("release", "create", "v$newVersion")
$releaseArgs += $installer
if (Test-Path $latestYml) { $releaseArgs += $latestYml }
if (Test-Path $blockmap) { $releaseArgs += $blockmap }
$releaseArgs += "--title"
$releaseArgs += "FinPulse v$newVersion"
$releaseArgs += "--generate-notes"

Push-Location $root
try {
    & gh @releaseArgs
    if ($LASTEXITCODE -ne 0) { throw "GitHub release creation failed" }
} finally {
    Pop-Location
}

Write-Host "`n  Release v$newVersion published!" -ForegroundColor Green
Write-Host "  https://github.com/YogiJogiFresh/FinPulse/releases/tag/v$newVersion`n"
