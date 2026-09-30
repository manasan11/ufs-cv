@echo off
setlocal
cd /d "%~dp0"

netstat -ano | findstr ":3307" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting MySQL on port 3307...
  start "MySQL 3307" /min "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --defaults-file=C:\Users\HP\AppData\Local\Temp\opencode\cvgen-mysql\my.ini
  timeout /t 10 /nobreak >nul
) else (
  echo MySQL already running on 3307.
)

netstat -ano | findstr ":4000" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo Port 4000 is busy - the API may already be running.
)

echo Starting API on http://localhost:4000
start "CV API" cmd /k "cd /d %~dp0server && npm run dev"

echo Starting web app on http://localhost:4200
start "CV Web" cmd /k "cd /d %~dp0web && npm start"

echo.
echo Open http://localhost:4200 when the web window says "compiled successfully".
echo Close the two windows to stop the app.
endlocal
