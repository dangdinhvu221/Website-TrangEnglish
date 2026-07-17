# Đóng gói project để copy sang máy khác (Windows PowerShell)
# Chạy:  powershell -ExecutionPolicy Bypass -File scripts/pack.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  $root = Get-Location
}

$name = 'website-English'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$outZip = Join-Path (Split-Path $root -Parent) "$name-$stamp.zip"
$stage = Join-Path $env:TEMP "$name-pack-$stamp"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

$excludeDirs = @('node_modules', 'dist', '.git', '.vite')
Get-ChildItem -Path $root -Force | Where-Object {
  $excludeDirs -notcontains $_.Name
} | ForEach-Object {
  Copy-Item $_.FullName -Destination (Join-Path $stage $_.Name) -Recurse -Force
}

if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $outZip -Force
Remove-Item $stage -Recurse -Force

Write-Host ''
Write-Host "Da tao: $outZip"
Write-Host ''
Write-Host 'Tren may moi:'
Write-Host '  1. Cai Node.js LTS: https://nodejs.org'
Write-Host '  2. Giai nen file zip'
Write-Host '  3. Mo terminal trong thu muc project:'
Write-Host '       npm install'
Write-Host '       npm run dev'
Write-Host '  4. Mo http://localhost:5173'
Write-Host ''
