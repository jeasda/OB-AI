@echo off
setlocal

set "BASE_URL=https://ob-ai-submit-proxy.legacy-project.workers.dev"

echo [health]
curl.exe -s "%BASE_URL%/health"
echo.
echo [debug/env]
for /f "delims=" %%A in ('curl.exe -s "%BASE_URL%/debug/env"') do set "ENV_JSON=%%A"
echo %ENV_JSON%
echo.

echo %ENV_JSON% | findstr /c:"\"hasRunpodKey\":true" >nul && echo hasRunpodKey: true || echo hasRunpodKey: false
echo %ENV_JSON% | findstr /c:"\"hasRunpodEndpoint\":true" >nul && echo hasRunpodEndpoint: true || echo hasRunpodEndpoint: false
echo %ENV_JSON% | findstr /c:"\"hasR2Binding\":true" >nul && echo hasR2Binding: true || echo hasR2Binding: false

endlocal
