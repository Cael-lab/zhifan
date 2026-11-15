@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-zhifan.ps1" %*
if errorlevel 1 pause
