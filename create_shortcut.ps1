param(
    [string]$DestinationDir = ""
)

$projectDir = "C:\Users\aladi\VScode_Projects\AlertTrader_Strategy"
$pythonw = "C:\Python315\pythonw.exe"
$launchScript = Join-Path $projectDir "launch.py"
$iconFile = Join-Path $projectDir "icon.ico"

if (-not $DestinationDir) {
    # Default to Windows Desktop
    $regDesktop = Get-ItemPropertyValue "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name "Desktop" -ErrorAction SilentlyContinue
    if ($regDesktop -and (Test-Path $regDesktop)) {
        $DestinationDir = $regDesktop
    } else {
        $DestinationDir = Join-Path $env:USERPROFILE "Desktop"
    }
}

$shortcutPath = Join-Path $DestinationDir "Alert Trader.lnk"

Write-Output "Target shortcut path: $shortcutPath"
Write-Output "Target executable: $pythonw"
Write-Output "Script: $launchScript"
Write-Output "Icon: $iconFile"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $pythonw
$shortcut.Arguments = "`"$launchScript`""
$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = "$iconFile,0"
$shortcut.Description = "Launch AlertTrader Dashboard"
$shortcut.WindowStyle = 1 # Normal window
$shortcut.Save()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wsh) | Out-Null

if (Test-Path $shortcutPath) {
    Write-Output "SUCCESS: Shortcut created at '$shortcutPath'."
} else {
    Write-Error "FAILED: Shortcut could not be verified at '$shortcutPath'."
}

