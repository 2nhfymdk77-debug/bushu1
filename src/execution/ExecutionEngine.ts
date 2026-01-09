/**
 * 交易执行引擎实现
 * 支持自动交易功能和手动干预
 */

import {
  ExecutionEngine,
  ExecutionEngineConfig,
  TradeTask,
  TradeTaskStatus,
  RiskControlConfig,
  RiskControlStatus,
  ManualIntervention,
  ManualInterventionType,
  SignalExecutionRecord,
} from "../types/execution";
import { Exchange, OrderSide, PositionSide, Position, OrderType } from "../types/exchange";
import { KLineData, Signal } from "../types/strategy";
import { strategyManager } from "../utils/strategyManager";

// 任务运行状态
interface TaskRuntime {
  task: TradeTask;
  intervalId?: NodeJS.Timeout;
  klines: Map<string, KLineData[]>; // symbol -> klines
  lastScanTime: number;
  unsubscribers: Array<() => void>;
}

/**
 * 交易执行引擎类
 */
export class BinanceExecutionEngine implements ExecutionEngine {
  private config: ExecutionEngineConfig;
  private status: TradeTaskStatus = "idle";
  private tasks: Map<string, TaskRuntime> = new Map();
  private executionRecords: SignalExecutionRecord[] = [];
  private callbacks: {
    statusUpdate: Array<(status: TradeTaskStatus) => void>;
    taskUpdate: Array<(task: TradeTask) => void>;
    signalExecution: Array<(record: SignalExecutionRecord) => void>;
  } = {
    statusUpdate: [],
    taskUpdate: [],
    signalExecution: [],
  };

  constructor(config: ExecutionEngineConfig) {
    this.config = config;
  }

  /**
   * 启动引擎
   */
  async start(): Promise<void> {
    if (this.status === "running") {
      return;
    }

    this.status = "running";
    this.notifyStatusUpdate("running");

    console.log("Execution engine started");
  }

  /**
   * 停止引擎
   */
  async stop(): Promise<void> {
    if (this.status === "idle") {
      return;
    }

    // 停止所有任务
    const taskIds = Array.from(this.tasks.keys());
    for (const taskId of taskIds) {
      await this.stopTask(taskId);
    }

    this.status = "idle";
    this.notifyStatusUpdate("idle");

    console.log("Execution engine stopped");
  }

  /**
   * 暂停引擎
   */
  pause(): void {
    if (this.status !== "running") {
      return;
    }

    this.status = "paused";
    this.notifyStatusUpdate("paused");

    console.log("Execution engine paused");
  }

  /**
   * 恢复引擎
   */
  resume(): void {
    if (this.status !== "paused") {
      return;
    }

    this.status = "running";
    this.notifyStatusUpdate("running");

    console.log("Execution engine resumed");
  }

  /**
   * 添加任务
   */
  async addTask(taskData: Partial<TradeTask>): Promise<TradeTask> {
    const task: TradeTask = {
      id: taskData.id || `task_${Date.now()}`,
      name: taskData.name || "Unnamed Task",
      strategyId: taskData.strategyId || "",
      strategyName: taskData.strategyName || "",
      strategyParams: taskData.strategyParams || {},
      symbols: taskData.symbols || [],
      timeframes: taskData.timeframes || [],
      status: "idle",
      totalSignals: 0,
      executedTrades: 0,
      skippedTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      netProfit: 0,
      winRate: 0,
      riskStatus: "normal",
      lastUpdateTime: Date.now(),
    };

    // 创建任务运行时状态
    const runtime: TaskRuntime = {
      task,
      klines: new Map(),
      lastScanTime: 0,
      unsubscribers: [],
    };

    this.tasks.set(task.id, runtime);

    return task;
  }

  /**
   * 移除任务
   */
  async removeTask(taskId: string): Promise<void> {
    const runtime = this.tasks.get(taskId);
    if (!runtime) {
      throw new Error(`Task [${taskId}] not found`);
    }

    // 如果任务正在运行，先停止
    if (runtime.task.status === "running") {
      await this.stopTask(taskId);
    }

    // 取消所有订阅
    runtime.unsubscribers.forEach((unsub) => unsub());

    this.tasks.delete(taskId);
  }

  /**
   * 启动任务
   */
  async startTask(taskId: string): Promise<void> {
    const runtime = this.tasks.get(taskId);
    if (!runtime) {
      throw new Error(`Task [${taskId}] not found`);
    }

    if (runtime.task.status === "running") {
      return;
    }

    // 更新任务状态
    runtime.task.status = "running";
    runtime.task.startTime = Date.now();
    runtime.task.lastUpdateTime = Date.now();

    // 初始化K线数据
    for (const symbol of runtime.task.symbols) {
      for (const timeframe of runtime.task.timeframes) {
        const klines = await this.config.exchange.getKlines(symbol, timeframe, 200);
        runtime.klines.set(`${symbol}_${timeframe}`, this.convertKlines(klines));
      }
    }

    // 订阅实时数据
    for (const symbol of runtime.task.symbols) {
      for (const timeframe of runtime.task.timeframes) {
        const unsubscribe = await this.config.exchange.subscribeKlines(
          symbol,
          timeframe,
          (data) => this.handleKlineUpdate(runtime, symbol, timeframe, data)
        );
        runtime.unsubscribers.push(unsubscribe);
      }
    }

    // 启动定时扫描
    this.startTaskScan(runtime);

    this.notifyTaskUpdate(runtime.task);

    console.log(`Task [${taskId}] started`);
  }

  /**
   * 停止任务
   */
  async stopTask(taskId: string): Promise<void> {
    const runtime = this.tasks.get(taskId);
    if (!runtime) {
      throw new Error(`Task [${taskId}] not found`);
    }

    if (runtime.task.status !== "running") {
      return;
    }

    // 更新任务状态
    runtime.task.status = "stopped";
    runtime.task.stopTime = Date.now();
    runtime.task.lastUpdateTime = Date.now();

    // 停止定时扫描
    if (runtime.intervalId) {
      clearInterval(runtime.intervalId);
    }

    // 取消所有订阅
    runtime.unsubscribers.forEach((unsub) => unsub());
    runtime.unsubscribers = [];

    this.notifyTaskUpdate(runtime.task);

    console.log(`Task [${taskId}] stopped`);
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): void {
    const runtime = this.tasks.get(taskId);
    if (!runtime || runtime.task.status !== "running") {
      return;
    }

    runtime.task.status = "paused";
    runtime.task.lastUpdateTime = Date.now();

    // 停止定时扫描
    if (runtime.intervalId) {
      clearInterval(runtime.intervalId);
    }

    this.notifyTaskUpdate(runtime.task);

    console.log(`Task [${taskId}] paused`);
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId: string): void {
    const runtime = this.tasks.get(taskId);
    if (!runtime || runtime.task.status !== "paused") {
      return;
    }

    runtime.task.status = "running";
    runtime.task.lastUpdateTime = Date.now();

    // 重新启动定时扫描
    this.startTaskScan(runtime);

    this.notifyTaskUpdate(runtime.task);

    console.log(`Task [${taskId}] resumed`);
  }

  /**
   * 启动任务扫描
   */
  private startTaskScan(runtime: TaskRuntime): void {
    runtime.intervalId = setInterval(() => {
      this.scanSignals(runtime);
    }, this.config.scanInterval);
  }

  /**
   * 扫描信号
   */
  private async scanSignals(runtime: TaskRuntime): Promise<void> {
    if (runtime.task.status !== "running") {
      return;
    }

    const now = Date.now();
    runtime.lastScanTime = now;

    try {
      // 获取策略
      const strategy = strategyManager.getStrategy(runtime.task.strategyId);
      if (!strategy) {
        console.error(`Strategy [${runtime.task.strategyId}] not found`);
        return;
      }

      // 检查风控状态
      const riskStatus = this.checkRiskControl();
      if (riskStatus === "critical") {
        console.warn("Risk control: Critical status, pausing task");
        this.pauseTask(runtime.task.id);
        return;
      }

      // 扫描所有交易对
      for (const symbol of runtime.task.symbols) {
        for (const timeframe of runtime.task.timeframes) {
          const key = `${symbol}_${timeframe}`;
          const klines = runtime.klines.get(key);

          if (!klines || klines.length === 0) {
            continue;
          }

          // 检测信号
          const detectionResult = strategy.detectSignal(
            symbol,
            klines,
            runtime.task.strategyParams
          );

          if (detectionResult.signal) {
            runtime.task.totalSignals++;

            // 执行信号
            await this.executeSignal(runtime, detectionResult.signal);
          }
        }
      }

      // 更新任务统计
      await this.updateTaskStats(runtime);

      // 更新最后更新时间
      runtime.task.lastUpdateTime = now;

      this.notifyTaskUpdate(runtime.task);
    } catch (error: any) {
      console.error(`Error scanning signals for task [${runtime.task.id}]:`, error);
    }
  }

  /**
   * 执行信号
   */
  private async executeSignal(
    runtime: TaskRuntime,
    signal: Signal
  ): Promise<void> {
    if (!this.config.enableAutoTrade) {
      console.log(`Auto-trading disabled, skipping signal: ${signal.symbol} ${signal.direction}`);
      runtime.task.skippedTrades++;
      return;
    }

    try {
      // 获取当前持仓
      const positions = await this.config.exchange.getPositions(signal.symbol);
      const existingPosition = positions.find(
        (p) => p.positionSide === (signal.direction === "long" ? "LONG" : "SHORT")
      );

      // 如果有反向持仓，先平仓
      if (existingPosition) {
        if (
          (signal.direction === "long" && existingPosition.positionSide === "SHORT") ||
          (signal.direction === "short" && existingPosition.positionSide === "LONG")
        ) {
          await this.closePosition(runtime, existingPosition);
        } else {
          // 同向持仓，忽略
          return;
        }
      }

      // 计算订单参数
      const orderParams = this.calculateOrderParams(runtime, signal);

      // 下单
      const order = await this.config.exchange.placeOrder(orderParams);

      // 创建执行记录
      const record: SignalExecutionRecord = {
        id: `exec_${Date.now()}_${Math.random()}`,
        taskId: runtime.task.id,
        signal: signal,
        executed: true,
        executionTime: Date.now(),
        orderId: order.orderId,
        signalPrice: signal.entryPrice,
        executionPrice: order.avgPrice || parseFloat(order.price),
        slippage: Math.abs((order.avgPrice || parseFloat(order.price)) - signal.entryPrice),
        quantity: parseFloat(order.executedQty),
        positionValue: parseFloat(order.executedQty) * parseFloat(order.price),
        timestamp: Date.now(),
      };

      this.executionRecords.push(record);
      runtime.task.executedTrades++;

      this.notifySignalExecution(record);

      console.log(`Signal executed: ${signal.symbol} ${signal.direction} @ ${signal.entryPrice}`);
    } catch (error: any) {
      console.error(`Failed to execute signal:`, error);

      // 创建失败记录
      const record: SignalExecutionRecord = {
        id: `exec_${Date.now()}_${Math.random()}`,
        taskId: runtime.task.id,
        signal: signal,
        executed: false,
        signalPrice: signal.entryPrice,
        quantity: 0,
        positionValue: 0,
        error: error.message,
        timestamp: Date.now(),
      };

      this.executionRecords.push(record);
      runtime.task.failedTrades++;

      this.notifySignalExecution(record);
    }
  }

  /**
   * 计算订单参数
   */
  private calculateOrderParams(runtime: TaskRuntime, signal: Signal): any {
    const side = signal.direction === "long" ? OrderSide.BUY : OrderSide.SELL;
    const positionSide = signal.direction === "long" ? PositionSide.LONG : PositionSide.SHORT;

    // 计算数量（基于风险控制）
    const maxPositionSize = this.config.riskControl.maxPositionSize;
    const quantity = Math.min(
      maxPositionSize / signal.entryPrice,
      100 // 默认限制
    );

    return {
      symbol: signal.symbol,
      side,
      type: OrderType.MARKET,
      positionSide,
      quantity,
      reduceOnly: false,
    };
  }

  /**
   * 平仓
   */
  private async closePosition(
    runtime: TaskRuntime,
    position: Position
  ): Promise<void> {
    const side = position.positionSide === "LONG" ? OrderSide.SELL : OrderSide.BUY;

    await this.config.exchange.placeOrder({
      symbol: position.symbol,
      side,
      type: OrderType.MARKET,
      positionSide: position.positionSide,
      quantity: Math.abs(position.positionAmt),
      reduceOnly: true,
    });

    console.log(`Position closed: ${position.symbol} ${position.positionSide}`);
  }

  /**
   * 更新任务统计
   */
  private async updateTaskStats(runtime: TaskRuntime): Promise<void> {
    // 获取账户信息
    const accountInfo = await this.config.exchange.getAccountInfo();
    const profit = accountInfo.totalWalletBalance - 1000; // 假设初始余额1000

    runtime.task.totalProfit = profit > 0 ? profit : 0;
    runtime.task.netProfit = profit;

    // 计算胜率
    const taskRecords = this.executionRecords.filter((r) => r.taskId === runtime.task.id);
    const executedCount = taskRecords.length;
    if (executedCount > 0) {
      // 这里简化处理，实际需要从数据库获取交易结果
      runtime.task.winRate = 50; // 占位
    }
  }

  /**
   * 检查风控状态
   */
  private checkRiskControl(): RiskControlStatus {
    // 简化实现
    return "normal";
  }

  /**
   * 处理K线更新
   */
  private handleKlineUpdate(
    runtime: TaskRuntime,
    symbol: string,
    timeframe: string,
    data: any
  ): void {
    const key = `${symbol}_${timeframe}`;
    const klines = runtime.klines.get(key);

    if (!klines) {
      return;
    }

    // 更新最后一根K线
    const lastKline = klines[klines.length - 1];
    const newKline: KLineData = {
      timestamp: data.k.t,
      open: parseFloat(data.k.o),
      high: parseFloat(data.k.h),
      low: parseFloat(data.k.l),
      close: parseFloat(data.k.c),
      volume: parseFloat(data.k.v),
    };

    if (lastKline && lastKline.timestamp === newKline.timestamp) {
      // 更新当前K线
      klines[klines.length - 1] = newKline;
    } else {
      // 添加新K线
      klines.push(newKline);
      // 保持最大长度
      if (klines.length > 200) {
        klines.shift();
      }
    }
  }

  /**
   * 转换K线格式
   */
  private convertKlines(data: any[]): KLineData[] {
    return data.map((k) => ({
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  }

  /**
   * 手动干预
   */
  async manualIntervention(intervention: ManualIntervention): Promise<ManualIntervention> {
    const result: ManualIntervention = {
      ...intervention,
      timestamp: Date.now(),
    };

    try {
      switch (intervention.type) {
        case "pause_task":
          if (intervention.taskId) {
            this.pauseTask(intervention.taskId);
          }
          break;

        case "resume_task":
          if (intervention.taskId) {
            this.resumeTask(intervention.taskId);
          }
          break;

        case "stop_task":
          if (intervention.taskId) {
            await this.stopTask(intervention.taskId);
          }
          break;

        case "emergency_stop":
          await this.stop();
          break;

        case "close_position":
          if (intervention.symbol && intervention.positionSide) {
            const positions = await this.config.exchange.getPositions(intervention.symbol);
            const position = positions.find(
              (p) => p.positionSide === intervention.positionSide
            );
            if (position) {
              const runtime = Array.from(this.tasks.values())[0];
              if (runtime) {
                await this.closePosition(runtime, position);
              }
            }
          }
          break;

        case "cancel_orders":
          const orders = await this.config.exchange.getOpenOrders(intervention.symbol);
          for (const order of orders) {
            await this.config.exchange.cancelOrder(order.symbol, order.orderId);
          }
          break;

        case "adjust_risk":
          if (intervention.params) {
            this.config.riskControl = {
              ...this.config.riskControl,
              ...intervention.params,
            };
          }
          break;

        default:
          throw new Error(`Unknown intervention type: ${intervention.type}`);
      }

      result.success = true;
    } catch (error: any) {
      result.success = false;
      result.error = error.message;
    }

    return result;
  }

  /**
   * 获取所有任务
   */
  getTasks(): TradeTask[] {
    return Array.from(this.tasks.values()).map((runtime) => runtime.task);
  }

  /**
   * 获取任务详情
   */
  getTask(taskId: string): TradeTask | undefined {
    return this.tasks.get(taskId)?.task;
  }

  /**
   * 获取执行记录
   */
  getExecutionRecords(taskId?: string, limit?: number): SignalExecutionRecord[] {
    let records = this.executionRecords;

    if (taskId) {
      records = records.filter((r) => r.taskId === taskId);
    }

    if (limit) {
      records = records.slice(-limit);
    }

    return records;
  }

  /**
   * 获取风控状态
   */
  getRiskStatus(): RiskControlStatus {
    return this.checkRiskControl();
  }

  /**
   * 更新风控配置
   */
  updateRiskControl(config: Partial<RiskControlConfig>): void {
    this.config.riskControl = {
      ...this.config.riskControl,
      ...config,
    };
  }

  /**
   * 获取引擎状态
   */
  getStatus(): TradeTaskStatus {
    return this.status;
  }

  /**
   * 订阅状态更新
   */
  onStatusUpdate(callback: (status: TradeTaskStatus) => void): void {
    this.callbacks.statusUpdate.push(callback);
  }

  /**
   * 订阅任务更新
   */
  onTaskUpdate(callback: (task: TradeTask) => void): void {
    this.callbacks.taskUpdate.push(callback);
  }

  /**
   * 订阅信号执行
   */
  onSignalExecution(callback: (record: SignalExecutionRecord) => void): void {
    this.callbacks.signalExecution.push(callback);
  }

  /**
   * 通知状态更新
   */
  private notifyStatusUpdate(status: TradeTaskStatus): void {
    this.callbacks.statusUpdate.forEach((callback) => callback(status));
  }

  /**
   * 通知任务更新
   */
  private notifyTaskUpdate(task: TradeTask): void {
    this.callbacks.taskUpdate.forEach((callback) => callback(task));
  }

  /**
   * 通知信号执行
   */
  private notifySignalExecution(record: SignalExecutionRecord): void {
    this.callbacks.signalExecution.forEach((callback) => callback(record));
  }
}
