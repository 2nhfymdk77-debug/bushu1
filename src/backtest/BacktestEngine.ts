/**
 * 回测引擎实现
 * 支持策略测试功能
 */

import {
  BacktestEngine,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
} from "../types/backtest";
import { KLineData, Signal } from "../types/strategy";
import { strategyManager } from "../utils/strategyManager";

// 持仓状态
interface Position {
  id: string;
  symbol: string;
  direction: "long" | "short";
  entryTime: number;
  entryPrice: number;
  quantity: number;
  entryReason: string;
  maxProfit: number;
  maxDrawdown: number;
}

// 回测状态
interface BacktestState {
  balance: number;
  equity: number;
  maxEquity: number;
  currentDrawdown: number;
  maxDrawdown: number;
  positions: Map<string, Position>;
  trades: BacktestTrade[];
  signals: Signal[];
  equityCurve: EquityPoint[];
}

/**
 * 回测引擎类
 */
export class SimpleBacktestEngine implements BacktestEngine {
  private status: "idle" | "running" | "completed" | "cancelled" | "error" = "idle";
  private error: string | null = null;
  private progress: number = 0;
  private cancelled: boolean = false;

  /**
   * 运行回测
   */
  async run(config: BacktestConfig, klines: KLineData[]): Promise<BacktestResult> {
    this.status = "running";
    this.error = null;
    this.progress = 0;
    this.cancelled = false;

    try {
      // 获取策略
      const strategy = strategyManager.getStrategy(config.strategyId);
      if (!strategy) {
        throw new Error(`Strategy [${config.strategyId}] not found`);
      }

      // 初始化状态
      const state: BacktestState = {
        balance: config.initialBalance,
        equity: config.initialBalance,
        maxEquity: config.initialBalance,
        currentDrawdown: 0,
        maxDrawdown: 0,
        positions: new Map(),
        trades: [],
        signals: [],
        equityCurve: [],
      };

      // 过滤K线时间范围
      const filteredKlines = klines.filter((k) => {
        return k.timestamp >= config.startTime && k.timestamp <= config.endTime;
      });

      if (filteredKlines.length === 0) {
        throw new Error("No kline data in the specified time range");
      }

      const totalKlines = filteredKlines.length;
      let processedKlines = 0;

      // 逐根K线回测
      for (let i = 0; i < totalKlines; i++) {
        if (this.cancelled) {
          this.status = "cancelled";
          throw new Error("Backtest cancelled");
        }

        const kline = filteredKlines[i];

        // 获取历史K线数据（用于策略计算）
        const historyKlines = filteredKlines.slice(0, i + 1);

        // 生成信号
        const detectionResult = strategy.detectSignal(
          config.symbol,
          historyKlines,
          config.params
        );

        if (detectionResult.signal) {
          const signal = detectionResult.signal;
          state.signals.push(signal);

          // 执行信号
          await this.executeSignal(state, signal, config);
        }

        // 更新持仓
        this.updatePositions(state, kline, config);

        // 更新资金曲线
        this.updateEquityCurve(state, kline.timestamp);

        // 更新进度
        processedKlines++;
        this.progress = Math.round((processedKlines / totalKlines) * 100);

        // 检查最大回撤限制
        if (config.maxDrawdownPercent) {
          const drawdownPercent = (state.currentDrawdown / state.maxEquity) * 100;
          if (drawdownPercent >= config.maxDrawdownPercent) {
            console.log(`Backtest stopped due to max drawdown: ${drawdownPercent.toFixed(2)}%`);
            break;
          }
        }
      }

      // 平掉所有持仓
      this.closeAllPositions(state, filteredKlines[filteredKlines.length - 1], config);

      // 计算结果
      const result = this.calculateResult(state, config);

      this.status = "completed";
      return result;
    } catch (error: any) {
      this.status = "error";
      this.error = error.message;
      throw error;
    }
  }

  /**
   * 执行信号
   */
  private async executeSignal(
    state: BacktestState,
    signal: Signal,
    config: BacktestConfig
  ): Promise<void> {
    const positionKey = signal.symbol;

    // 检查是否已有反向持仓
    const existingPosition = state.positions.get(positionKey);

    if (existingPosition) {
      // 如果有反向持仓，先平仓
      if (existingPosition.direction !== signal.direction) {
        this.closePosition(state, existingPosition, signal.entryPrice, "Signal Reversal", config);
      } else {
        // 同向信号，忽略
        return;
      }
    }

    // 计算仓位大小
    let quantity: number;
    if (config.positionSizingMode === "fixed") {
      quantity = config.positionSize;
    } else if (config.positionSizingMode === "percent") {
      const positionValue = state.balance * (config.positionSize / 100);
      quantity = positionValue / signal.entryPrice;
    } else if (config.positionSizingMode === "risk" && config.riskPerTrade) {
      const riskAmount = state.balance * (config.riskPerTrade / 100);
      const stopLossPrice = this.calculateStopLossPrice(signal, config);
      const riskPerUnit = Math.abs(signal.entryPrice - stopLossPrice);
      quantity = riskAmount / riskPerUnit;
    } else {
      // 默认固定数量
      quantity = config.positionSize;
    }

    // 创建持仓
    const position: Position = {
      id: `${signal.symbol}_${signal.time}`,
      symbol: signal.symbol,
      direction: signal.direction,
      entryTime: signal.time,
      entryPrice: signal.entryPrice,
      quantity,
      entryReason: signal.reason,
      maxProfit: 0,
      maxDrawdown: 0,
    };

    state.positions.set(positionKey, position);

    console.log(`Open ${signal.direction} position: ${signal.symbol} @ ${signal.entryPrice}, Qty: ${quantity}`);
  }

  /**
   * 更新持仓
   */
  private updatePositions(
    state: BacktestState,
    kline: KLineData,
    config: BacktestConfig
  ): void {
    state.positions.forEach((position, key) => {
      const closePrice = kline.close;

      // 计算当前盈亏
      let pnl: number;
      if (position.direction === "long") {
        pnl = (closePrice - position.entryPrice) * position.quantity;
      } else {
        pnl = (position.entryPrice - closePrice) * position.quantity;
      }

      const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

      // 更新最大盈利和最大回撤
      if (pnl > position.maxProfit) {
        position.maxProfit = pnl;
      }

      if (pnl < position.maxDrawdown) {
        position.maxDrawdown = pnl;
      }

      // 检查止损
      if (config.stopLossPercent) {
        if (Math.abs(pnlPercent) >= config.stopLossPercent) {
          this.closePosition(state, position, closePrice, "Stop Loss", config);
          return;
        }
      }

      // 检查止盈
      if (config.takeProfitPercent) {
        if (pnlPercent >= config.takeProfitPercent) {
          this.closePosition(state, position, closePrice, "Take Profit", config);
          return;
        }
      }
    });
  }

  /**
   * 计算止损价格
   */
  private calculateStopLossPrice(signal: Signal, config: BacktestConfig): number {
    if (config.stopLossMode === "percent" && config.stopLossPercent) {
      const stopLossAmount = signal.entryPrice * (config.stopLossPercent / 100);
      if (signal.direction === "long") {
        return signal.entryPrice - stopLossAmount;
      } else {
        return signal.entryPrice + stopLossAmount;
      }
    }
    return signal.entryPrice * 0.95; // 默认5%止损
  }

  /**
   * 平仓
   */
  private closePosition(
    state: BacktestState,
    position: Position,
    closePrice: number,
    reason: string,
    config: BacktestConfig
  ): void {
    // 计算盈亏
    let pnl: number;
    if (position.direction === "long") {
      pnl = (closePrice - position.entryPrice) * position.quantity;
    } else {
      pnl = (position.entryPrice - closePrice) * position.quantity;
    }

    const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

    // 扣除手续费
    const commission = (position.entryPrice * position.quantity + closePrice * position.quantity) * config.commissionRate;
    const netPnl = pnl - commission;

    // 更新余额
    state.balance += netPnl;

    // 创建交易记录
    const trade: BacktestTrade = {
      id: position.id,
      symbol: position.symbol,
      direction: position.direction,
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      entryReason: position.entryReason,
      exitTime: Date.now(), // 使用当前K线时间
      exitPrice: closePrice,
      exitReason: reason,
      quantity: position.quantity,
      profit: netPnl,
      profitPercent: pnlPercent,
      holdingTime: Date.now() - position.entryTime,
      maxDrawdown: position.maxDrawdown,
      maxProfit: position.maxProfit,
    };

    state.trades.push(trade);

    // 移除持仓
    state.positions.delete(position.symbol);

    console.log(`Close ${position.direction} position: ${position.symbol} @ ${closePrice}, PnL: ${netPnl.toFixed(2)} (${pnlPercent.toFixed(2)}%), Reason: ${reason}`);
  }

  /**
   * 平掉所有持仓
   */
  private closeAllPositions(
    state: BacktestState,
    kline: KLineData,
    config: BacktestConfig
  ): void {
    const positions = Array.from(state.positions.values());
    positions.forEach((position) => {
      this.closePosition(state, position, kline.close, "End of Backtest", config);
    });
  }

  /**
   * 更新资金曲线
   */
  private updateEquityCurve(state: BacktestState, timestamp: number): void {
    // 计算当前权益（余额 + 未实现盈亏）
    let unrealizedPnl = 0;
    state.positions.forEach((position) => {
      unrealizedPnl += position.maxDrawdown; // 使用当前盈亏
    });

    state.equity = state.balance + unrealizedPnl;

    // 更新最大权益
    if (state.equity > state.maxEquity) {
      state.maxEquity = state.equity;
    }

    // 计算回撤
    state.currentDrawdown = state.maxEquity - state.equity;
    if (state.currentDrawdown > state.maxDrawdown) {
      state.maxDrawdown = state.currentDrawdown;
    }

    // 添加资金曲线点
    state.equityCurve.push({
      time: timestamp,
      equity: state.equity,
      drawdown: state.currentDrawdown,
      drawdownPercent: (state.currentDrawdown / state.maxEquity) * 100,
    });
  }

  /**
   * 计算回测结果
   */
  private calculateResult(state: BacktestState, config: BacktestConfig): BacktestResult {
    const trades = state.trades;
    const winningTrades = trades.filter((t) => t.profit! > 0);
    const losingTrades = trades.filter((t) => t.profit! <= 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit!, 0);
    const totalLoss = losingTrades.reduce((sum, t) => sum + t.profit!, 0);
    const netProfit = state.balance - config.initialBalance;

    // 平均持仓时间
    const holdingTimes = trades.filter((t) => t.holdingTime).map((t) => t.holdingTime!);
    const avgHoldingTime = holdingTimes.length > 0
      ? holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length
      : 0;

    return {
      strategyId: config.strategyId,
      strategyName: strategyManager.getStrategy(config.strategyId)?.meta.name || "",
      symbol: config.symbol,
      timeframe: config.timeframe,
      startTime: config.startTime,
      endTime: config.endTime,
      duration: config.endTime - config.startTime,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalProfit,
      totalLoss: Math.abs(totalLoss),
      netProfit,
      profitFactor: totalLoss !== 0 ? Math.abs(totalProfit / totalLoss) : 0,
      avgHoldingTime,
      maxHoldingTime: holdingTimes.length > 0 ? Math.max(...holdingTimes) : 0,
      minHoldingTime: holdingTimes.length > 0 ? Math.min(...holdingTimes) : 0,
      maxDrawdown: state.maxDrawdown,
      maxDrawdownPercent: (state.maxDrawdown / state.maxEquity) * 100,
      avgDrawdown: state.equityCurve.length > 0
        ? state.equityCurve.reduce((sum, e) => sum + e.drawdown, 0) / state.equityCurve.length
        : 0,
      avgProfitPerTrade: trades.length > 0 ? netProfit / trades.length : 0,
      maxProfitPerTrade: trades.length > 0 ? Math.max(...trades.map((t) => t.profit || 0)) : 0,
      maxLossPerTrade: trades.length > 0 ? Math.min(...trades.map((t) => t.profit || 0)) : 0,
      avgProfitPerWinning: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      avgLossPerLosing: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      trades: state.trades,
      signals: state.signals,
      equityCurve: state.equityCurve,
      params: config.params,
      backtestTime: Date.now(),
    };
  }

  /**
   * 获取回测进度
   */
  getProgress(): number {
    return this.progress;
  }

  /**
   * 取消回测
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * 获取引擎状态
   */
  getStatus(): "idle" | "running" | "completed" | "cancelled" | "error" {
    return this.status;
  }

  /**
   * 获取错误信息
   */
  getError(): string | null {
    return this.error;
  }
}
