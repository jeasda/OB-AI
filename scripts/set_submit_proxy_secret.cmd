@echo off
setlocal

if "%RUNPOD_API_KEY%"=="" (
  echo RUNPOD_API_KEY is not set in the environment.
  exit /b 1
)

echo %RUNPOD_API_KEY%| npx wrangler secret put RUNPOD_API_KEY --name ob-ai-submit-proxy --env production

endlocal
