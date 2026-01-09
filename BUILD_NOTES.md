# 构建说明

## Windows 本地构建

### 首次构建步骤

```bash
# 1. 克隆项目
git clone https://github.com/2nhfymdk77-debug/bushu1.git
cd bushu1

# 2. 安装依赖
pnpm install

# 3. 构建 Electron 应用
pnpm electron:build
```

### 构建产物

构建成功后，在 `dist` 目录下会生成以下文件：

- **币安自动交易 Setup 0.1.0.exe** - NSIS 安装包（推荐使用）
- **币安自动交易.exe** - 直接可执行文件（在 `dist/win-unpacked` 目录）

### 关于警告信息

您可能会看到大量类似以下的警告：

```
• Failed to read package.json for C:\...\node_modules\.pnpm\@esbuild+aix-ppc64@0.25.12\node_modules\@esbuild\aix-ppc64: ENOENT
• Failed to read package.json for C:\...\node_modules\.pnpm\@img+sharp-darwin-arm64@0.34.5\node_modules\@img\sharp-darwin-arm64: ENOENT
```

**这些警告可以安全忽略**，原因如下：

1. **跨平台依赖**：这些是其他平台（Linux、macOS、Android 等）的可选依赖
2. **Windows 上不需要**：pnpm 在 Windows 上不会安装这些平台特定的包
3. **不影响构建结果**：electron-builder 在打包时会扫描所有可能的依赖路径，但这些路径在 Windows 上不存在
4. **不影响应用运行**：最终生成的安装包完全正常，包含所有必需的 Windows 平台依赖

### 其他警告及处理

#### 1. description 和 author 缺失

```
• description is missed in the package.json
• author is missed in the package.json
```

**已修复**：已在 package.json 中添加这两个字段。

#### 2. 默认图标

```
• default Electron icon is used  reason=application icon is not set
```

**说明**：应用使用默认的 Electron 图标。如需自定义图标：

1. 准备一个 256x256 的 PNG 或 ICO 格式图标
2. 将图标文件命名为 `icon.ico` 放在项目根目录
3. 在 package.json 的 build 配置中添加：

```json
"win": {
  "target": ["nsis"],
  "icon": "icon.ico"
}
```

### 构建优化

已添加 `.npmrc` 文件来优化 pnpm 的依赖管理，减少不必要的依赖安装。

### 故障排除

#### 构建中断

如果构建被中断（如按 Ctrl+C），只需重新运行：

```bash
pnpm electron:build
```

#### 清理缓存

如需完全重新构建：

```bash
# Windows
rmdir /s /q dist
rmdir /s /q .next
rmdir /s /q dist-electron
pnpm electron:build
```

#### 依赖问题

如果遇到依赖安装问题：

```bash
# 删除 node_modules 和 pnpm-lock.yaml
rmdir /s /q node_modules
del pnpm-lock.yaml

# 重新安装
pnpm install
```

## 生产环境部署

### 使用 NSIS 安装包

1. 双击 `dist\币安自动交易 Setup 0.1.0.exe`
2. 按照安装向导完成安装
3. 从开始菜单或桌面快捷方式启动应用

### 使用直接可执行文件

1. 进入 `dist\win-unpacked` 目录
2. 双击 `币安自动交易.exe` 运行应用

## 技术支持

如遇到构建问题，请检查：
1. Node.js 版本是否为 18 或更高
2. pnpm 版本是否为 8 或更高
3. 是否有足够的磁盘空间（至少 2GB）
4. 是否有管理员权限（某些操作可能需要）
