<#
  Copies the native sources from native\android into the Capacitor-generated android\
  project and appends the Gradle dependencies they need.

  Run it after `npx cap add android`, and after any `cap update` that may have rewritten
  android\. The script is idempotent: running it again changes nothing and duplicates no lines.

  Usage:  powershell -ExecutionPolicy Bypass -File scripts\apply-native.ps1
#>

$ErrorActionPreference = 'Stop'

# Versions verified against the registries on 2026-09-28.
$healthConnectVersion = '1.1.0'   # latest stable; 1.2.0 is still alpha
$coroutinesVersion = '1.11.0'
$googleServicesVersion = '4.5.0'
# Capacitor 8 ships Kotlin 2.2.20 and defines kotlin_version in variables.gradle;
# this value is only a fallback when that variable is missing.
$kotlinVersion = '2.2.20'

$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root 'android'
$source = Join-Path $root 'native\android'

if (-not (Test-Path $android)) {
    Write-Error "No android\ directory. Run `npx cap add android` first."
}

$changes = @()

# Windows PowerShell 5.1 writes a BOM with `-Encoding utf8`, and Gradle's Groovy parser
# rejects a BOM at the start of build.gradle ("Unexpected character").
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
function Write-Utf8NoBom([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

# --- 1. Kotlin sources and the manifest -----------------------------------
$javaRoot = Join-Path $android 'app\src\main\java\com\egor\sportstats'
New-Item -ItemType Directory -Force -Path $javaRoot | Out-Null

foreach ($name in @('HealthConnectPlugin.kt', 'MainActivity.kt')) {
    Copy-Item (Join-Path $source "app\src\main\java\com\egor\sportstats\$name") $javaRoot -Force
    $changes += "copied $name"
}

# Capacitor generates MainActivity.java — two activities with the same name will not build.
$javaActivity = Join-Path $javaRoot 'MainActivity.java'
if (Test-Path $javaActivity) {
    Remove-Item $javaActivity -Force
    $changes += 'removed MainActivity.java (replaced by the .kt version)'
}

Copy-Item (Join-Path $source 'app\src\main\AndroidManifest.xml') (Join-Path $android 'app\src\main\AndroidManifest.xml') -Force
$changes += 'updated AndroidManifest.xml (Health Connect permissions)'

# --- 2. App-level dependencies --------------------------------------------
$appGradlePath = Join-Path $android 'app\build.gradle'
$appGradle = Get-Content $appGradlePath -Raw

if ($appGradle -notmatch 'kotlin-android') {
    $appGradle = $appGradle -replace "(?m)^(apply plugin: 'com\.android\.application')", "`$1`napply plugin: 'kotlin-android'"
    $changes += 'applied the kotlin-android plugin'
}

if ($appGradle -notmatch 'connect-client') {
    $deps = @"
    implementation "androidx.health.connect:connect-client:`$healthConnectVersion"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:`$coroutinesVersion"
"@
    # Insert into the first dependencies block.
    $appGradle = [regex]::Replace($appGradle, '(?m)^dependencies \{', "dependencies {`n$deps", 1)
    $changes += 'added the Health Connect and coroutines dependencies'
}

# google-services is required for Google sign-in in the APK (@capacitor-firebase/authentication).
if ($appGradle -notmatch 'com\.google\.gms\.google-services') {
    $appGradle = $appGradle.TrimEnd() + "`n`napply plugin: 'com.google.gms.google-services'`n"
    $changes += 'applied the google-services plugin'
}

Write-Utf8NoBom $appGradlePath $appGradle

# --- 3. Project versions and classpath ------------------------------------
$varsPath = Join-Path $android 'variables.gradle'
if (Test-Path $varsPath) {
    $vars = Get-Content $varsPath -Raw
    if ($vars -notmatch 'healthConnectVersion') {
        $vars = [regex]::Replace(
            $vars,
            '(?m)^ext \{',
            "ext {`n    healthConnectVersion = '$healthConnectVersion'`n    coroutinesVersion = '$coroutinesVersion'",
            1)
        Write-Utf8NoBom $varsPath $vars
        $changes += 'added the versions to variables.gradle'
    }
    # connect-client declares minSdk 26 (Health Connect needs Android 8+), while Capacitor
    # generates 24 — the manifest merger fails the build otherwise.
    if ($vars -match 'minSdkVersion = (\d+)' -and [int]$Matches[1] -lt 26) {
        $vars = [regex]::Replace($vars, 'minSdkVersion = \d+', 'minSdkVersion = 26')
        Write-Utf8NoBom $varsPath $vars
        $changes += 'raised minSdkVersion to 26 (required by Health Connect)'
    }
}

$rootGradlePath = Join-Path $android 'build.gradle'
$rootGradle = Get-Content $rootGradlePath -Raw

# Capacitor 8 already defines kotlin_version; reuse it instead of pinning our own.
if ($rootGradle -notmatch 'kotlin-gradle-plugin') {
    $kotlinRef = if ($rootGradle -match 'kotlin_version') { '$kotlin_version' } else { $kotlinVersion }
    $rootGradle = [regex]::Replace(
        $rootGradle,
        "(?m)^(\s*)(classpath 'com\.android\.tools\.build:gradle.*)$",
        "`$1`$2`n`$1classpath `"org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinRef`"",
        1)
    $changes += 'added the kotlin-gradle-plugin classpath'
}

if ($rootGradle -notmatch 'com\.google\.gms:google-services') {
    $rootGradle = [regex]::Replace(
        $rootGradle,
        "(?m)^(\s*)(classpath 'com\.android\.tools\.build:gradle.*)$",
        "`$1`$2`n`$1classpath 'com.google.gms:google-services:$googleServicesVersion'",
        1)
    $changes += 'added the google-services classpath'
}

Write-Utf8NoBom $rootGradlePath $rootGradle

# --- 4. Checks the script cannot perform itself ---------------------------
$warnings = @()

if (-not (Test-Path (Join-Path $android 'app\google-services.json'))) {
    $warnings += 'android\app\google-services.json is missing — download it from the Firebase console (Project settings -> Your apps -> Android), otherwise Google sign-in in the APK will not work'
}

$stringsPath = Join-Path $android 'app\src\main\res\values\strings.xml'
if ((Test-Path $stringsPath) -and ((Get-Content $stringsPath -Raw) -notmatch 'server_client_id')) {
    $warnings += 'strings.xml has no server_client_id — add <string name="server_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>'
}

Write-Host "`nDone. Changes:" -ForegroundColor Green
$changes | ForEach-Object { Write-Host "  + $_" }

if ($warnings.Count -gt 0) {
    Write-Host "`nStill to do manually:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  ! $_" }
}
