@echo off
setlocal

echo [submit-proxy /health]
curl.exe -s "https://ob-ai-submit-proxy.legacy-project.workers.dev/health"
echo.
echo [submit-proxy /debug/env]
curl.exe -s "https://ob-ai-submit-proxy.legacy-project.workers.dev/debug/env"
echo.
echo [api /health]
curl.exe -i "https://ob-ai-api.legacy-project.workers.dev/health"
echo.

endlocal
