/**
 * 数据库模型定义
 * 使用 PostgreSQL 存储配置、交易记录、回测结果等
 */

// 用户配置
export interface UserConfig {
  id: string;
  userId: string;
  exchangeType: "binance" | "okx" | "bybit"; // 交易所类型
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  enableTrading: boolean;
  createdAt: number;
  updatedAt: number;
}

// 交易任务记录
export interface TradeTaskRecord {
  id: string;
  userId: string;

  // 任务信息
  name: string;
  strategyId: string;
  strategyName: string;
  strategyParams: Record<string, any>;

  // 交易对
  symbols: string[];
  timeframes: string[];

  // 风控配置
  riskControl: Record<string, any>;

  // 状态
  status: "idle" | "running" | "paused" | "stopped" | "error";
  startTime?: number;
  stopTime?: number;

  // 统计
  totalSignals: number;
  executedTrades: number;
  totalProfit: number;
  netProfit: number;

  createdAt: number;
  updatedAt: number;
}

// 信号执行记录
export interface SignalExecutionRecordDB {
  id: string;
  taskId: string;
  userId: string;

  // 信号信息
  symbol: string;
  direction: "long" | "short";
  signalTime: number;
  signalPrice: number;
  confidence: number;
  reason: string;

  // 执行信息
  executed: boolean;
  executionTime?: number;
  orderId?: number;
  executionPrice?: number;
  quantity: number;
  positionValue: number;

  // 结果
  exitTime?: number;
  exitPrice?: number;
  exitReason?: string;
  profit?: number;
  profitPercent?: number;

  // 错误
  error?: string;

  createdAt: number;
  updatedAt: number;
}

// 回测结果记录
export interface BacktestResultDB {
  id: string;
  userId: string;

  // 策略信息
  strategyId: string;
  strategyName: string;
  strategyParams: Record<string, any>;

  // 测试信息
  symbol: string;
  timeframe: string;
  startTime: number;
  endTime: number;

  // 配置
  initialBalance: number;
  commissionRate: number;
  slippage: number;

  // 结果统计
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;

  // 详细数据（JSON）
  trades: string; // JSON string
  signals: string; // JSON string
  equityCurve: string; // JSON string

  createdAt: number;
}

// 手动干预记录
export interface ManualInterventionRecord {
  id: string;
  userId: string;

  // 干预信息
  type: string;
  taskId?: string;
  symbol?: string;
  params?: Record<string, any>;

  // 结果
  success: boolean;
  result?: Record<string, any>;
  error?: string;

  createdAt: number;
}

// 交易日志
export interface TradingLog {
  id: string;
  userId: string;
  taskId?: string;

  // 日志级别
  level: "info" | "warn" | "error" | "debug";

  // 日志内容
  message: string;
  category: string; // 日志分类：signal、execution、risk、system

  // 关联数据
  data?: Record<string, any>;

  createdAt: number;
}

// 系统统计
export interface SystemStats {
  id: string;
  userId: string;

  // 时间范围
  date: string; // YYYY-MM-DD

  // 统计数据
  totalTasks: number;
  activeTasks: number;
  totalSignals: number;
  totalTrades: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;

  createdAt: number;
  updatedAt: number;
}
