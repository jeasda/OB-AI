@echo off
setlocal

powershell -NoProfile -Command "$key=$env:RUNPOD_API_KEY; if (-not $key) { Write-Host 'RUNPOD_API_KEY is not set in the environment.'; exit 1 }; try { $resp=Invoke-WebRequest -Uri 'https://rest.runpod.io/v1/endpoints' -Headers @{ Authorization = ('Bearer ' + $key) } -Method Get -UseBasicParsing; Write-Host ('RunPod key OK (' + $resp.StatusCode + ').'); exit 0 } catch { $status = $_.Exception.Response.StatusCode.value__ 2>$null; if (-not $status) { $status = 'unknown' }; Write-Host ('RunPod key failed (' + $status + ').'); exit 1 }"

endlocal
