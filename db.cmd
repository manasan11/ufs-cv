@echo off
cd /d "%~dp0"
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -P 3307 -u cvapp -pcvapp_dev_pw -D cv_generator --table
