Write-Host "=== Internite CRM Deploy ===" -ForegroundColor Cyan

# Step 1: Deploy frontend
Write-Host "`n[1/3] Uploading frontend..." -ForegroundColor Yellow
scp -r C:\Users\Krisc\Claude\Projects\NexaCRM\frontend\dist\* root@187.127.149.196:/home/nexacrm/frontend/
if ($LASTEXITCODE -eq 0) { Write-Host "  Frontend uploaded!" -ForegroundColor Green }
else { Write-Host "  Frontend upload FAILED" -ForegroundColor Red; exit 1 }

# Step 2: Deploy backend JAR
Write-Host "`n[2/3] Uploading backend JAR..." -ForegroundColor Yellow
scp C:\Users\Krisc\Claude\Projects\NexaCRM\backend\target\nexacrm-ai-backend-1.0.0.jar root@187.127.149.196:/home/nexacrm/backend/
if ($LASTEXITCODE -eq 0) { Write-Host "  Backend JAR uploaded!" -ForegroundColor Green }
else { Write-Host "  Backend upload FAILED" -ForegroundColor Red; exit 1 }

# Step 3: Restart backend
Write-Host "`n[3/3] Restarting backend service..." -ForegroundColor Yellow
ssh root@187.127.149.196 "systemctl stop nexacrm; sleep 3; systemctl start nexacrm"
if ($LASTEXITCODE -eq 0) { Write-Host "  Backend restarted!" -ForegroundColor Green }
else { Write-Host "  Backend restart FAILED" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Deploy Complete! ===" -ForegroundColor Cyan
