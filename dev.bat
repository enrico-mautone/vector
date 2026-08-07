@echo off
start "vector-backend" cmd /k "cd /d %~dp0 && npm start"
start "vector-frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
