param([Parameter(Mandatory=$true)][int]$AppProcessId,[Parameter(Mandatory=$true)][string]$SavePath,[switch]$Cancel)
$ErrorActionPreference='Stop'
if (!$env:CI -or !$env:RUNNER_TEMP) {throw 'Native export checks run only on an isolated CI runner.'}
$root=[IO.Path]::GetFullPath($env:RUNNER_TEMP)
$target=[IO.Path]::GetFullPath($SavePath)
if (!$target.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($target) -ne '.json') {throw 'Export fixture must be a JSON file in the runner temporary directory.'}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$condition=[Windows.Automation.AndCondition]::new([Windows.Automation.Condition[]]@(
  (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty,$AppProcessId)),
  (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Export library')),
  (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Window))
))
$deadline=[DateTime]::UtcNow.AddSeconds(30)
$dialog=$null
while (!$dialog -and [DateTime]::UtcNow -lt $deadline) {
  $dialog=[Windows.Automation.AutomationElement]::RootElement.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
  if (!$dialog) {Start-Sleep -Milliseconds 150}
}
if (!$dialog) {throw 'Export did not open a native Save As dialog.'}
if ($Cancel) {
  $action=$dialog.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty,'2')))
} else {
  $filename=$dialog.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.AndCondition(
    (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty,'1001')),
    (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Edit))
  )))
  if (!$filename) {throw 'The native filename field is unavailable.'}
  $value=$filename.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)
  $value.SetValue($target)
  $action=$dialog.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty,'1')))
}
if (!$action) {throw 'The native save/cancel button is unavailable.'}
$invoke=$action.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
$invoke.Invoke()
if ($Cancel) {
  if (Test-Path -LiteralPath $target) {throw 'Cancelling export created a file.'}
  Write-Output 'Native Save As cancellation passed.'
} else {
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  while (!(Test-Path -LiteralPath $target) -and [DateTime]::UtcNow -lt $deadline) {Start-Sleep -Milliseconds 100}
  $data=Get-Content -LiteralPath $target -Raw | ConvertFrom-Json
  if ($data.format -ne 'hanstream-library' -or $data.version -ne 1 -or $data.profile.watchlist[0].slug -ne 'storage-check' -or $data.profile.watchedEpisodes.'storage-check'[0] -ne 's1e10') {throw 'Native export did not preserve the saved library and watched history.'}
  Write-Output 'Native Save As file selection and valid JSON export passed.'
}
