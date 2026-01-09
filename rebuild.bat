@echo off
chcp 65001 >nul
echo ========================================
echo   币安自动交易 - 桌面应用构建脚本
echo ========================================
echo.

cd /d "%~dp0"
echo 当前目录: %CD%
echo.

:: 检查是否在正确的目录
if not exist "package.json" (
    echo [错误] 未找到 package.json 文件！
    echo 请确保在项目根目录运行此脚本。
    echo.
    pause
    exit /b 1
)

echo [步骤 1/3] 清理缓存和构建产物...
if exist ".next" (
    echo 删除 .next 目录...
    rmdir /s /q .next
)
if exist "dist-electron" (
    echo 删除 dist-electron 目录...
    rmdir /s /q dist-electron
)
if exist "dist" (
    echo 删除 dist 目录...
    rmdir /s /q dist
)
echo 完成！
echo.

echo [步骤 2/3] 安装依赖...
pnpm install
if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败！
    echo 可能原因：
    echo   - 未安装 pnpm: 请运行 npm install -g pnpm
    echo   - 网络连接问题: 请检查网络或使用镜像源
    echo.
    pause
    exit /b 1
)
echo 完成！
echo.

echo [步骤 3/3] 构建桌面应用...
echo 注意: 此过程可能需要 5-10 分钟，请耐心等待...
echo.
pnpm electron:build
if errorlevel 1 (
    echo.
    echo [错误] 构建失败！
    echo 请检查上方的错误信息。
    echo.
    pause
    exit /b 1
)
echo.

echo ========================================
echo   构建成功！
echo ========================================
echo.
echo 安装包位置: %CD%\dist\币安自动交易 Setup 0.1.0.exe
echo.
echo 接下来请:
echo   1. 进入 dist 目录
echo   2. 双击运行 "币安自动交易 Setup 0.1.0.exe"
echo   3. 按照安装向导完成安装
echo   4. 在桌面找到快捷方式并启动应用
echo.
pause
