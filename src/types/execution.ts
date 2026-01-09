/**
 * 交易执行引擎接口定义
 * 支持自动交易功能和手动干预
 */

import { Exchange, OrderSide, PositionSide } from "./exchange";
import { Signal } from "./strategy";

// 交易任务状态
export type TradeTaskStatus = "idle" | "running" | "paused" | "stopped" | "error";

// 风险控制状态
export type RiskControlStatus = "normal" | "warning" | "critical";

// 交易任务
export interface TradeTask {
  id: string;
  name: string;

  // 策略配置
  strategyId: string;
  strategyName: string;
  strategyParams: Record<string, any>;

  // 交易对配置
  symbols: string[];
  timeframes: string[];

  // 状态
  status: TradeTaskStatus;
  startTime?: number;
  stopTime?: number;
  runTime?: number; // 运行时长（毫秒）

  // 执行统计
  totalSignals: number;
  executedTrades: number;
  skippedTrades: number;
  failedTrades: number;

  // 收益统计
  totalProfit: number;
  netProfit: number;
  winRate: number;

  // 风控状态
  riskStatus: RiskControlStatus;

  // 最后更新
  lastUpdateTime: number;
}

// 风险控制配置
export interface RiskControlConfig {
  // 资金限制
  maxPositionSize: number; // 最大单笔仓位（USD）
  maxTotalPosition: number; // 最大总仓位（USD）
  maxDailyLoss: number; // 最大日亏损（USD）
  maxDrawdown: number; // 最大回撤（%）

  // 单笔交易限制
  stopLossPercent: number; // 单笔止损百分比
  takeProfitPercent: number; // 单笔止盈百分比
  maxTradesPerDay: number; // 每日最大交易次数

  // 强制止损
  enableEmergencyStop: boolean; // 启用紧急止损
  emergencyStopPercent: number; // 紧急止损百分比

  // 账户保护
  minBalance: number; // 最小账户余额
  maxLeverage: number; // 最大杠杆
}

// 手动干预类型
export type ManualInterventionType =
  | "pause_task"          // 暂停任务
  | "resume_task"         // 恢复任务
  | "stop_task"           // 停止任务
  | "emergency_stop"      // 紧急停止（停止所有任务）
  | "close_position"      // 手动平仓
  | "cancel_orders"       // 取消挂单
  | "adjust_risk"         // 调整风控参数
  | "override_signal";    // 覆盖信号

// 手动干预操作
export interface ManualIntervention {
  id: string;
  type: ManualInterventionType;
  taskId?: string;
  symbol?: string;
  positionSide?: PositionSide;

  // 操作参数
  params?: Record<string, any>;

  // 操作结果
  success: boolean;
  result?: any;
  error?: string;

  // 时间戳
  timestamp: number;
}

// 信号执行记录
export interface SignalExecutionRecord {
  id: string;
  taskId: string;
  signal: Signal;

  // 执行结果
  executed: boolean;
  executionTime?: number;
  orderId?: number;
  error?: string;

  // 价格
  signalPrice: number;
  executionPrice?: number;
  slippage?: number;

  // 数量
  quantity: number;
  positionValue: number;

  // 时间戳
  timestamp: number;
}

// 交易执行引擎配置
export interface ExecutionEngineConfig {
  // 交易所
  exchange: Exchange;

  // 风控配置
  riskControl: RiskControlConfig;

  // 扫描间隔（毫秒）
  scanInterval: number;

  // 是否启用自动交易
  enableAutoTrade: boolean;

  // 是否记录日志
  enableLogging: boolean;
}

// 交易执行引擎接口
export interface ExecutionEngine {
  // 启动引擎
  start(): Promise<void>;

  // 停止引擎
  stop(): Promise<void>;

  // 暂停引擎
  pause(): void;

  // 恢复引擎
  resume(): void;

  // 添加任务
  addTask(task: Partial<TradeTask>): Promise<TradeTask>;

  // 移除任务
  removeTask(taskId: string): Promise<void>;

  // 启动任务
  startTask(taskId: string): Promise<void>;

  // 停止任务
  stopTask(taskId: string): Promise<void>;

  // 暂停任务
  pauseTask(taskId: string): void;

  // 恢复任务
  resumeTask(taskId: string): void;

  // 获取所有任务
  getTasks(): TradeTask[];

  // 获取任务详情
  getTask(taskId: string): TradeTask | undefined;

  // 手动干预
  manualIntervention(intervention: ManualIntervention): Promise<ManualIntervention>;

  // 获取执行记录
  getExecutionRecords(taskId?: string, limit?: number): SignalExecutionRecord[];

  // 获取风控状态
  getRiskStatus(): RiskControlStatus;

  // 更新风控配置
  updateRiskControl(config: Partial<RiskControlConfig>): void;

  // 获取引擎状态
  getStatus(): TradeTaskStatus;

  // 订阅状态更新
  onStatusUpdate(callback: (status: TradeTaskStatus) => void): void;

  // 订阅任务更新
  onTaskUpdate(callback: (task: TradeTask) => void): void;

  // 订阅信号执行
  onSignalExecution(callback: (record: SignalExecutionRecord) => void): void;
}
