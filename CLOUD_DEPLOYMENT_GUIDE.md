# 币安期货自动交易系统 - 云端部署指南

## 系统概述

本系统是基于 Next.js 开发的币安期货自动交易 Web 应用，支持：
- ✅ **策略回测**：回测 15分钟趋势 + 5分钟回调策略
- ✅ **自动交易**：连接币安 API 自动执行交易
- ✅ **多设备访问**：支持电脑、手机、平板浏览器访问
- ✅ **响应式设计**：自动适配不同屏幕尺寸

## 技术架构

### 前端
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**

### 后端
- **Next.js API Routes**
- **WebSocket** 实时数据推送
- **币安 Futures API**

### 部署平台
- **Vercel**（推荐，免费额度充足）
- **Railway**
- **自建 VPS**（使用 Docker）

---

## 方案一：Vercel 部署（推荐）

### 优势
- ✅ 完全免费（个人计划）
- ✅ 自动 HTTPS
- ✅ 全球 CDN 加速
- ✅ 自动持续部署
- ✅ 零配置部署

### 步骤 1：准备代码

```bash
# 1. 克隆或上传代码到 GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### 步骤 2：部署到 Vercel

#### 方式 A：通过 Vercel CLI（推荐）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

#### 方式 B：通过 Vercel 网站界面

1. 访问 [vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 导入你的 GitHub 仓库
4. 配置项目：
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`（保持默认）
   - **Build Command**: `pnpm build`（自动检测）
   - **Output Directory**: `.next`（自动检测）
5. 点击 "Deploy"

### 步骤 3：环境变量配置

在 Vercel 项目设置中添加环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `NEXT_PUBLIC_APP_URL` | 应用 URL（自动设置） | 是 |
| `BINANCE_API_KEY` | 币安 API Key（不推荐） | 否 |
| `BINANCE_API_SECRET` | 币安 API Secret（不推荐） | 否 |

**重要提示**：
- API 密钥由用户在前端配置并存储在浏览器 localStorage，**不要在服务器端配置**
- 这是客户端应用，API 密钥在用户浏览器中管理

### 步骤 4：访问应用

部署完成后，Vercel 会提供一个 URL，例如：
- `https://binance-trader.vercel.app`

你可以：
1. 在电脑浏览器访问
2. 在手机浏览器访问（支持触摸操作）
3. 分享给其他人使用（每人需配置自己的 API 密钥）

---

## 方案二：Railway 部署

### 优势
- ✅ 支持长期运行的服务器
- ✅ 支持自定义域名
- ✅ 更灵活的配置

### 步骤

```bash
# 1. 安装 Railway CLI
npm i -g @railway/cli

# 2. 登录
railway login

# 3. 初始化项目
railway init

# 4. 部署
railway up
```

或在 Railway 网站界面：
1. 访问 [railway.app](https://railway.app)
2. 点击 "New Project" -> "Deploy from GitHub repo"
3. 选择你的仓库
4. Railway 会自动检测 Next.js 项目并部署

---

## 方案三：Docker 部署（自建 VPS）

### 创建 Dockerfile

```dockerfile
FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm
RUN pnpm build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  binance-trader:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### 部署命令

```bash
# 构建镜像
docker build -t binance-trader .

# 运行容器
docker run -p 3000:3000 binance-trader

# 或使用 docker-compose
docker-compose up -d
```

---

## 移动端使用指南

### 手机浏览器访问

1. **打开浏览器**（Chrome、Safari 等）
2. **输入应用 URL**：`https://your-app.vercel.app`
3. **添加到主屏幕**：
   - iOS Safari：分享按钮 → 添加到主屏幕
   - Android Chrome：菜单 → 添加到主屏幕

### 移动端功能特点

- ✅ 底部导航栏（方便单手操作）
- ✅ 响应式布局（自动适配屏幕）
- ✅ 触摸优化（按钮更大，间距更宽）
- ✅ 深色主题（省电护眼）

---

## API 密钥安全说明

### ⚠️ 重要安全提示

本应用采用客户端 API 模式：

1. **API 密钥存储在浏览器 localStorage**
   - 每个用户需配置自己的 API 密钥
   - 密钥不会发送到应用服务器

2. **币安 API 限制**
   - 仅支持币安期货主网
   - 需要启用期货交易权限
   - 建议创建只读或受限权限的 API Key

3. **最佳实践**
   - ✅ 使用受限 API Key（仅开启必要权限）
   - ✅ 设置 IP 白名单（如果支持）
   - ✅ 定期轮换 API Key
   - ✅ 不要分享 API Key

### API Key 权限配置

在币安账户创建 API Key 时，建议的权限：

| 权限类型 | 状态 | 说明 |
|---------|------|------|
| 现货交易 | ❌ 不需要 | 本应用仅支持期货 |
| 期货交易 | ✅ 必需 | 自动交易需要 |
| 提币 | ❌ 关闭 | 安全考虑 |
| 子账户转账 | ❌ 关闭 | 安全考虑 |

---

## 故障排除

### 问题 1：部署失败

**Vercel**
```bash
# 检查构建日志
vercel logs

# 常见问题：
# - 依赖安装失败：检查 package.json 和 pnpm-lock.yaml
# - 构建超时：增加构建时间限制
# - 环境变量缺失：检查环境变量配置
```

**Railway**
```bash
# 查看日志
railway logs

# 重启服务
railway restart
```

### 问题 2：移动端无法访问

1. **检查 HTTPS**：确保使用 HTTPS 访问
2. **检查浏览器兼容性**：使用现代浏览器
3. **清除缓存**：刷新页面或清除浏览器缓存

### 问题 3：WebSocket 连接失败

1. **检查币安 API 状态**：访问 [币安 API 状态页](https://status.binance.com/)
2. **检查网络连接**：确保可以访问币安服务器
3. **检查 API 密钥**：确保 API Key 有效且权限正确

### 问题 4：API 请求失败（400 错误）

参考 `API_400_ERROR_TROUBLESHOOTING.md` 文档。

---

## 性能优化建议

### Vercel 优化

1. **使用 Edge Runtime**（部分 API）
2. **启用图片优化**（如果使用图片）
3. **配置 CDN 缓存**
4. **监控 Analytics**

### 通用优化

1. **减少 API 调用频率**
   - 扫描间隔建议 ≥ 5 分钟
   - 避免短时间内重复请求

2. **使用 WebSocket**
   - 替代部分轮询请求
   - 减少服务器压力

3. **客户端缓存**
   - 合理使用 localStorage
   - 缓存交易配置

---

## 监控与日志

### Vercel Analytics

```bash
# 安装 Analytics
pnpm add @vercel/analytics

# 在 layout.tsx 中使用
import { Analytics } from '@vercel/analytics/react';
```

### 日志查看

- **Vercel**: 在项目 Dashboard 的 Logs 标签
- **Railway**: 使用 `railway logs` 命令
- **Docker**: `docker logs <container-id>`

---

## 安全加固

### 1. 内容安全策略 (CSP)

在 `next.config.ts` 中添加：

```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; connect-src 'self' https://fapi.binance.com https://stream.binance.com ws://stream.binance.com; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ]
  }
};
```

### 2. 启用 HTTPS

所有部署平台默认启用 HTTPS，无需额外配置。

### 3. 速率限制

在 API Routes 中添加速率限制：

```typescript
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 示例：使用 Upstash Redis 实现速率限制
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1m'),
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // ... 处理请求
}
```

---

## 成本估算

### Vercel（免费计划）

- ✅ **100GB 带宽/月**
- ✅ **无限部署**
- ✅ **全球 CDN**
- ✅ **自动 HTTPS**
- ✅ **团队协作**

### Railway

- **Hobby Plan**: $5/月
- **Pro Plan**: $20/月
- 适合需要服务器端处理的应用

### 自建 VPS

- **Vultr**: $5/月（1GB RAM）
- **DigitalOcean**: $6/月（1GB RAM）
- **AWS**: 免费套餐（12个月）

---

## 更新与维护

### 自动部署

**Vercel 和 Railway 都支持自动部署**：

1. 推送代码到 GitHub
2. 平台自动检测更新
3. 自动构建和部署
4. 通知部署结果

### 手动部署

```bash
# Vercel
vercel --prod

# Railway
railway up

# Docker
docker-compose pull && docker-compose up -d
```

### 版本管理

建议使用语义化版本号（Semantic Versioning）：

- `MAJOR.MINOR.PATCH`（如 1.0.0）
- 每次重大更新增加 MAJOR
- 功能更新增加 MINOR
- Bug 修复增加 PATCH

---

## 备份与恢复

### 数据备份

本应用主要数据存储在：
- **用户浏览器**：API 密钥、交易配置（localStorage）
- **币安账户**：交易记录、持仓信息

**无需服务器端备份**

### 恢复步骤

1. 用户重新访问应用
2. 重新配置 API 密钥
3. 恢复交易策略设置

---

## 技术支持

### 文档

- `README.md` - 项目介绍和快速开始
- `BINANCE_TRADING_GUIDE.md` - 币安交易详细指南
- `AUTO_TRADING_TEST_GUIDE.md` - 自动交易测试指南
- `API_400_ERROR_TROUBLESHOOTING.md` - API 错误排查

### 问题反馈

如有问题，请：
1. 检查相关文档
2. 查看部署平台日志
3. 在 GitHub 提交 Issue

---

## 附录：域名配置

### Vercel 自定义域名

1. 在 Vercel 项目设置中添加域名
2. 配置 DNS 记录：
   ```
   类型: CNAME
   名称: www（或 @）
   值: cname.vercel-dns.com
   ```
3. 等待 DNS 生效（通常 5-10 分钟）

### HTTPS 证书

Vercel 会自动为自定义域名申请 Let's Encrypt 证书。

---

## 总结

本系统已经完全重构为纯 Web 应用，可以轻松部署到云端：

### 快速部署步骤

1. **推送到 GitHub**
2. **在 Vercel 导入项目**
3. **等待自动部署完成**
4. **访问应用 URL**

### 核心优势

- ✅ 零部署成本（Vercel 免费计划）
- ✅ 全球访问（CDN 加速）
- ✅ 多设备支持（电脑、手机、平板）
- ✅ 自动更新（Git 推送即部署）
- ✅ 安全可靠（HTTPS、客户端 API）

开始部署吧！🚀
