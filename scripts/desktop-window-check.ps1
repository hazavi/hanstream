$ErrorActionPreference='Stop'
if (!$env:CI -or !$env:RUNNER_TEMP) { throw 'Native window checks run only on an isolated CI runner.' }
if (!('HanStreamCi.Window' -as [type])) {
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
namespace HanStreamCi {
  public static class Window {
    private delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    public static IntPtr Find(int processId, string title) {
      IntPtr result=IntPtr.Zero;
      EnumWindows((window,parameter)=>{uint process; GetWindowThreadProcessId(window,out process); if(process==processId){var text=new StringBuilder(512);GetWindowText(window,text,text.Capacity);if(text.ToString()==title){result=window;return false;}}return true;},IntPtr.Zero);
      return result;
    }
    public static bool Close(int processId){var window=Find(processId,"HanStream");return window!=IntPtr.Zero && PostMessage(window,0x0010,IntPtr.Zero,IntPtr.Zero);}
    public static void Minimize(int processId){ShowWindow(Find(processId,"HanStream"),6);}
    public static bool Minimized(int processId){return IsIconic(Find(processId,"HanStream"));}
  }
}
"@
}
function Wait-HanStreamWindow([int]$AppProcessId) {
  $deadline=[DateTime]::UtcNow.AddSeconds(30)
  do { $window=[HanStreamCi.Window]::Find($AppProcessId,'HanStream'); if ($window -ne [IntPtr]::Zero) {return $window}; Start-Sleep -Milliseconds 200 } while ([DateTime]::UtcNow -lt $deadline)
  throw 'The native main window did not appear.'
}
function Close-HanStreamWindow([int]$AppProcessId) {return [HanStreamCi.Window]::Close($AppProcessId)}
