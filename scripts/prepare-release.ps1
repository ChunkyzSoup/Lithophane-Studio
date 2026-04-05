param(
  [string]$Version
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Version)) {
  $packageJsonPath = Join-Path $projectRoot "package.json"
  $packageJson = Get-Content -Raw -Path $packageJsonPath | ConvertFrom-Json
  $Version = [string]$packageJson.version
}

$releaseName = "Lithophane Studio"
$releaseSlug = "Lithophane-Studio"
$architecture = "x64"
$targetOs = "windows"

$rawExePath = Join-Path $projectRoot "src-tauri\target\release\lithophane-maker.exe"
$setupExePath = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis\Lithophane Studio_${Version}_${architecture}-setup.exe"
$msiPath = Join-Path $projectRoot "src-tauri\target\release\bundle\msi\Lithophane Studio_${Version}_${architecture}_en-US.msi"

$requiredPaths = @($rawExePath, $setupExePath, $msiPath)
$missingPaths = $requiredPaths | Where-Object { -not (Test-Path $_) }

if ($missingPaths.Count -gt 0) {
  throw "Missing build artifact(s):`n$($missingPaths -join "`n")`nRun 'npm run tauri build' first."
}

$releaseRoot = Join-Path $projectRoot "release\$targetOs\$architecture\$Version"
$portableRoot = Join-Path $releaseRoot "portable"
$portableAppRoot = Join-Path $portableRoot $releaseName

if (Test-Path $releaseRoot) {
  Remove-Item -Recurse -Force -LiteralPath $releaseRoot
}

New-Item -ItemType Directory -Path $portableAppRoot -Force | Out-Null

$portableExeName = "$releaseName.exe"
$portableExePath = Join-Path $portableAppRoot $portableExeName
$portableReadmePath = Join-Path $portableAppRoot "README.txt"

Copy-Item -LiteralPath $rawExePath -Destination $portableExePath

$portableReadme = @"
$releaseName portable build

How to use:
1. Extract this folder anywhere you like.
2. Run '$portableExeName'.
3. If Windows SmartScreen warns, choose More info and then Run anyway until the app is code signed.

Included files:
- ${portableExeName}: the standalone desktop app

Notes:
- This build is local-first and offline-first.
- STL export works in the desktop runtime.
- For the normal install experience, use the setup .exe or .msi build instead.
"@

Set-Content -Path $portableReadmePath -Value $portableReadme -Encoding UTF8

$portableZipName = "${releaseSlug}_${Version}_${architecture}_portable.zip"
$portableZipPath = Join-Path $releaseRoot $portableZipName

Compress-Archive -Path $portableAppRoot -DestinationPath $portableZipPath -CompressionLevel Optimal

$releaseSetupName = "${releaseSlug}_${Version}_${architecture}_setup.exe"
$releaseSetupPath = Join-Path $releaseRoot $releaseSetupName
Copy-Item -LiteralPath $setupExePath -Destination $releaseSetupPath

$releaseMsiName = "${releaseSlug}_${Version}_${architecture}.msi"
$releaseMsiPath = Join-Path $releaseRoot $releaseMsiName
Copy-Item -LiteralPath $msiPath -Destination $releaseMsiPath

$artifactFiles = @(
  $releaseSetupPath,
  $releaseMsiPath,
  $portableZipPath
)

$checksumLines = foreach ($artifact in $artifactFiles) {
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $artifact
  "{0}  {1}" -f $hash.Hash.ToLowerInvariant(), (Split-Path -Leaf $artifact)
}

$checksumPath = Join-Path $releaseRoot "SHA256SUMS.txt"
Set-Content -Path $checksumPath -Value ($checksumLines -join "`r`n") -Encoding UTF8

$releaseNotesPath = Join-Path $releaseRoot "GITHUB_RELEASE_NOTES.md"
$releaseNotes = @"
# $releaseName v$Version

## Downloads

- ${releaseSetupName}: standard Windows installer
- ${releaseMsiName}: MSI installer for managed or manual deployment
- ${portableZipName}: portable ZIP containing ${portableExeName}

## Included in this release

- flat lithophane workflow
- grayscale and depth preview
- min and max thickness controls
- width and height with aspect lock
- invert, surface cleanup, and mesh density controls
- local STL export

## Notes

- This build is currently unsigned, so Windows SmartScreen may warn.
- Checksums are provided in SHA256SUMS.txt.
- The portable ZIP contains a renamed app binary for friendlier distribution.
"@

Set-Content -Path $releaseNotesPath -Value $releaseNotes -Encoding UTF8

$manifestPath = Join-Path $releaseRoot "release-manifest.json"
$manifest = [pscustomobject]@{
  name = $releaseName
  version = $Version
  platform = $targetOs
  architecture = $architecture
  artifacts = @(
    [pscustomobject]@{
      type = "setup"
      file = $releaseSetupName
    },
    [pscustomobject]@{
      type = "msi"
      file = $releaseMsiName
    },
    [pscustomobject]@{
      type = "portable"
      file = $portableZipName
      contains = $portableExeName
    }
  )
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "Release artifacts prepared at:"
Write-Host $releaseRoot
Write-Host ""
Write-Host "Artifacts:"
foreach ($artifact in $artifactFiles) {
  Write-Host ("- " + $artifact)
}
Write-Host ("- " + $checksumPath)
Write-Host ("- " + $releaseNotesPath)
Write-Host ("- " + $manifestPath)
