$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $projectRoot 'release\windows'
$targetDir = Join-Path $projectRoot 'src-tauri\target\release'
$bundleDir = Join-Path $targetDir 'bundle\nsis'
$temporaryDrive = $null
$previousCargoTargetDir = $env:CARGO_TARGET_DIR

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

if ($projectRoot.Contains('$')) {
  $temporaryDrive = @('Z:', 'Y:', 'X:', 'W:', 'V:') |
    Where-Object { -not (Test-Path "$_\") } |
    Select-Object -First 1

  if (-not $temporaryDrive) {
    throw 'No hay una letra de unidad disponible para empaquetar con NSIS.'
  }

  subst.exe $temporaryDrive $projectRoot
  $env:CARGO_TARGET_DIR = "$temporaryDrive\src-tauri\target"
}

Push-Location $projectRoot
try {
  npm run tauri:build -- --bundles nsis
} finally {
  Pop-Location
  $env:CARGO_TARGET_DIR = $previousCargoTargetDir
  if ($temporaryDrive) {
    subst.exe $temporaryDrive /D
  }
}

$portableSource = Join-Path $targetDir 'sharky.exe'
$portableTarget = Join-Path $releaseDir '$harky-portable.exe'
Copy-Item -LiteralPath $portableSource -Destination $portableTarget -Force

$installer = Get-ChildItem -LiteralPath $bundleDir -Filter '*.exe' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $installer) {
  throw 'No se encontró el instalador NSIS generado por Tauri.'
}

$installerTarget = Join-Path $releaseDir '$harky-setup.exe'
Copy-Item -LiteralPath $installer.FullName -Destination $installerTarget -Force

Write-Host ''
Write-Host 'Paquetes Windows listos:'
Write-Host "  Instalador: $installerTarget"
Write-Host "  Portable:   $portableTarget"
