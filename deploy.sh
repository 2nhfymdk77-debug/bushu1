#!/bin/bash

# 自动交易系统快速部署脚本
# 支持 Vercel 和 Railway 快速部署

set -e

echo "======================================"
echo "   自动交易系统快速部署工具"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Git 是否初始化
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Git 仓库未初始化${NC}"
    read -p "是否要初始化 Git 仓库? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git init
        git add .
        git commit -m "Initial commit: 自动交易系统"
        echo -e "${GREEN}✓ Git 仓库已初始化${NC}"
    else
        echo -e "${RED}✗ 取消部署${NC}"
        exit 1
    fi
fi

# 显示部署选项
echo "请选择部署平台:"
echo ""
echo "1) Vercel (推荐，需要单独配置数据库)"
echo "2) Railway (推荐，包含数据库，最简单)"
echo "3) Docker (自托管，需要自己的服务器)"
echo "4) 仅构建本地版本"
echo ""
read -p "请输入选项 (1/2/3/4): " choice

case $choice in
    1)
        echo ""
        echo "======================================"
        echo "   Vercel 部署流程"
        echo "======================================"
        echo ""
        echo -e "${YELLOW}步骤 1: 推送代码到 GitHub${NC}"
        echo "请先在 GitHub 创建新仓库，然后运行："
        echo ""
        echo "  git remote add origin https://github.com/your-username/your-repo.git"
        echo "  git branch -M main"
        echo "  git push -u origin main"
        echo ""
        read -p "是否已完成 GitHub 推送? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo -e "${YELLOW}步骤 2: 在 Vercel 部署${NC}"
            echo "1. 访问 https://vercel.com/new"
            echo "2. 导入你的 GitHub 仓库"
            echo "3. 配置环境变量: DATABASE_URL (从 Vercel Postgres 或 Supabase 获取)"
            echo "4. 点击 Deploy"
            echo ""
            echo -e "${GREEN}等待 2-3 分钟，部署完成后即可访问！${NC}"
            echo ""
            echo -e "${YELLOW}重要提示:${NC}"
            echo "- 需要单独配置 PostgreSQL 数据库"
            echo "- 推荐使用 Vercel Postgres 或 Supabase（免费）"
            echo "- 详细步骤请查看 DEPLOYMENT.md"
        fi
        ;;

    2)
        echo ""
        echo "======================================"
        echo "   Railway 部署流程"
        echo "======================================"
        echo ""
        echo -e "${YELLOW}步骤 1: 推送代码到 GitHub${NC}"
        echo "请先在 GitHub 创建新仓库，然后运行："
        echo ""
        echo "  git remote add origin https://github.com/your-username/your-repo.git"
        echo "  git branch -M main"
        echo "  git push -u origin main"
        echo ""
        read -p "是否已完成 GitHub 推送? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo -e "${YELLOW}步骤 2: 在 Railway 部署${NC}"
            echo "1. 访问 https://railway.app"
            echo "2. 登录并点击 'New Project'"
            echo "3. 点击 'Deploy from GitHub repo'"
            echo "4. 选择你的仓库"
            echo "5. 添加 PostgreSQL 服务（自动配置）"
            echo "6. 点击 Deploy Now"
            echo ""
            echo -e "${GREEN}等待 2-3 分钟，部署完成后即可访问！${NC}"
            echo ""
            echo -e "${YELLOW}优势:${NC}"
            echo "- 一键部署，自动包含数据库"
            echo "- 免费额度 $5/月"
            echo "- 自动 HTTPS"
        fi
        ;;

    3)
        echo ""
        echo "======================================"
        echo "   Docker 部署流程"
        echo "======================================"
        echo ""
        echo -e "${YELLOW}准备服务器...${NC}"
        echo ""
        echo "确保你的服务器已安装："
        echo "- Docker"
        echo "- Docker Compose"
        echo ""
        echo "安装命令："
        echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
        echo "  sudo sh get-docker.sh"
        echo ""

        # 创建 docker-compose.yml
        echo -e "${YELLOW}生成 docker-compose.yml...${NC}"
        cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: trading-db
    restart: always
    environment:
      POSTGRES_USER: trading_user
      POSTGRES_PASSWORD: ${DB_PASSWORD:-change_this_secure_password}
      POSTGRES_DB: trading_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - trading-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trading_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    container_name: trading-app
    restart: always
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://trading_user:${DB_PASSWORD:-change_this_secure_password}@postgres:5432/trading_db
      NODE_ENV: production
      PORT: 5000
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - trading-network

volumes:
  postgres_data:

networks:
  trading-network:
    driver: bridge
EOF

        echo -e "${GREEN}✓ docker-compose.yml 已生成${NC}"
        echo ""

        # 创建 .env 文件
        echo -e "${YELLOW}生成 .env 文件...${NC}"
        if [ ! -f ".env" ]; then
            cat > .env << 'EOF'
# 数据库密码（请修改为强密码）
DB_PASSWORD=change_this_secure_password_12345678

# 其他环境变量
NODE_ENV=production
PORT=5000
EOF
            echo -e "${GREEN}✓ .env 文件已生成${NC}"
            echo -e "${RED}⚠️  请修改 .env 文件中的 DB_PASSWORD 为强密码！${NC}"
        else
            echo -e "${YELLOW}.env 文件已存在，跳过生成${NC}"
        fi
        echo ""

        echo -e "${YELLOW}部署命令:${NC}"
        echo ""
        echo "1. 修改 .env 文件中的数据库密码"
        echo ""
        echo "2. 构建并启动服务:"
        echo "   docker-compose up -d"
        echo ""
        echo "3. 查看日志:"
        echo "   docker-compose logs -f"
        echo ""
        echo "4. 访问应用:"
        echo "   http://your-server-ip:5000"
        echo ""
        echo -e "${YELLOW}详细步骤请查看 DEPLOYMENT.md${NC}"
        ;;

    4)
        echo ""
        echo "======================================"
        echo "   构建本地版本"
        echo "======================================"
        echo ""
        echo -e "${YELLOW}开始构建...${NC}"
        echo ""
        pnpm run build
        echo ""
        echo -e "${GREEN}✓ 构建完成！${NC}"
        echo ""
        echo "运行命令:"
        echo "  pnpm start"
        echo ""
        echo "访问地址:"
        echo "  http://localhost:5000"
        ;;

    *)
        echo -e "${RED}✗ 无效选项${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}======================================"
echo "   部署准备完成！"
echo "======================================"
echo ""
echo "详细部署文档: DEPLOYMENT.md"
echo ""
echo -e "${YELLOW}重要提示:${NC}"
echo "1. 部署前请确保已配置币安 API 密钥"
echo "2. 建议先使用测试网验证"
echo "3. 真实交易前请充分测试"
echo ""
