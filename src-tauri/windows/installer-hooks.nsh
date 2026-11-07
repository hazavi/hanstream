; Restart Manager reports every process holding the executable, including Explorer
; and scanners. Check the executable image path instead: never kill another app,
; another installation, or a portable copy just because it has the same filename.
Var HanStreamProcessTarget

!macro HanStreamProcessCheckFunction prefix
Function ${prefix}HanStreamCheckProcesses
  System::Call 'kernel32::CreateToolhelp32Snapshot(i 2, i 0) p.r4'
  IntCmp $4 -1 process_check_error
  System::Alloc 556
  Pop $5
  StrCmp $5 0 process_check_snapshot_error
  System::Call '*$5(i 556)'
  System::Call 'kernel32::Process32FirstW(p r4, p r5) i.r6'
  process_check_next:
    StrCmp $6 0 process_check_done
    System::Call '*$5(i, i, i .r7)'
    ; Query, synchronize, and terminate rights on this single process only.
    System::Call 'kernel32::OpenProcess(i 0x101001, i 0, i r7) p.r8'
    StrCmp $8 0 process_check_advance
    System::Call 'kernel32::QueryFullProcessImageNameW(p r8, i 0, w .r9, *i ${NSIS_MAX_STRLEN} r3) i.r6'
    StrCmp $6 0 process_check_close
    StrCmp $9 $HanStreamProcessTarget 0 process_check_close
    IfSilent process_check_stop
    MessageBox MB_OKCANCEL|MB_ICONQUESTION 'HanStream is still running in the background. Close this installed copy to continue?' IDOK process_check_stop
    System::Call 'kernel32::CloseHandle(p r8)'
    System::Free $5
    System::Call 'kernel32::CloseHandle(p r4)'
    Abort 'Close HanStream before continuing.'
  process_check_stop:
    System::Call 'kernel32::TerminateProcess(p r8, i 0) i.r6'
    StrCmp $6 0 process_check_stop_error
    System::Call 'kernel32::WaitForSingleObject(p r8, i 8000) i.r6'
    StrCmp $6 0 process_check_close
  process_check_stop_error:
    System::Call 'kernel32::CloseHandle(p r8)'
    System::Free $5
    System::Call 'kernel32::CloseHandle(p r4)'
    Abort 'Windows could not close this copy of HanStream. Restart Windows and try again.'
  process_check_close:
    System::Call 'kernel32::CloseHandle(p r8)'
  process_check_advance:
    System::Call 'kernel32::Process32NextW(p r4, p r5) i.r6'
    Goto process_check_next
  process_check_done:
    System::Free $5
    System::Call 'kernel32::CloseHandle(p r4)'
    Return
  process_check_snapshot_error:
    System::Call 'kernel32::CloseHandle(p r4)'
  process_check_error:
    Abort 'Windows could not check running applications. Restart Windows and try again.'
FunctionEnd
!macroend

!insertmacro HanStreamProcessCheckFunction ""
!insertmacro HanStreamProcessCheckFunction "un."

!macro NSIS_HOOK_PREUNINSTALL
  !define HANSTREAM_UNINSTALL_CHECK
!macroend

!macroundef CheckIfAppIsRunning
!macro CheckIfAppIsRunning executablePath productName
  StrCpy $HanStreamProcessTarget "${executablePath}"
  !ifdef HANSTREAM_UNINSTALL_CHECK
    Call un.HanStreamCheckProcesses
  !else
    Call HanStreamCheckProcesses
  !endif
!macroend
