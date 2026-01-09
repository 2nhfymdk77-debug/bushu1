# 合约自动轮换功能修复说明

## 问题描述

自动扫描程序扫描的合约不自动轮换，每次扫描都使用相同的合约批次，无法覆盖整个合约池。

## 根本原因分析

### 问题根源
`currentBatchIndex` 状态变量使用 `useState` 管理，但在 `scanAllSymbols` 函数中存在闭包问题：

1. **闭包陷阱**：`scanAllSymbols` 函数在 `useEffect` 中被引用，每次依赖项变化时会创建新的闭包
2. **异步更新**：`setCurrentBatchIndex` 是异步的，函数执行时 `currentBatchIndex` 是闭包捕获的旧值
3. **状态不同步**：即使调用了 `setCurrentBatchIndex`，在函数执行过程中 `currentBatchIndex` 不会更新

### 代码问题示例
```typescript
// ❌ 问题代码
const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

const scanAllSymbols = async () => {
  // 计算批次（使用闭包中的旧值）
  const startIndex = (currentBatchIndex * batchSize) % newContractPool.length;
  const currentBatch = newContractPool.slice(startIndex, endIndex);

  addLog(`📊 批次 ${currentBatchIndex + 1}/${totalBatches}...`);

  // 更新状态（异步，不会立即生效）
  setCurrentBatchIndex((prev) => (prev + 1) % totalBatches);
};
```

### 为什么不轮换？
- 第一次扫描：`currentBatchIndex = 0` → 扫描批次 1，更新为 1
- 第二次扫描：闭包中 `currentBatchIndex = 0` → 扫描批次 1，更新为 1
- 第三次扫描：闭包中 `currentBatchIndex = 0` → 扫描批次 1，更新为 1
- 结果：每次都扫描批次 1，不会轮换

## 解决方案

### 使用 `useRef` 保存批次索引
`useRef` 的值在组件生命周期内保持不变，不会受闭包影响，每次访问都能获取最新值。

### 修复后的代码
```typescript
// ✅ 修复后的代码
const currentBatchRef = useRef(0); // 使用ref避免闭包问题

const scanAllSymbols = async () => {
  // 从ref获取最新值
  const currentBatchIndex = currentBatchRef.current;

  // 计算批次（使用最新值）
  const startIndex = (currentBatchIndex * batchSize) % newContractPool.length;
  const currentBatch = newContractPool.slice(startIndex, endIndex);

  addLog(`📊 批次 ${currentBatchIndex + 1}/${totalBatches}...`);

  // 直接更新ref（立即生效）
  currentBatchRef.current = (currentBatchRef.current + 1) % totalBatches;
};
```

### 修复效果
- 第一次扫描：`currentBatchRef.current = 0` → 扫描批次 1，更新为 1
- 第二次扫描：`currentBatchRef.current = 1` → 扫描批次 2，更新为 2
- 第三次扫描：`currentBatchRef.current = 2` → 扫描批次 3，更新为 3
- 结果：每次扫描不同批次，自动轮换

## 代码变更详情

### 1. 修改状态定义（第244行）
```diff
- const [currentBatchIndex, setCurrentBatchIndex] = useState(0); // 当前扫描批次索引
+ const currentBatchRef = useRef(0); // 当前扫描批次索引（使用ref避免闭包问题）
```

### 2. 修改批次索引重置（第369行）
```diff
  if (JSON.stringify(newContractPool) !== JSON.stringify(contractPool)) {
    setContractPool(newContractPool);
-   setCurrentBatchIndex(0);
+   currentBatchRef.current = 0;
    addLog(`📊 更新合约池: ${newContractPool.length} 个高成交量合约`);
  }
```

### 3. 添加局部变量获取最新值（第376行）
```diff
  const batchSize = 10;
  const totalBatches = Math.ceil(newContractPool.length / batchSize);
+ const currentBatchIndex = currentBatchRef.current;
  const startIndex = (currentBatchIndex * batchSize) % newContractPool.length;
```

### 4. 修改批次索引更新（第384行）
```diff
  addLog(`📊 批次 ${currentBatchIndex + 1}/${totalBatches}: ${currentBatch.length} 个合约 ${currentBatch.join(', ')}`);

  // 更新批次索引（下次扫描切换到下一批）
- setCurrentBatchIndex((prev) => (prev + 1) % totalBatches);
+ currentBatchRef.current = (currentBatchRef.current + 1) % totalBatches;
```

## 验证方法

### 1. 查看扫描日志
启动自动扫描后，观察扫描日志中的批次信息：

```
[10:00:00] 📊 批次 1/50: 10 个合约 BTCUSDT,ETHUSDT,...
[10:05:00] 📊 批次 2/50: 10 个合约 BNBUSDT,SOLUSDT,...
[10:10:00] 📊 批次 3/50: 10 个合约 ADAUSDT,XRPUSDT,...
...
```

### 2. 检查合约覆盖
扫描几轮后，检查是否覆盖了不同的合约：

- 第1-10次扫描：合约 A-J
- 第11-20次扫描：合约 K-T
- 第21-30次扫描：合约 U-AD
- ...

### 3. 验证轮换逻辑
确认批次索引是否正确递增并循环：

```
批次 1 → 批次 2 → 批次 3 → ... → 批次 50 → 批次 1 → ...
```

## 轮换机制说明

### 批次计算逻辑
```typescript
const batchSize = 10;                           // 每批10个合约
const totalBatches = Math.ceil(500 / 10) = 50;  // 总共50批次
const currentBatchIndex = 0;                   // 当前批次索引（0-49）

const startIndex = (currentBatchIndex * batchSize) % 500;
const endIndex = Math.min(startIndex + batchSize, 500);
const currentBatch = contractPool.slice(startIndex, endIndex);
```

### 批次轮换示例

| 扫描次数 | currentBatchIndex | startIndex | endIndex | 扫描的合约 |
|---------|------------------|------------|----------|-----------|
| 1 | 0 | 0 | 10 | 合约1-10 |
| 2 | 1 | 10 | 20 | 合约11-20 |
| 3 | 2 | 20 | 30 | 合约21-30 |
| ... | ... | ... | ... | ... |
| 50 | 49 | 490 | 500 | 合约491-500 |
| 51 | 0 | 0 | 10 | 合约1-10（循环） |
| 52 | 1 | 10 | 20 | 合约11-20（循环） |

### 完整覆盖时间
- **合约池大小**：500个合约
- **每批扫描**：10个合约
- **总批次**：50批
- **完整覆盖时间**：50次扫描

| 扫描间隔 | 完整覆盖时间 |
|---------|-------------|
| 10秒 | 500秒 ≈ 8.3分钟 |
| 30秒 | 1500秒 ≈ 25分钟 |
| 1分钟 | 50分钟 |
| 5分钟 | 250分钟 ≈ 4.2小时 |

## 相关技术点

### useState vs useRef

| 特性 | useState | useRef |
|-----|----------|--------|
| **存储内容** | 任意值 | 可变值 |
| **触发重渲染** | 是 | 否 |
| **闭包问题** | 有 | 无 |
| **更新方式** | 异步 | 同步 |
| **适用场景** | 需要更新UI的状态 | 不需要更新UI的状态 |

### 为什么使用 useRef？

1. **批次索引不需要显示在UI上**：`currentBatchIndex` 只是内部轮换逻辑，用户不需要看到
2. **需要立即更新**：每次扫描后立即更新索引，不能等待下次渲染
3. **避免不必要的重渲染**：使用 `useState` 会触发整个组件重渲染，影响性能
4. **解决闭包问题**：`useRef` 的值在组件生命周期内保持不变，每次访问都是最新值

## 其他注意事项

### 合约池更新
当合约池更新时（如24小时成交量变化），批次索引会自动重置：

```typescript
if (JSON.stringify(newContractPool) !== JSON.stringify(contractPool)) {
  setContractPool(newContractPool);
  currentBatchRef.current = 0;  // 重置为第一批次
  addLog(`📊 更新合约池: ${newContractPool.length} 个高成交量合约`);
}
```

### 边界情况处理
- 当合约数量不是10的倍数时，最后一批可能少于10个合约
- 当合约数量为0时，不会触发扫描（已由前面的条件判断处理）

### 性能影响
- 使用 `useRef` 不会触发重渲染，性能更好
- 避免了不必要的组件更新，减少了计算开销

## 总结

通过将 `currentBatchIndex` 从 `useState` 改为 `useRef`，成功解决了合约不自动轮换的问题。修复后的代码：

✅ 每次扫描自动切换到下一批合约
✅ 扫描完所有批次后自动循环
✅ 合约池更新时自动重置批次索引
✅ 不会触发不必要的组件重渲染
✅ 性能更优，代码更简洁

修复已完成并通过类型检查验证。
