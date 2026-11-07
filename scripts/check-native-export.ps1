param([Parameter(Mandatory=$true)][int]$AppProcessId,[Parameter(Mandatory=$true)][string]$SavePath,[switch]$Cancel)
$ErrorActionPreference='Stop'
if (!$env:CI -or !$env:RUNNER_TEMP) {throw 'Native export checks run only on an isolated CI runner.'}
$root=[IO.Path]::GetFullPath($env:RUNNER_TEMP)
$target=[IO.Path]::GetFullPath($SavePath)
if (!$target.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($target) -ne '.json') {throw 'Export fixture must be a JSON file in the runner temporary directory.'}
. "$PSScriptRoot/desktop-window-check.ps1"
# On Windows Server, the shell's UIA provider omits classic dialog controls.
# Use the filename and Save/Cancel Win32 controls of this exact process's dialog.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
namespace HanStreamCi {
  public static class ExportDialog {
    private delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern IntPtr GetDlgItem(IntPtr dialog, int id);
    [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr window);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr window, EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wparam, string value);
    [DllImport("user32.dll", EntryPoint="SendMessageW")] private static extern IntPtr SendMessageValue(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    private static string ClassName(IntPtr window){var text=new StringBuilder(256);GetClassName(window,text,text.Capacity);return text.ToString();}
    private static IntPtr Find(IntPtr dialog,string className,int id){IntPtr found=IntPtr.Zero;EnumChildWindows(dialog,(window,parameter)=>{if(GetDlgCtrlID(window)==id && ClassName(window)==className){found=window;return false;}return true;},IntPtr.Zero);return found;}
    private static IntPtr FileName(IntPtr dialog) {
      // Modern Common Item Dialogs nest Edit:1001 inside an unnumbered
      // ComboBox. Match the edit class too, excluding the address toolbar.
      var modern=Find(dialog,"Edit",1001);
      if(modern!=IntPtr.Zero) return modern;
      // edt1 and cmb13 are the standard filename edit/combobox control IDs.
      foreach(var id in new[]{1152,1148}) {
        var container=GetDlgItem(dialog,id);
        if(container==IntPtr.Zero) continue;
        if(ClassName(container)=="Edit") return container;
        IntPtr edit=IntPtr.Zero;
        EnumChildWindows(container,(window,parameter)=>{if(ClassName(window)=="Edit"){edit=window;return false;}return true;},IntPtr.Zero);
        if(edit!=IntPtr.Zero) return edit;
      }
      return IntPtr.Zero;
    }
    public static bool SetFileName(IntPtr dialog,string path){var edit=FileName(dialog);return edit!=IntPtr.Zero && SendMessage(edit,0x000C,IntPtr.Zero,path)!=IntPtr.Zero;}
    public static bool Click(IntPtr dialog,int id){var button=Find(dialog,"Button",id);if(button==IntPtr.Zero)return false;SetForegroundWindow(dialog);SendMessageValue(dialog,0x0028,button,(IntPtr)1);return PostMessage(button,0x00F5,IntPtr.Zero,IntPtr.Zero);}
    public static string Describe(IntPtr dialog){var controls=new List<string>();EnumChildWindows(dialog,(window,parameter)=>{controls.Add(ClassName(window)+":"+GetDlgCtrlID(window));return true;},IntPtr.Zero);return string.Join(", ",controls);}
  }
}
"@
$deadline=[DateTime]::UtcNow.AddSeconds(30)
$dialog=[IntPtr]::Zero
while ($dialog -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline) {
  $dialog=[HanStreamCi.Window]::Find($AppProcessId,'Export library')
  if ($dialog -eq [IntPtr]::Zero) {Start-Sleep -Milliseconds 100}
}
if ($dialog -eq [IntPtr]::Zero) {throw 'Export did not open a native Save As dialog.'}
if (!$Cancel) {
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  $ready=$false
  do {
    $ready=[HanStreamCi.ExportDialog]::SetFileName($dialog,$target)
    if (!$ready) {Start-Sleep -Milliseconds 100}
  } while (!$ready -and [DateTime]::UtcNow -lt $deadline)
  if (!$ready) {throw ('Native filename field unavailable: '+[HanStreamCi.ExportDialog]::Describe($dialog))}
}
$action=if ($Cancel) {2} else {1}
if (![HanStreamCi.ExportDialog]::Click($dialog,$action)) {throw ('Native save/cancel button unavailable: '+[HanStreamCi.ExportDialog]::Describe($dialog))}
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
