# 云端自动交易系统

一个基于 Next.js 的模块化加密货币自动交易系统，支持策略回测和真实交易，可部署在 Vercel、Railway 等云端平台。

## ✨ 主要特性

### 🔧 模块化架构
- **交易所接口抽象**：统一接口设计，支持多交易所（当前实现币安）
- **策略模块化**：策略独立开发，易于扩展新策略
- **动态加载**：支持运行时选择和切换策略

### 🧪 策略回测
- **历史数据回测**：使用历史K线数据测试策略表现
- **详细统计**：提供胜率、收益率、最大回撤等指标
- **收益曲线**：可视化展示资金曲线和回撤情况

### ⚡ 自动交易
- **实时监控**：WebSocket实时接收市场数据
- **信号执行**：自动执行策略生成的交易信号
- **风控系统**：内置风险控制机制，支持止损止盈

### 📊 实时管理
- **任务管理**：创建、启动、暂停、停止交易任务
- **手动干预**：支持紧急停止、手动平仓、取消挂单等操作
- **实时日志**：完整的交易日志和信号记录

### 💾 数据持久化
- **PostgreSQL数据库**：使用Drizzle ORM管理数据
- **配置存储**：安全存储API密钥和策略配置
- **历史记录**：完整的交易历史和回测结果

### 📱 多端支持
- **响应式设计**：支持桌面端、平板、手机访问
- **移动端优化**：底部导航栏，触摸友好界面
- **深色主题**：专业的交易界面设计

## 🏗️ 系统架构

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   └── binance/      # 币安API代理
│   │   └── page.tsx           # 主页面
│   ├── components/            # React组件
│   │   ├── StrategySelector.tsx     # 策略选择组件
│   │   ├── TradingMonitor.tsx       # 交易监控组件
│   │   └── TradingRecords.tsx      # 交易记录组件
│   ├── exchanges/             # 交易所实现
│   │   └── BinanceExchange.ts      # 币安交易所
│   ├── backtest/              # 回测引擎
│   │   └── BacktestEngine.ts       # 回测引擎实现
│   ├── execution/             # 交易执行引擎
│   │   └── ExecutionEngine.ts      # 执行引擎实现
│   ├── strategies/            # 策略实现
│   │   └── EMA15mTrend5mPullbackStrategy.ts
│   ├── types/                 # TypeScript类型定义
│   │   ├── exchange.ts        # 交易所接口
│   │   ├── strategy.ts        # 策略接口
│   │   ├── backtest.ts        # 回测接口
│   │   ├── execution.ts       # 执行接口
│   │   └── database.ts        # 数据库模型
│   ├── utils/                 # 工具函数
│   │   └── strategyManager.ts      # 策略管理器
│   └── storage/               # 数据存储
│       └── database/
│           ├── shared/schema.ts     # 数据库Schema
│           └── tradingManager.ts   # 数据库Manager
├── public/                    # 静态资源
├── .coze                      # 项目配置
├── vercel.json               # Vercel部署配置
├── railway.toml              # Railway部署配置
├── Dockerfile                # Docker配置
└── package.json              # 依赖配置
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm
- PostgreSQL 数据库

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd <project-directory>
```

2. **安装依赖**
```bash
pnpm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接和API密钥
```

4. **启动开发服务器**
```bash
pnpm run dev
```

5. **访问应用**
打开浏览器访问 [http://localhost:5000](http://localhost:5000)

## 📦 云端部署

### Vercel 部署

1. **连接Git仓库**
   - 登录 [Vercel](https://vercel.com)
   - 点击 "New Project"
   - 导入你的Git仓库

2. **配置环境变量**
   在 Vercel 项目设置中添加以下环境变量：
   ```
   PGDATABASE_URL=postgresql://...
   ```

3. **部署**
   点击 "Deploy" 按钮，Vercel 会自动构建和部署

4. **访问**
   部署完成后，Vercel 会提供一个访问地址

### Railway 部署

1. **连接Git仓库**
   - 登录 [Railway](https://railway.app)
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"

2. **配置环境变量**
   在 Railway 项目设置中添加以下环境变量：
   ```
   PGDATABASE_URL=postgresql://...
   ```

3. **部署**
   Railway 会自动检测配置并部署

4. **访问**
   部署完成后，Railway 会提供一个访问地址

### Docker 部署

1. **构建镜像**
```bash
docker build -t auto-trading-system .
```

2. **运行容器**
```bash
docker run -d \
  -p 5000:5000 \
  -e PGDATABASE_URL=postgresql://... \
  --name auto-trading \
  auto-trading-system
```

## 🎯 使用指南

### 1. 配置API密钥

首次使用需要配置币安API密钥：

1. 进入"系统设置"页面
2. 输入币安API Key和Secret
3. 选择"主网"或"测试网"模式
4. 保存配置

**⚠️ 安全提示**：
- API密钥加密存储在本地浏览器
- 建议使用API权限受限的子账号
- 建议设置IP白名单

### 2. 策略回测

1. 进入"策略回测"页面
2. 选择交易策略（如"15分钟趋势+5分钟回调"）
3. 配置策略参数
4. 设置回测时间范围
5. 点击"开始回测"
6. 查看回测结果和统计

### 3. 自动交易

1. 进入"自动交易"页面
2. 点击"新建任务"
3. 选择策略和配置参数
4. 设置交易对和时间周期
5. 配置风控参数
6. 启动任务

### 4. 实时监控

在"自动交易"页面可以：
- 查看任务运行状态
- 实时查看信号和日志
- 手动干预（暂停、停止、平仓等）
- 紧急停止所有任务

### 5. 交易记录

在"交易记录"页面可以：
- 查看历史交易
- 分析收益统计
- 导出交易数据

## 🔒 安全建议

### API密钥管理
- ✅ 使用独立的API密钥
- ✅ 设置IP白名单
- ✅ 限制API权限（不要开启提现权限）
- ✅ 定期更换API密钥
- ❌ 不要在公共设备上保存密钥
- ❌ 不要分享API密钥

### 资金管理
- ✅ 使用小额资金测试
- ✅ 设置止损止盈
- ✅ 控制仓位大小
- ❌ 不要使用全部资金
- ❌ 不要在高杠杆下操作

### 风险控制
- ✅ 设置最大回撤限制
- ✅ 设置每日最大交易次数
- ✅ 监控任务运行状态
- ❌ 不要24小时无人值守运行
- ❌ 不要在市场异常时运行

## 📚 开发指南

### 添加新策略

1. **创建策略类**
```typescript
// src/strategies/MyNewStrategy.ts
import {
  TradingStrategy,
  StrategyMeta,
  SignalDetectionResult,
  KLineData,
} from "../types/strategy";

export class MyNewStrategy implements TradingStrategy {
  readonly meta: StrategyMeta = {
    id: "my_new_strategy",
    name: "我的新策略",
    description: "策略描述",
    version: "1.0.0",
    category: "趋势跟踪",
    timeframe: ["15m", "30m"],
    riskLevel: "medium",
  };

  getDefaultParams() {
    return { /* 默认参数 */ };
  }

  getConfigItems() {
    return [ /* 配置项 */ ];
  }

  detectSignal(symbol: string, klines: KLineData[], params: any): SignalDetectionResult {
    // 实现信号检测逻辑
  }
}
```

2. **注册策略**
```typescript
// src/utils/strategyManager.ts
import { MyNewStrategy } from "../strategies/MyNewStrategy";

// 在构造函数中注册
this.registerStrategy(new MyNewStrategy());
```

### 添加新交易所

1. **实现Exchange接口**
```typescript
// src/exchanges/NewExchange.ts
import { Exchange } from "../types/exchange";

export class NewExchange implements Exchange {
  // 实现所有接口方法
}
```

2. **在执行引擎中使用**
```typescript
import { NewExchange } from "../exchanges/NewExchange";

const exchange = new NewExchange(apiKey, apiSecret);
const engine = new BinanceExecutionEngine({ exchange, ... });
```

## 📊 数据库结构

### 主要表

- **user_configs**: 用户配置（API密钥等）
- **trade_tasks**: 交易任务
- **signal_execution_records**: 信号执行记录
- **backtest_results**: 回测结果
- **manual_interventions**: 手动干预记录
- **trading_logs**: 交易日志
- **system_stats**: 系统统计

详细结构请参考 `src/storage/database/shared/schema.ts`

## 🛠️ 技术栈

- **前端**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL + Drizzle ORM
- **交易所**: Binance Futures API
- **图表**: Lightweight Charts 4.1.1
- **部署**: Vercel / Railway / Docker

## 📄 许可证

MIT License

## ⚠️ 免责声明

本系统仅供学习和研究使用。加密货币交易存在高风险，可能导致资金损失。使用本系统进行实际交易时，请务必：

- 充分理解系统运作原理
- 在测试环境充分测试
- 使用小额资金
- 做好风险控制
- 自行承担所有交易风险

开发者不对使用本系统造成的任何损失负责。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 加入讨论群

---

**祝您交易顺利！** 🎉
