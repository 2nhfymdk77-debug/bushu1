@echo off
chcp 65001 >nul
echo ========================================
echo   币安自动交易 - 全新安装脚本
echo ========================================
echo.
echo 此脚本将:
echo   1. 删除旧的项目目录 (C:\Users\Administrator\Desktop\bushu1)
echo   2. 从 GitHub 克隆最新代码
echo   3. 安装依赖
echo   4. 构建桌面应用
echo.
echo 预计总时间: 10-15 分钟
echo.
pause

echo.
echo ========================================
echo [步骤 1/4] 删除旧项目...
echo ========================================
echo.

set PROJECT_DIR=C:\Users\Administrator\Desktop\bushu1

if exist "%PROJECT_DIR%" (
    echo 正在删除旧项目目录...
    rmdir /s /q "%PROJECT_DIR%"
    if errorlevel 1 (
        echo.
        echo [错误] 删除旧项目失败！
        echo 请手动删除 C:\Users\Administrator\Desktop\bushu1 目录后重试。
        echo.
        pause
        exit /b 1
    )
    echo 删除完成！
) else (
    echo 旧项目目录不存在，跳过删除。
)

echo.
echo ========================================
echo [步骤 2/4] 克隆项目...
echo ========================================
echo.

cd C:\Users\Administrator\Desktop
echo 正在从 GitHub 克隆项目...
git clone https://github.com/2nhfymdk77-debug/bushu1.git
if errorlevel 1 (
    echo.
    echo [错误] 克隆项目失败！
    echo 请检查网络连接。
    echo.
    pause
    exit /b 1
)
echo 克隆完成！

echo.
echo ========================================
echo [步骤 3/4] 安装依赖...
echo ========================================
echo.

cd bushu1
echo 正在安装依赖 (需要 2-5 分钟)...
pnpm install
if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败！
    echo 可能原因:
    echo   - 未安装 pnpm: 请运行 npm install -g pnpm
    echo   - 网络连接问题: 请检查网络或使用镜像源
    echo.
    pause
    exit /b 1
)
echo 依赖安装完成！

echo.
echo ========================================
echo [步骤 4/4] 构建桌面应用...
echo ========================================
echo.

echo 正在构建桌面应用 (需要 5-10 分钟)...
echo 请耐心等待...
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
echo   安装完成！
echo ========================================
echo.
echo 安装包位置: %PROJECT_DIR%\dist\币安自动交易 Setup 0.1.0.exe
echo.
echo 接下来请:
echo   1. 进入 C:\Users\Administrator\Desktop\bushu1\dist 目录
echo   2. 双击运行 "币安自动交易 Setup 0.1.0.exe"
echo   3. 按照安装向导完成安装
echo   4. 在桌面找到快捷方式并启动应用
echo.
pause
