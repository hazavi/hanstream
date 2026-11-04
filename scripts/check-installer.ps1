$ErrorActionPreference = 'Stop'
if (!$env:CI -or !$env:RUNNER_TEMP) { throw 'This installer check runs only on an isolated CI runner.' }
$template = Get-ChildItem -LiteralPath './src-tauri/target/release' -Filter 'installer.nsi' -Recurse | Select-Object -First 1
if (!$template) { throw 'The generated NSIS installer script is missing.' }
$text = Get-Content -LiteralPath $template.FullName -Raw
foreach ($feature in @('MUI_PAGE_DIRECTORY', 'MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateOrUpdateDesktopShortcut', 'WriteUninstaller "$INSTDIR\uninstall.exe"')) {
  if (!$text.Contains($feature)) { throw "Installer feature is missing: $feature" }
}
$installer = Get-ChildItem -LiteralPath './src-tauri/target/release/bundle/nsis' -Filter '*-setup.exe' | Select-Object -First 1
if (!$installer) { throw 'The installer is missing.' }
$temporaryRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP)
$installDirectory = [IO.Path]::GetFullPath((Join-Path $temporaryRoot 'hanstream-install-check'))
if (!$installDirectory.StartsWith($temporaryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Install check path is outside the runner temporary directory.' }
$process = Start-Process -FilePath $installer.FullName -ArgumentList '/S','/NS',"/D=$installDirectory" -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
if (!(Test-Path -LiteralPath (Join-Path $installDirectory 'hanstream.exe'))) { throw 'App was not installed in the chosen folder.' }
$uninstaller = Join-Path $installDirectory 'uninstall.exe'
if (!(Test-Path -LiteralPath $uninstaller)) { throw 'Uninstaller was not placed in the installation folder.' }
$process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Uninstaller failed: $($process.ExitCode)" }
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while ((Test-Path -LiteralPath (Join-Path $installDirectory 'hanstream.exe')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
if (Test-Path -LiteralPath (Join-Path $installDirectory 'hanstream.exe')) { throw 'Uninstall did not remove the application.' }
Write-Output 'Installer directory page, optional desktop shortcut, selected folder, and local uninstaller passed.'
