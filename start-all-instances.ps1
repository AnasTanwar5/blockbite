# BlockBite Multi-Instance Test Setup
# This script starts 3 frontend role instances of BlockBite on ports 3001, 3002, 3003
# Make sure you have the Hardhat node running first: npm run node

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  BLOCKBITE Multi-Instance Launcher" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$ROOT = Get-Location

# 1. Check if Hardhat node is running
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8545" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "✅ Hardhat local node is running on port 8545" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Hardhat node is NOT running on port 8545" -ForegroundColor Yellow
    Write-Host "   Starting local Hardhat node in background..." -ForegroundColor Gray
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT'; npm run node"
    Start-Sleep -Seconds 3
}

# 2. Check if main Backend Server is running on port 5000
try {
    $health = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "✅ Main Express API & Socket Server is running on port 5000" -ForegroundColor Green
} catch {
    Write-Host "🚀 Starting Express API & Real-time Socket Server on port 5000..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\server'; npm run dev"
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "Starting 3 Role-Based BlockBite Frontend Instances..." -ForegroundColor Cyan
Write-Host ""

# Instance 1: Customer (Port 3001)
Write-Host "🚀 Starting Instance 1 (Customer Portal) on port 3001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\client'; `$env:VITE_INSTANCE='1'; npx vite --port 3001"
Start-Sleep -Seconds 2

# Instance 2: Restaurant (Port 3002)
Write-Host "🚀 Starting Instance 2 (Restaurant Portal) on port 3002..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\client'; `$env:VITE_INSTANCE='2'; npx vite --port 3002"
Start-Sleep -Seconds 2

# Instance 3: Delivery Driver (Port 3003)
Write-Host "🚀 Starting Instance 3 (Delivery Driver Portal) on port 3003..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\client'; `$env:VITE_INSTANCE='3'; npx vite --port 3003"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  🎉 All 3 BlockBite Test Portals Launched Successfully!" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🛒 Tab 1 (Customer):          http://localhost:3001" -ForegroundColor Yellow
Write-Host "  🍕 Tab 2 (Restaurant):        http://localhost:3002" -ForegroundColor Yellow
Write-Host "  🛵 Tab 3 (Delivery Driver):   http://localhost:3003" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ⚡ Central Express API & Sockets: http://localhost:5000" -ForegroundColor Gray
Write-Host "  ⛓️ Hardhat Web3 Local Node:     http://127.0.0.1:8545" -ForegroundColor Gray
Write-Host ""
Write-Host "Recommended Testing Flow:" -ForegroundColor Magenta
Write-Host "  1. Open http://localhost:3001 as Customer (customer@blockbite.com) and place an order." -ForegroundColor Gray
Write-Host "  2. Open http://localhost:3002 as Restaurant (mario@pizzabite.eth) and accept the order." -ForegroundColor Gray
Write-Host "  3. Open http://localhost:3003 as Driver (driver@blockbite.com) and deliver using OTP." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"

