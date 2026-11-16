@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py s8.py) else (python s8.py)
pause
