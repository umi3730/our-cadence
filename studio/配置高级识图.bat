@echo off
setlocal
cd /d "%~dp0"
title Our Cadence - Vision Setup

echo ==================================================
echo   Our Cadence 高级识图配置

echo   密钥只写入本机 studio\.env.local

echo   .gitignore 已忽略 .env*，不要把密钥提交到 GitHub。
echo ==================================================
echo.
set /p OPENAI_KEY=请输入 OPENAI_API_KEY: 
if "%OPENAI_KEY%"=="" (
  echo 未输入密钥，未修改任何文件。
  pause
  exit /b 1
)
> .env.local echo OPENAI_API_KEY=%OPENAI_KEY%
>> .env.local echo OPENAI_VISION_MODEL=gpt-5.6-luna

echo.
echo 已写入 .env.local。
echo 请关闭正在运行的 Our Cadence，再重新双击「启动 Our Cadence.bat」。
pause
endlocal
