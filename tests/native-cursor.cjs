const {execFile}=require('node:child_process'),{promisify}=require('node:util');const exec=promisify(execFile);
async function cursor(point){
 if(point&&(!Number.isFinite(point.x)||!Number.isFinite(point.y)))throw Error('Invalid test cursor point');
 const code="using System; using System.Runtime.InteropServices; public class LunaTestCursor { [StructLayout(LayoutKind.Sequential)] public struct Point { public int X; public int Y; } [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int x,int y); [DllImport(\"user32.dll\")] public static extern bool GetCursorPos(out Point p); [DllImport(\"user32.dll\")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c); }";
 const script=`Add-Type -TypeDefinition '${code}'\n$null=[LunaTestCursor]::SetProcessDpiAwarenessContext([IntPtr](-4))\n${point?`$null=[LunaTestCursor]::SetCursorPos(${Math.round(point.x)},${Math.round(point.y)})`:''}\n$taskCursorPoint=New-Object LunaTestCursor+Point\n$null=[LunaTestCursor]::GetCursorPos([ref]$taskCursorPoint)\n@{x=$taskCursorPoint.X;y=$taskCursorPoint.Y}|ConvertTo-Json -Compress`;
 const result=await exec('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',script],{windowsHide:true,timeout:15000});return JSON.parse(result.stdout.trim());
}
module.exports=cursor;
