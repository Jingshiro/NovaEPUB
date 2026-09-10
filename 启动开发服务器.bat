@echo off
REM NovaEPUB 开发服务器一键启动
cd /d "%~dp0"

if not exist node_modules (
  echo [NovaEPUB] 首次运行，正在安装依赖...
  call npm install
)

echo [NovaEPUB] 正在启动开发服务器...
echo.
echo 启动后请浏览器打开: http://localhost:5173/
echo 按 Ctrl+C 可停止服务器
echo.
call npm run dev
pause