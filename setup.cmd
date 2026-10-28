@echo off
cd /d "%~dp0"
call npm run setup
if errorlevel 1 goto done
call npm run build
:done
pause
