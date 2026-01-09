# 🚀 自动交易系统

基于 Next.js 的模块化加密货币自动交易系统，支持 SMC 策略回测、真实交易、云端部署及多端访问。

## ✨ 特性

- 📊 **SMC 智能策略**: 基于 ICT/SMC 理论的流动性+FVG 回踩策略
- 🧪 **策略回测**: 支持历史数据回测，多维度统计分析
- ⚡ **真实交易**: 币安期货主网自动交易，支持多合约监控
- 📈 **实时监控**: WebSocket 推送实时 K 线和交易信号
- 🎨 **响应式设计**: 支持桌面端和移动端访问
- 🔐 **安全可靠**: API 密钥本地存储，数据库持久化
- 🌍 **云端部署**: 支持 Vercel、Railway、Docker 多种部署方式

## 📋 系统要求

- Node.js 24+
- PostgreSQL 数据库
- 币安期货 API 密钥（主网）

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问应用
http://localhost:5000
```

### 快速部署

运行快速部署脚本：

```bash
# 添加执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

按照提示选择部署平台：
- **Vercel**: 推荐用于生产环境
- **Railway**: 最简单，包含数据库
- **Docker**: 自托管，完全控制

详细部署步骤请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📖 使用指南

### 1. 配置币安 API

1. 打开应用，进入"系统设置"
2. 输入币安 API Key 和 Secret
3. 测试连接确认配置正确

**安全提示**:
- API 密钥存储在浏览器 localStorage，不会发送到服务器
- 建议在币安设置 IP 白名单
- 建议仅启用"期货交易"和"读取"权限

### 2. 策略回测

1. 进入"策略回测"页面
2. 选择 SMC 流动性+FVG 策略
3. 配置策略参数（可使用默认值）
4. 运行回测查看结果

**策略参数说明**:
- 主周期（流动性识别）: 默认 15m
- 中周期（位移确认）: 默认 5m
- 低周期（入场）: 默认 1m
- 其他参数可根据市场情况调整

### 3. 自动交易

⚠️ **重要提示**: 真实交易前请务必充分测试！

1. 进入"自动交易"页面
2. 添加交易任务
3. 选择监控的合约（如 BTCUSDT）
4. 配置策略参数
5. 启动自动扫描

### 4. 监控与管理

- **仪表盘**: 查看系统状态和统计
- **交易记录**: 查看历史交易和盈亏
- **系统设置**: 管理 API 密钥和配置

## 📂 项目结构

```
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/         # API 路由
│   │   ├── layout.tsx   # 根布局
│   │   └── page.tsx     # 首页
│   ├── components/       # React 组件
│   │   ├── CryptoBacktestTool.tsx
│   │   ├── BinanceAutoTrader.tsx
│   │   └── ...
│   ├── strategies/      # 交易策略
│   │   ├── SMCLiquidityFVGStrategy.ts
│   │   └── StrategyManager.ts
│   ├── backtest/        # 回测引擎
│   │   └── BacktestEngine.ts
│   ├── exchanges/       # 交易所集成
│   │   └── BinanceExchange.ts
│   ├── storage/         # 数据库
│   │   └── database/
│   ├── types/           # TypeScript 类型
│   └── utils/           # 工具函数
├── public/              # 静态资源
├── .coze               # 项目配置
├── vercel.json         # Vercel 配置
├── Dockerfile          # Docker 配置
├── DEPLOYMENT.md       # 部署文档
└── deploy.sh           # 快速部署脚本
```

## 🔧 技术栈

### 前端
- **框架**: Next.js 16 (App Router)
- **UI**: React 19
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 4
- **图表**: Lightweight Charts

### 后端
- **API**: Next.js API Routes
- **数据库**: PostgreSQL
- **ORM**: Drizzle ORM

### 交易
- **交易所**: 币安期货 API
- **实时数据**: WebSocket

### 部署
- **平台**: Vercel / Railway / Docker
- **CI/CD**: 自动部署（Git 集成）

## 📊 策略说明

### SMC 流动性 + FVG 回踩策略

**核心思想**:
1. 识别流动性区域（高点和低点）
2. 检测流动性扫荡（假突破）
3. 确认机构位移（趋势启动）
4. 通过 FVG（公平价值缺口）回踩入场
5. 顺势捕捉结构性行情

**优势**:
- 基于智能资金理论，捕捉机构动向
- 流动性扫荡确认，减少假信号
- FVG 回踩入场，风险收益比优秀
- 支持多时间周期组合分析

**风险**:
- 高风险策略，需要严格风险控制
- 建议从小仓位开始
- 做好止损止盈管理

## 🔐 安全提示

1. **API 密钥**:
   - 存储在浏览器 localStorage
   - 不会发送到服务器
   - 建议定期更换

2. **交易风险**:
   - 自动交易存在亏损风险
   - 建议先使用测试网验证
   - 不要投入超出承受能力的资金

3. **数据库安全**:
   - 使用强密码
   - 定期备份数据
   - 限制访问权限

## 📝 开发指南

### 添加新策略

1. 在 `src/strategies/` 创建新策略文件
2. 实现 `TradingStrategy` 接口
3. 在 `StrategyManager` 中注册策略
4. 更新前端组件支持新策略

### 自定义配置

- 策略参数: 在各策略文件中修改默认参数
- UI 主题: 修改 Tailwind 配置
- 数据库: 修改 `drizzle.config.ts`

## 🆘 常见问题

### Q: 部署后无法访问？
A: 检查环境变量 `DATABASE_URL` 是否正确，查看部署日志。

### Q: API 调用失败？
A: 确认币安 API 密钥权限，检查 IP 白名单设置。

### Q: 回测无交易信号？
A: 可能是参数设置过于严格，尝试调整策略参数。

### Q: 如何切换到测试网？
A: 修改 `BinanceExchange.ts` 中的 `BASE_URL` 为测试网地址。

## 📄 许可证

本项目仅供学习研究使用，不构成任何投资建议。使用本系统进行交易的任何损失由用户自行承担。

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [币安 API](https://binance-docs.github.io/apidocs/futures/cn/)
- [ICT/SMC 理论](https://smartmoneyconcepts.com/)

---

**⚠️ 免责声明**: 本系统仅供学习和研究使用，不构成任何投资建议。加密货币交易存在高风险，可能导致资金损失。使用本系统进行交易的任何损失由用户自行承担，开发者不承担任何责任。

**请务必在充分测试后再进行真实交易！**
