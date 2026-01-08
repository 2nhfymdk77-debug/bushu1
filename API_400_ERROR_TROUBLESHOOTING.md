# API 400错误排查指南

## 问题描述
在自动交易系统中，所有API请求（/api/binance/balance、/api/binance/positions、/api/binance/orders）都返回400错误。

---

## 已添加的调试功能

### 1. 后端日志（服务器控制台）
所有API端点现在都会输出详细的日志：

```
[Balance API] Request received { apiKey: '***', apiSecret: '***', testnet: true/false }
[Balance API] Fetching from https://testnet.binancefuture.com
[Balance API] Binance API error { code: -2015, msg: 'Invalid API-key, IP, or permissions for action.' }
```

### 2. 前端日志（浏览器控制台）
添加了详细的前端日志：

```
[connectBinance] Starting connection...
[connectBinance] Fetching balance...
[fetchAccountInfo] Fetching account info...
[fetchAccountInfo] Balance error: { error: "Invalid API-key" }
```

---

## 400错误的可能原因

### 原因1：API Key或Secret未配置
**症状**：前端未输入API密钥就点击了"连接API"

**检查方法**：
1. 打开浏览器控制台（F12 → Console）
2. 查找日志：`[connectBinance] No API credentials provided`

**解决方案**：
1. 在"币安API配置"区域输入API Key和Secret
2. 确保复制时没有多余的空格
3. 重新点击"连接API"

---

### 原因2：API Key或Secret错误
**症状**：输入了API密钥但币安返回认证失败

**检查方法**：
1. 查看服务器控制台日志
2. 查找错误：`Invalid API-key, IP, or permissions`

**解决方案**：
1. 检查API Key和Secret是否复制完整
2. 登录币安API管理页面重新生成密钥
3. 确认密钥的权限设置（读取账户信息、交易等）

---

### 原因3：IP白名单限制
**症状**：币安返回IP限制错误

**检查方法**：
1. 查看服务器控制台日志
2. 查找错误：`IP for action is not authorized`

**解决方案**：
1. 登录币安API管理页面
2. 在"IP访问限制"中添加你的服务器IP地址
3. 或者暂时关闭IP限制进行测试

**获取服务器IP地址**：
```bash
curl ifconfig.me
```

---

### 原因4：测试网与主网混淆
**症状**：使用主网密钥访问测试网，反之亦然

**检查方法**：
1. 确认"测试网"开关状态
2. 确认API密钥来源（测试网 vs 主网）

**解决方案**：
- 测试网密钥：https://testnet.binancefuture.com/
- 主网密钥：https://www.binance.com/en/my/settings/api-management

**重要**：测试网和主网的API密钥不互通！

---

### 原因5：API密钥权限不足
**症状**：某些API端点返回权限错误

**检查方法**：
1. 查看服务器控制台日志
2. 查找错误：`Permission denied`

**解决方案**：
1. 登录币安API管理页面
2. 为API密钥启用以下权限：
   - ✅ 读取账户信息
   - ✅ 期货交易
   - ✅ 撤销订单（如需要）

---

### 原因6：API密钥已过期或被禁用
**症状**：之前可用的密钥突然失效

**解决方案**：
1. 登录币安API管理页面
2. 删除旧密钥
3. 创建新的API密钥
4. 更新系统配置

---

## 排查步骤

### 步骤1：打开浏览器控制台
1. 按 F12 打开开发者工具
2. 切换到 Console 标签
3. 查看前端日志

### 步骤2：查看服务器日志
查看运行 `pnpm dev` 的终端窗口，找到后端API日志。

### 步骤3：检查Network请求
1. 在开发者工具中切换到 Network 标签
2. 筛选 XHR/Fetch 请求
3. 点击失败的请求（红色）
4. 查看：
   - Request Headers：确认API Key是否发送
   - Request Payload：确认参数是否正确
   - Response：查看币安返回的具体错误

### 步骤4：验证API密钥
使用curl直接测试API密钥：

```bash
# 测试获取余额（测试网）
curl -H "X-MBX-APIKEY: 你的API_KEY" \
  "https://testnet.binancefuture.com/fapi/v2/balance?timestamp=$(date +%s)000&signature=$(echo -n "timestamp=$(date +%s)000" | openssl dgst -sha256 -hmac "你的API_SECRET" | cut -d' ' -f2)"
```

---

## 常见错误码

| 错误码 | 含义 | 解决方案 |
|--------|------|----------|
| -2014 | API-key格式错误 | 检查API Key是否完整 |
| -2015 | API-key、IP或权限错误 | 检查IP白名单、权限设置 |
| -1021 | 时间戳超出限制 | 检查服务器时间是否同步 |
| -2008 | API密钥已过期 | 重新生成API密钥 |
| -2010 | IP不在白名单 | 添加IP到白名单 |

---

## 测试清单

在使用自动交易前，请确认：

- [ ] 已在币安创建API密钥
- [ ] API密钥有足够权限（读取账户、期货交易）
- [ ] 测试网密钥：勾选"测试网"开关
- [ ] 主网密钥：不勾选"测试网"开关
- [ ] 已配置IP白名单（如有限制）
- [ ] API Key和Secret复制完整，无多余空格
- [ ] 浏览器控制台无错误日志
- [ ] 服务器控制台显示"Connected successfully"
- [ ] 显示账户余额和合约列表

---

## 获取测试网API密钥

1. 访问：https://testnet.binancefuture.com/
2. 注册/登录账号
3. 进入 API Management
4. 点击"Create API"
5. 设置API标签和备注
6. 保存API Key和Secret

**注意**：测试网会自动提供10000 USDT用于测试。

---

## 获取主网API密钥（⚠️ 谨慎）

1. 登录币安主网：https://www.binance.com/
2. 进入：API管理（API Management）
3. 点击"创建API"
4. 完成安全验证（短信、邮箱、Google Authenticator）
5. 设置权限：
   - ✅ 读取
   - ✅ 启用期货（Enable Futures）
   - ✅ 启用提现（Enable Withdrawals）- 如需要
6. 设置IP白名单（强烈推荐）
7. 保存API Key和Secret

**⚠️ 安全提醒**：
- 不要分享API密钥
- 定期更换API密钥
- 设置IP白名单
- 不要开启提现权限（除非必要）
- 谨慎使用主网交易

---

## 如果问题仍未解决

1. **重启服务器**：
   ```bash
   # 停止当前服务（Ctrl+C）
   # 重新启动
   pnpm dev
   ```

2. **清除浏览器缓存**：
   - Ctrl + Shift + Delete
   - 清除缓存和Cookie

3. **使用新的API密钥**：
   - 删除旧密钥
   - 创建新密钥
   - 更新配置

4. **检查网络连接**：
   ```bash
   ping testnet.binancefuture.com
   ```

5. **联系币安客服**：
   如果确认API密钥配置正确但仍无法使用，可能是币安服务问题。

---

## 示例：正确配置

```
币安API配置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API Key:     [复制粘贴测试网API Key]
API Secret:  [复制粘贴测试网API Secret]

☑ 测试网
☑ 模拟交易

连接状态: 已连接
账户余额: 10000 USDT
可用合约: 234 个
```

---

**祝你配置顺利！** 🚀
