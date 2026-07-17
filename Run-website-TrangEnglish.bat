@echo off
setlocal EnableExtensions
chcp 65001 >nul

rem Luon cd ve thu muc chua file .bat nay — khong hardcode o dia / duong dan
cd /d "%~dp0"
if errorlevel 1 (
  echo Khong vao duoc thu muc: "%~dp0"
  pause
  exit /b 1
)

if not exist "package.json" (
  echo Khong tim thay package.json trong:
  echo   %CD%
  echo Hay dat file .bat nay trong thu muc goc cua project.
  pause
  exit /b 1
)

echo Thu muc project: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Chua cai Node.js hoac chua co trong PATH.
  echo Tai Node.js LTS: https://nodejs.org
  echo Cai xong, mo lai cua so moi, roi chay lai file nay.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo Tim thay Node nhung khong tim thay npm trong PATH.
  echo Cai lai Node.js LTS tu https://nodejs.org roi thu lai.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Dang cai dat lan dau ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo Cai dat that bai.
    pause
    exit /b 1
  )
  echo.
)

echo Dang mo website...
echo De tat: dong cua so nay hoac bam Ctrl+C
echo Trinh duyet se mo sau khi server san sang.
echo.

rem Mo trinh duyet sau ~2s (doi Vite khoi dong) — khong can doi thu muc
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173/"

call npm run dev
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo Website dung voi ma loi %EXITCODE%.
) else (
  echo Da tat website.
)
pause
endlocal & exit /b %EXITCODE%
