# 自动交易系统部署指南

## 📋 部署前准备

### 1. 必需条件
- [x] Node.js 24+ 环境（本地开发用）
- [x] GitHub 仓库（存放项目代码）
- [ ] PostgreSQL 数据库（推荐使用 Railway/Supabase/Vercel Postgres）

### 2. 系统特性
- **前端**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **样式**: Tailwind CSS 4
- **数据库**: PostgreSQL + Drizzle ORM
- **交易所**: 币安期货 API (主网)
- **策略**: SMC 流动性 + FVG 回踩策略

---

## 🚀 方案一：Vercel 部署（推荐）

### 优势
- ✅ 免费额度充足
- ✅ 自动 HTTPS
- ✅ 全球 CDN 加速
- ✅ 自动部署（Git 集成）
- ✅ 零配置部署

### 步骤

#### 1. 推送代码到 GitHub
```bash
# 如果还没有 Git 仓库
git init
git add .
git commit -m "Initial commit: 自动交易系统"

# 在 GitHub 创建新仓库后
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

#### 2. 准备数据库

**选项 A: Vercel Postgres（推荐）**
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入你的项目
3. 点击 "Storage" -> "Create Database"
4. 选择 "Postgres" -> "Create"
5. Vercel 会自动提供 `DATABASE_URL`

**选项 B: Supabase（免费）**
1. 访问 [Supabase](https://supabase.com/)
2. 创建新项目
3. 在 Settings -> Database 获取连接字符串
4. 格式: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`

**选项 C: Railway（推荐，自带数据库）**
- 跳到方案二的 Railway 部署

#### 3. 在 Vercel 部署

1. 访问 [vercel.com/new](https://vercel.com/new)
2. 导入你的 GitHub 仓库
3. 配置环境变量：
   ```
   DATABASE_URL=postgresql://username:password@host:port/database
   ```
   （从步骤 2 获取）
4. 点击 "Deploy"

等待约 2-3 分钟，部署完成后你会获得一个 `.vercel.app` 域名。

#### 4. 自定义域名（可选）

1. 在 Vercel 项目设置中点击 "Domains"
2. 添加你的域名（如 `trading.yourdomain.com`）
3. 按照提示配置 DNS 记录

---

## 🚀 方案二：Railway 部署（最简单）

### 优势
- ✅ 一键部署，包含数据库
- ✅ 免费额度：$5/月
- ✅ 自动 HTTPS
- ✅ 内置 PostgreSQL 数据库
- ✅ 可视化管理界面

### 步骤

#### 1. 推送代码到 GitHub
（同方案一步骤 1）

#### 2. 在 Railway 部署

1. 访问 [railway.app](https://railway.app)
2. 登录并点击 "New Project"
3. 点击 "Deploy from GitHub repo"
4. 选择你的仓库
5. Railway 会自动检测 Next.js 项目并配置

#### 3. 配置数据库

Railway 会自动创建一个 PostgreSQL 数据库：
1. 在项目中点击 "Add New Service" -> "Database" -> "Add PostgreSQL"
2. Railway 会自动提供 `DATABASE_URL`
3. 在你的 Next.js 项目设置中，环境变量会自动关联

#### 4. 设置环境变量

Railway 会自动设置：
```
DATABASE_URL=postgresql://postgres:password@host.railway.app:5432/railway
NODE_ENV=production
PORT=5000
```

#### 5. 部署完成

Railway 会自动部署，等待 2-3 分钟后即可访问。

---

## 🚀 方案三：Docker 部署（自托管）

### 适用场景
- 拥有自己的服务器（VPS/云服务器）
- 需要完全控制环境
- 内网部署

### 步骤

#### 1. 准备服务器
```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 准备数据库

**使用 Docker 启动 PostgreSQL**：
```bash
# 创建 docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: trading-db
    restart: always
    environment:
      POSTGRES_USER: trading_user
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: trading_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - trading-network

  app:
    build: .
    container_name: trading-app
    restart: always
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://trading_user:your_secure_password@postgres:5432/trading_db
      NODE_ENV: production
      PORT: 5000
    depends_on:
      - postgres
    networks:
      - trading-network

volumes:
  postgres_data:

networks:
  trading-network:
    driver: bridge
EOF
```

#### 3. 启动服务
```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f app
```

#### 4. 使用 Nginx 反向代理（可选）

```bash
# 创建 Nginx 配置
cat > /etc/nginx/sites-available/trading << 'EOF'
server {
    listen 80;
    server_name trading.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用配置
sudo ln -s /etc/nginx/sites-available/trading /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔐 安全配置

### 1. API 密钥安全
- ✅ API 密钥存储在浏览器 localStorage（用户端加密）
- ✅ 不会发送到服务器，仅在客户端使用
- ⚠️ 币安 API 密钥需要限制 IP（如果可能）

### 2. 币安 API 权限配置
在币安创建 API 密钥时，建议设置：
- **只读**: 余额查询、持仓查询
- **交易**: 下单、撤单
- **禁止提现**: ❌ 勾选"启用提现"
- **IP 白名单**: 建议添加部署服务器 IP

### 3. 数据库安全
- 使用强密码（至少 16 位）
- 仅允许内网访问（Docker 网络）
- 定期备份

---

## 📊 部署后验证

### 1. 检查服务状态
```bash
# Vercel/Railway: 检查 Dashboard 状态
# Docker: docker-compose ps
```

### 2. 访问应用
- Vercel: `https://your-project.vercel.app`
- Railway: `https://your-app.railway.app`
- Docker: `http://your-server-ip:5000` 或你的域名

### 3. 配置币安 API
1. 打开应用，进入"系统设置"
2. 输入币安 API Key 和 Secret
3. 测试连接

### 4. 测试回测功能
1. 进入"策略回测"
2. 选择 SMC 策略
3. 配置参数
4. 运行回测

### 5. 测试交易功能（⚠️ 谨慎）
1. 先使用测试网 API 验证流程
2. 确认无误后再切换到主网
3. 建议从小仓位开始

---

## 🔄 持续部署

### Vercel 自动部署
- 每次推送到 `main` 分支自动部署
- 可配置不同分支部署到不同环境（dev/staging/prod）

### Railway 自动部署
- 同样支持 Git 集成自动部署
- 可设置 Webhook 触发部署

### Docker 手动部署
```bash
# 拉取最新代码
git pull origin main

# 重新构建并部署
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 💰 成本估算

| 平台 | 免费额度 | 付费方案 | 推荐 |
|------|---------|---------|------|
| Vercel | 100GB 带宽/月 | $20/月（Pro） | ⭐⭐⭐⭐⭐ |
| Railway | $5/月免费额度 | $5/月起 | ⭐⭐⭐⭐⭐ |
| Docker VPS | 需要自购服务器 | $5-10/月（1核2G） | ⭐⭐⭐ |

**总成本**: 如果使用 Railway（包含数据库），每月约 $5（约合 35 元人民币）

---

## 🆘 常见问题

### Q1: 部署后无法访问
- 检查环境变量 `DATABASE_URL` 是否正确
- 检查部署平台的服务状态
- 查看部署日志

### Q2: 数据库连接失败
- 确认 `DATABASE_URL` 格式正确
- 检查数据库是否正在运行
- 确认网络连接

### Q3: API 调用失败
- 检查币安 API 密钥权限
- 确认 API 密钥未过期
- 检查 IP 白名单设置

### Q4: 策略回测报错
- 确认有足够的 K 线数据
- 检查策略参数是否合理
- 查看浏览器控制台错误

---

## 📞 技术支持

- Vercel 文档: https://vercel.com/docs
- Railway 文档: https://docs.railway.app
- Docker 文档: https://docs.docker.com
- 币安 API 文档: https://binance-docs.github.io/apidocs/futures/cn/

---

**部署完成后，请务必先在测试环境验证所有功能正常，再切换到主网进行真实交易！**
