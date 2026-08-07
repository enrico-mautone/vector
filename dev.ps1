# Avvia backend (Express, :3000) e frontend (Vite, :5173) in due finestre separate.
$root = $PSScriptRoot

Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root'; npm start"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\frontend'; npm run dev"

Write-Host "Backend e frontend avviati in finestre separate."
Write-Host "Backend:  http://localhost:3000"
Write-Host "Frontend: http://localhost:5173"
