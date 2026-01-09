/**
 * 回测引擎接口定义
 * 支持策略测试功能
 */

import { KLineData, Signal } from "./strategy";

// 回测结果
export interface BacktestResult {
  // 基本信息
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;

  // 时间范围
  startTime: number;
  endTime: number;
  duration: number; // 毫秒

  // 交易统计
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // 胜率 %

  // 收益统计
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  profitFactor: number; // 盈利因子

  // 持仓统计
  avgHoldingTime: number; // 平均持仓时间（毫秒）
  maxHoldingTime: number;
  minHoldingTime: number;

  // 回撤统计
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgDrawdown: number;

  // 单笔统计
  avgProfitPerTrade: number;
  maxProfitPerTrade: number;
  maxLossPerTrade: number;
  avgProfitPerWinning: number;
  avgLossPerLosing: number;

  // 交易记录
  trades: BacktestTrade[];

  // 信号记录
  signals: Signal[];

  // 资金曲线
  equityCurve: EquityPoint[];

  // 回测参数
  params: Record<string, any>;

  // 回测时间
  backtestTime: number;
}

// 回测交易记录
export interface BacktestTrade {
  id: string;
  symbol: string;
  direction: "long" | "short";

  // 进场
  entryTime: number;
  entryPrice: number;
  entryReason: string;

  // 出场
  exitTime?: number;
  exitPrice?: number;
  exitReason?: string;

  // 数量
  quantity: number;

  // 收益
  profit?: number;
  profitPercent?: number;

  // 持仓时间
  holdingTime?: number;

  // 最大回撤（单笔）
  maxDrawdown?: number;
  maxProfit?: number;
}

// 资金曲线点
export interface EquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

// 回测配置
export interface BacktestConfig {
  strategyId: string;
  symbol: string;
  timeframe: string;

  // 时间范围
  startTime: number;
  endTime: number;

  // 资金管理
  initialBalance: number;
  positionSize: number; // 仓位大小（USD或币数）
  positionSizingMode: "fixed" | "percent" | "risk"; // 固定数量、百分比、风险金额
  riskPerTrade?: number; // 每笔风险金额（risk模式）

  // 交易成本
  commissionRate: number; // 手续费率
  slippage: number; // 滑点（%）

  // 策略参数
  params: Record<string, any>;

  // 风控参数
  stopLossPercent?: number; // 止损百分比
  takeProfitPercent?: number; // 止盈百分比
  maxDrawdownPercent?: number; // 最大回撤停止回测

  // 止损止盈模式
  stopLossMode?: "fixed" | "atr" | "percent"; // 固定值、ATR倍数、百分比
  takeProfitMode?: "fixed" | "atr" | "percent" | "risk_reward"; // 固定值、ATR倍数、百分比、风险收益比
  atrPeriod?: number; // ATR周期
  riskRewardRatio?: number; // 风险收益比
}

// 回测引擎接口
export interface BacktestEngine {
  // 运行回测
  run(config: BacktestConfig, klines: KLineData[]): Promise<BacktestResult>;

  // 获取回测进度（0-100）
  getProgress(): number;

  // 取消回测
  cancel(): void;

  // 获取引擎状态
  getStatus(): "idle" | "running" | "completed" | "cancelled" | "error";
  getError(): string | null;
}
