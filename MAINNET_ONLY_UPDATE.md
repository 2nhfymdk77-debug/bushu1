# 系统更新说明：移除测试网，仅支持真实交易

## 更新日期
2026年1月

## 更新概述
本次更新移除了所有测试网（testnet）和模拟交易（testMode）相关功能，系统现在仅支持币安主网的**真实交易**。

---

## 主要变更

### 1. 删除的功能
- ❌ 测试网开关
- ❌ 模拟交易开关
- ❌ 测试网API端点支持
- ❌ 测试网相关配置选项

### 2. 保留的功能
- ✅ 真实交易功能
- ✅ 自动信号检测
- ✅ 自动下单执行
- ✅ 分段止盈（1R平50%，2R平剩余）
- ✅ 移动止损
- ✅ 反向信号平仓
- ✅ 持仓管理

---

## 文件修改清单

### 前端组件
**src/components/BinanceAutoTrader.tsx**
- 删除 `testnet` 状态变量
- 删除 `testMode` 状态变量
- 删除从localStorage加载testnet的代码
- 删除保存testnet到localStorage的代码
- 移除所有API调用中的testnet参数
- 移除所有交易执行中的testMode检查
- 删除UI中的测试网checkbox
- 删除UI中的模拟交易checkbox
- 更新显示文本为"币安主网"和"实盘交易"
- 简化自动交易确认对话框

### 后端API
**src/app/api/binance/balance/route.ts**
- 删除 `TESTNET_URL` 常量
- 移除 `testnet` 请求参数
- 移除testnet相关逻辑
- 仅使用 `BASE_URL = "https://fapi.binance.com"`

**src/app/api/binance/positions/route.ts**
- 删除 `TESTNET_URL` 常量
- 移除 `testnet` 请求参数
- 移除testnet相关逻辑

**src/app/api/binance/orders/route.ts**
- 删除 `TESTNET_URL` 常量
- 移除 `testnet` 请求参数
- 移除testnet相关逻辑

**src/app/api/binance/order/route.ts**
- 删除 `TESTNET_URL` 常量
- 移除 `testnet` 请求参数
- 移除testnet相关逻辑

---

## 使用指南

### 准备工作

#### 1. 获取币安主网API密钥
1. 访问：https://www.binance.com/
2. 登录账号
3. 进入：API管理（API Management）
4. 点击"创建API"
5. 完成安全验证（短信、邮箱、Google Authenticator）
6. 设置权限：
   - ✅ 读取
   - ✅ 启用期货（Enable Futures）
   - ❌ 提现（Withdrawals）- 不建议开启
7. 设置IP白名单（强烈推荐）
8. 保存API Key和Secret

#### 2. IP白名单配置（可选但推荐）
在创建API密钥时，限制只有特定IP可以访问：
- 获取服务器IP：`curl ifconfig.me`
- 在API管理中添加IP地址

---

### 系统配置

#### 1. 连接币安
1. 打开应用：http://localhost:5000
2. 进入"自动交易系统"页面
3. 输入API Key和Secret
4. 点击"连接币安"按钮
5. 连接成功后显示：
   - ✅ 已连接币安主网
   - 账户余额：XXX USDT

#### 2. 配置交易参数
建议配置：
- **仓位大小**：5-10%（保守）
- **最大持仓数**：3
- **止损百分比**：0.5%
- **分段止盈**：开启
  - 1R止盈50%
  - 2R止盈50%
- **移动止损**：开启
  - 触发R值：1
  - 移至保本价：是

#### 3. 开启自动交易
1. 选择要监控的合约（如BTCUSDT、ETHUSDT）
2. 点击"开始监控"
3. 等待市场信号
4. 勾选"自动交易"开关
5. **重要**：会弹出确认对话框，请仔细确认

---

## 安全警告

⚠️ **重要提醒**

1. **仅使用真实资金**：系统现在只支持真实交易，任何操作都会产生实际盈亏

2. **API密钥安全**：
   - 不要分享API密钥
   - 定期更换API密钥
   - 设置IP白名单
   - 不要开启提现权限

3. **交易风险**：
   - 加密货币交易存在高风险
   - 过去的表现不代表未来的结果
   - 仅使用你能承受损失的资金

4. **建议做法**：
   - 从小仓位开始（如1-2%）
   - 充分测试策略后再加大仓位
   - 设置合理的止损
   - 不要梭哈全部资金

---

## 验证步骤

### 1. 验证API连接
```bash
# 查看服务器日志
pnpm dev

# 应该看到：
# [connectBinance] Starting connection...
# [connectBinance] Balance loaded: { available: 1000, ... }
# [connectBinance] Connected successfully
```

### 2. 验证余额显示
连接成功后，应该看到：
- 连接状态：✅ 已连接币安主网
- 账户余额：显示真实余额
- 持仓列表：显示当前持仓

### 3. 验证自动交易
1. 点击"开始监控"
2. 等待交易信号
3. 开启"自动交易"
4. 观察是否成功下单
5. 查看交易记录

---

## 常见问题

### Q1: 连接API后显示错误？
**A**: 检查：
- API Key和Secret是否正确
- API密钥权限是否足够（读取、期货交易）
- IP白名单是否正确配置

### Q2: 无法连接币安？
**A**: 检查：
- 网络连接是否正常
- API密钥是否是主网密钥（不是测试网）
- 是否触发了API限制

### Q3: 自动交易没有执行？
**A**: 检查：
- 是否勾选"自动交易"开关
- 是否确认了对话框
- 是否达到每日交易限制
- 是否达到最大持仓数量

### Q4: 如何停止自动交易？
**A**:
1. 取消勾选"自动交易"开关
2. 或点击"停止监控"

---

## 回滚说明

如果需要恢复测试网支持，需要：
1. 恢复被删除的代码（testnet、testMode相关）
2. 恢复UI选项
3. 恢复API端点的testnet参数
4. 恢复localStorage的testnet保存

**建议**：在真实交易前，建议先使用少量资金测试。

---

## 技术支持

如果遇到问题：
1. 查看浏览器控制台（F12）的错误日志
2. 查看服务器终端的日志输出
3. 参考 `API_400_ERROR_TROUBLESHOOTING.md`
4. 检查币安API文档：https://binance-docs.github.io/apidocs/futures/cn/

---

## 免责声明

- 本系统仅供学习和研究使用
- 作者不对任何交易损失负责
- 使用本系统即表示您同意自行承担所有风险
- 加密货币交易存在高风险，请理性投资

---

**祝您交易顺利！** 📈
