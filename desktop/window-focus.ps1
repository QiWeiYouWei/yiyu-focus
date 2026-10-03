Add-Type -TypeDefinition 'using System;
using System.Runtime.InteropServices;
public static class YiyuWindowFocus {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr pid);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
 public static bool Restore(IntPtr handle) {
  if (!IsWindow(handle)) return false;
  if (GetForegroundWindow() == handle) return true;
  uint current = GetCurrentThreadId(), foreground = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
  bool attached = current != foreground && AttachThreadInput(current, foreground, true);
  try { return SetForegroundWindow(handle); } finally { if (attached) AttachThreadInput(current, foreground, false); }
 }
}'
[Console]::WriteLine('READY')
while ($null -ne ($focusCommand = [Console]::ReadLine())) {
 if ($focusCommand -eq 'get') { [Console]::WriteLine([YiyuWindowFocus]::GetForegroundWindow().ToInt64()) }
 elseif ($focusCommand -match '^restore ([0-9]+)$') {
  $focusHandle = [IntPtr]([long]$Matches[1])
  [Console]::WriteLine([YiyuWindowFocus]::Restore($focusHandle))
 } else { [Console]::WriteLine('False') }
}
