param(
  [ValidateSet('build', 'dev', 'run')]
  [string]$Mode = 'build',
  [ValidateSet('aarch64', 'armv7', 'i686', 'x86_64', 'all')]
  [string]$Target = 'aarch64',
  [ValidateSet('apk', 'aab', 'both')]
  [string]$Package = 'apk',
  [switch]$Debug,
  [string]$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$JavaHome = 'C:\Program Files\Android\Android Studio\jbr',
  [string]$NdkVersion = '29.0.14206865'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$releaseDir = Join-Path $repoRoot 'release\android'
$ndkHome = Join-Path $SdkRoot "ndk\$NdkVersion"

if (!(Test-Path -LiteralPath $JavaHome)) {
  throw "No se encontro Java en '$JavaHome'. Instala Android Studio o pasa -JavaHome."
}

if (!(Test-Path -LiteralPath $SdkRoot)) {
  throw "No se encontro Android SDK en '$SdkRoot'. Instala Android Studio o pasa -SdkRoot."
}

if (!(Test-Path -LiteralPath $ndkHome)) {
  throw "No se encontro Android NDK $NdkVersion en '$ndkHome'. Instala el NDK desde Android Studio SDK Manager."
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:NDK_HOME = $ndkHome
$env:PATH = "$JavaHome\bin;$SdkRoot\platform-tools;$SdkRoot\cmdline-tools\latest\bin;$env:PATH"

Set-Location $repoRoot

$androidOutputs = Join-Path $repoRoot 'src-tauri\gen\android\app\build\outputs'
if ($Mode -eq 'build' -and (Test-Path -LiteralPath $androidOutputs)) {
  Remove-Item -LiteralPath $androidOutputs -Recurse -Force
}
$jniLibs = Join-Path $repoRoot 'src-tauri\gen\android\app\src\main\jniLibs'
if ($Mode -eq 'build' -and (Test-Path -LiteralPath $jniLibs)) {
  Remove-Item -LiteralPath $jniLibs -Recurse -Force
}

switch ($Mode) {
  'dev' {
    npm run tauri -- android dev
    exit $LASTEXITCODE
  }
  'run' {
    npm run tauri -- android run
    exit $LASTEXITCODE
  }
  'build' {
    $buildArgs = @('run', 'tauri', '--', 'android', 'build', '--ci')
    if ($Package -in @('apk', 'both')) { $buildArgs += '--apk' }
    if ($Package -in @('aab', 'both')) { $buildArgs += '--aab' }
    if ($Debug) { $buildArgs += '--debug' }
    if ($Target -ne 'all') { $buildArgs += @('--target', $Target) }
    npm @buildArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Get-ChildItem -LiteralPath $releaseDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in '.apk', '.aab' } |
  Remove-Item -Force

$apkFiles = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'src-tauri\gen\android\app\build\outputs\apk') -Recurse -Filter '*.apk' -ErrorAction SilentlyContinue)
$aabFiles = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'src-tauri\gen\android\app\build\outputs\bundle') -Recurse -Filter '*.aab' -ErrorAction SilentlyContinue)

foreach ($file in @($apkFiles + $aabFiles)) {
  $kind = if ($file.Extension -eq '.apk') { 'apk' } else { 'aab' }
  $pathLower = $file.FullName.ToLowerInvariant()
  $profile = if ($pathLower -match 'debug') { 'debug' } elseif ($pathLower -match 'release') { 'release' } else { 'build' }
  $abi = if ($file.FullName -match '\\arm64-v8a\\') { 'arm64' } elseif ($file.FullName -match '\\armeabi-v7a\\') { 'armv7' } elseif ($file.FullName -match '\\x86_64\\') { 'x86_64' } elseif ($file.FullName -match '\\x86\\') { 'x86' } else { 'universal' }
  $signed = if ($file.Name -match 'unsigned') { '-unsigned' } else { '' }
  $name = "`$harky-android-$profile-$abi$signed.$kind"
  Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $releaseDir $name) -Force
}

Write-Host ''
Write-Host 'Paquetes Android listos:'
Get-ChildItem -LiteralPath $releaseDir -File | Where-Object { $_.Extension -in '.apk', '.aab' } | ForEach-Object {
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName
  Write-Host "  $($_.Name): $($_.FullName)"
  Write-Host "    SHA256: $($hash.Hash)"
}
