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
# Reproduce the failed upgrade: the registered legacy uninstaller always exits
# with an error. Passive mode still executes the already-installed page callback.
# Upgrade must skip that old command and replace the app/uninstaller in place.
$registration = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\HanStream'
if (!(Test-Path -LiteralPath $registration)) { throw 'Installed app registration is missing.' }
Set-ItemProperty -LiteralPath $registration -Name DisplayVersion -Value '0.1.0'
Set-ItemProperty -LiteralPath $registration -Name UninstallString -Value ('"' + (Join-Path $env:WINDIR 'System32/cmd.exe') + '" /D /C exit 2')
$sentinel = Join-Path $installDirectory 'preserve-on-upgrade.txt'
[IO.File]::WriteAllText($sentinel, 'Preserve existing local files.')
$upgrade = Start-Process -FilePath $installer.FullName -ArgumentList '/P','/NS',"/D=$installDirectory" -WindowStyle Hidden -PassThru
try {
  if (!$upgrade.WaitForExit(60000)) { throw 'Upgrade invoked the broken legacy uninstaller or became stuck.' }
  if ($upgrade.ExitCode -ne 0) { throw "In-place upgrade failed: $($upgrade.ExitCode)" }
  if ((Get-ItemProperty -LiteralPath $registration).UninstallString -notlike '*uninstall.exe*') { throw 'Upgrade did not replace the broken uninstall command.' }
  if ([IO.File]::ReadAllText($sentinel) -ne 'Preserve existing local files.') { throw 'Upgrade removed existing local files.' }
} finally {
  $upgrade.Refresh()
  if (!$upgrade.HasExited) { Stop-Process -Id $upgrade.Id -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $sentinel -Force
}
# Closing the real app must exit its process, even though playback has a child WebView.
$appPath = Join-Path $installDirectory 'hanstream.exe'
$app = Start-Process -FilePath $appPath -WindowStyle Hidden -PassThru
try {
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  do { Start-Sleep -Milliseconds 250; $app.Refresh() } while (!$app.HasExited -and $app.MainWindowHandle -eq 0 -and [DateTime]::UtcNow -lt $deadline)
  if ($app.HasExited -or !$app.CloseMainWindow()) { throw 'The installed app did not create a closable window.' }
  if (!$app.WaitForExit(15000)) { throw 'Closing the app left its background process running.' }
} finally { if (!$app.HasExited) { Stop-Process -Id $app.Id -ErrorAction SilentlyContinue } }

# A different portable copy with the same filename must not block uninstall.
$fixtureDirectory = Join-Path $temporaryRoot 'hanstream-process-check'
New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
$fixture = Join-Path $fixtureDirectory 'hanstream.exe'
# Use a signed Windows executable as the process fixture. A generated invisible
# sleeper can trigger antivirus heuristics and does not improve this path check.
Copy-Item -LiteralPath (Join-Path $env:WINDIR 'System32/cmd.exe') -Destination $fixture -Force
$otherCopy = Start-Process -FilePath $fixture -ArgumentList '/D','/K' -WindowStyle Hidden -PassThru
# Restart Manager also reports non-app file handles. This handle permits deletion
# and must not cause the uninstaller to try to terminate the PowerShell runner.
$fileHolder = [IO.File]::Open($appPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
try {
$process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Uninstaller failed: $($process.ExitCode)" }
# A delete-sharing handle permits DeleteFile but can defer physical removal until
# it closes. Keep it open during the check, then release it before checking files.
$fileHolder.Dispose()
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while ((Test-Path -LiteralPath (Join-Path $installDirectory 'hanstream.exe')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
if (Test-Path -LiteralPath (Join-Path $installDirectory 'hanstream.exe')) { throw 'Uninstall did not remove the application.' }
$otherCopy.Refresh()
if ($otherCopy.HasExited) { throw 'Uninstaller terminated a different portable installation.' }
} finally { $fileHolder.Dispose(); if (!$otherCopy.HasExited) { Stop-Process -Id $otherCopy.Id } }

# Repair an old release whose invisible process is still running in this exact
# installation folder. Silent uninstall may stop that copy, and only that copy.
$process = Start-Process -FilePath $installer.FullName -ArgumentList '/S','/NS',"/D=$installDirectory" -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw 'Reinstall for the orphan-process check failed.' }
Copy-Item -LiteralPath $fixture -Destination $appPath -Force
$orphan = Start-Process -FilePath $appPath -ArgumentList '/D','/K' -WindowStyle Hidden -PassThru
try {
  Start-Sleep -Milliseconds 500
  $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw 'Uninstall could not close the exact installed background process.' }
  if (!$orphan.WaitForExit(15000)) { throw 'Installed background process survived uninstall.' }
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ((Test-Path -LiteralPath $appPath) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
  if (Test-Path -LiteralPath $appPath) { throw 'Uninstall left the background-process executable installed.' }
} finally { if (!$orphan.HasExited) { Stop-Process -Id $orphan.Id -ErrorAction SilentlyContinue } }
Write-Output 'Installer folder/shortcut, app close/exit, unrelated file handle, portable-copy isolation, background-process recovery, and local uninstaller passed.'
