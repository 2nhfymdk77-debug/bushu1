"use client";

import React, { useState, useEffect, useRef } from "react";

// 类型定义
type TaskStatus = "idle" | "running" | "paused" | "stopped" | "error";

interface Task {
  id: string;
  name: string;
  strategyName: string;
  symbols: string[];
  status: TaskStatus;
  totalSignals: number;
  executedTrades: number;
  skippedTrades: number;
  failedTrades: number;
  netProfit: number;
  winRate: number;
  riskStatus: "normal" | "warning" | "critical";
  lastUpdateTime: number;
}

interface Signal {
  symbol: string;
  direction: "long" | "short";
  time: number;
  price: number;
  reason: string;
  executed: boolean;
}

interface Log {
  time: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
  taskId?: string;
}

interface AccountInfo {
  available: number;
  wallet: number;
  unrealizedPnl: number;
  totalPositionMargin: number;
}

export interface TradingParams {
  emaShort: number;
  emaLong: number;
  rsiPeriod: number;
  volumePeriod: number;
  stopLossPercent: number;
  riskReward1: number;
  riskReward2: number;
  leverage: number;
  riskPercent: number;
  minTrendDistance: number;
  initialCapital: number;
  maxPositionPercent: number;
  symbols: string;
  scanInterval: number;
}

export const DEFAULT_TRADING_PARAMS: TradingParams = {
  emaShort: 20,
  emaLong: 60,
  rsiPeriod: 14,
  volumePeriod: 20,
  stopLossPercent: 0.4,
  riskReward1: 1.5,
  riskReward2: 2.5,
  leverage: 3,
  riskPercent: 2,
  minTrendDistance: 0.15,
  initialCapital: 10000,
  maxPositionPercent: 30,
  symbols: "BTCUSDT,ETHUSDT",
  scanInterval: 5,
};

const STRATEGIES = [
  {
    id: "ema_trend_pullback",
    name: "15分钟趋势 + 5分钟回调策略",
    description: "基于EMA趋势识别和5分钟回调信号的经典策略，适合趋势明显的市场。",
    icon: "📈",
    params: ["emaShort", "emaLong", "rsiPeriod", "volumePeriod", "stopLossPercent", "riskReward1", "riskReward2", "leverage", "minTrendDistance"]
  },
  {
    id: "rsi_reversal",
    name: "RSI超买超卖反转策略",
    description: "利用RSI指标识别超买超卖区域，捕捉价格反转机会。",
    icon: "🔄",
    params: ["rsiPeriod", "stopLossPercent", "riskReward1", "riskReward2", "leverage"]
  },
  {
    id: "breakout",
    name: "突破策略",
    description: "识别关键支撑阻力位的突破，捕捉趋势启动信号。",
    icon: "🚀",
    params: ["volumePeriod", "stopLossPercent", "riskReward1", "riskReward2", "leverage"]
  }
];

interface TradingMonitorProps {
  isMobile?: boolean;
}

export default function TradingMonitor({ isMobile = false }: TradingMonitorProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [params, setParams] = useState<TradingParams>(DEFAULT_TRADING_PARAMS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [showInterventionModal, setShowInterventionModal] = useState(false);

  // API密钥和账户信息
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // 定时扫描引用
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 从localStorage加载API密钥
  useEffect(() => {
    const storedApiKey = localStorage.getItem("binance_api_key");
    const storedApiSecret = localStorage.getItem("binance_api_secret");
    if (storedApiKey && storedApiSecret) {
      setApiKey(storedApiKey);
      setApiSecret(storedApiSecret);
      connectToAccount(storedApiKey, storedApiSecret);
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  const currentStrategy = STRATEGIES.find(s => s.id === selectedStrategy);

  // 连接账户并获取余额
  const connectToAccount = async (key: string, secret: string) => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/binance/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, apiSecret: secret }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "连接失败");
      }

      const data = await response.json();
      setAccountInfo(data);

      // 保存到localStorage
      localStorage.setItem("binance_api_key", key);
      localStorage.setItem("binance_api_secret", secret);

      addLog("success", "成功连接币安账户，余额已更新");
    } catch (error: any) {
      addLog("error", `连接失败: ${error.message}`);
      setAccountInfo(null);
    } finally {
      setIsConnecting(false);
    }
  };

  // 扫描所有交易对的信号
  const scanSymbols = async (taskId: string, taskStrategyId: string, taskParams: TradingParams) => {
    try {
      const symbols = taskParams.symbols.split(",").map(s => s.trim()).filter(s => s);
      const response = await fetch("/api/trading/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          apiSecret,
          strategyId: taskStrategyId,
          symbols,
          params: taskParams,
          interval: "15m",
        }),
      });

      if (!response.ok) {
        throw new Error("扫描失败");
      }

      const result = await response.json();

      // 更新任务统计
      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            totalSignals: task.totalSignals + result.data.signalCount,
            lastUpdateTime: Date.now(),
          };
        }
        return task;
      }));

      // 处理找到的信号
      if (result.data.results && result.data.results.length > 0) {
        for (const item of result.data.results) {
          if (item.signal) {
            addLog("info", `发现信号: ${item.symbol} ${item.signal.direction} - ${item.signal.reason}`, taskId);
            setSignals(prev => [{
              ...item.signal,
              executed: false,
            }, ...prev].slice(0, 50));

            // 自动执行交易
            await executeOrder(taskId, item.signal, taskParams);
          }
        }
      }

      if (result.data.errors && result.data.errors.length > 0) {
        result.data.errors.forEach((err: any) => {
          addLog("warn", `${err.symbol} 扫描失败: ${err.error}`, taskId);
        });
      }

    } catch (error: any) {
      addLog("error", `扫描失败: ${error.message}`, taskId);
    }
  };

  // 执行订单
  const executeOrder = async (taskId: string, signal: Signal, taskParams: TradingParams) => {
    try {
      // 计算仓位大小
      const accountBalance = accountInfo?.available || 10000;
      const positionSize = (accountBalance * (taskParams.maxPositionPercent / 100)) * taskParams.leverage;

      const side = signal.direction === "long" ? "BUY" : "SELL";
      const positionSide = signal.direction === "long" ? "LONG" : "SHORT";

      const response = await fetch("/api/trading/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          apiSecret,
          symbol: signal.symbol,
          side,
          positionSide,
          quantity: positionSize.toFixed(3),
          type: "MARKET",
          leverage: taskParams.leverage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "下单失败");
      }

      const result = await response.json();

      // 更新任务统计
      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            executedTrades: task.executedTrades + 1,
          };
        }
        return task;
      }));

      // 更新信号状态
      setSignals(prev => prev.map(s => {
        if (s.symbol === signal.symbol && s.time === signal.time) {
          return { ...s, executed: true };
        }
        return s;
      }));

      addLog("success", `订单已执行: ${signal.symbol} ${side} ${positionSize.toFixed(3)} @ ${signal.price}`, taskId);

    } catch (error: any) {
      addLog("error", `执行订单失败: ${error.message}`, taskId);

      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            failedTrades: task.failedTrades + 1,
          };
        }
        return task;
      }));
    }
  };

  // 启动自动交易任务
  const startTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: `${currentStrategy?.name}`,
      strategyName: currentStrategy?.name || "",
      symbols: params.symbols.split(",").map(s => s.trim()).filter(s => s),
      status: "running",
      totalSignals: 0,
      executedTrades: 0,
      skippedTrades: 0,
      failedTrades: 0,
      netProfit: 0,
      winRate: 0,
      riskStatus: "normal",
      lastUpdateTime: Date.now(),
    };

    setTasks(prev => [...prev, newTask]);
    setSelectedTaskId(newTask.id);
    setStep(3);
    addLog("success", `任务 "${newTask.name}" 已启动`, newTask.id);

    // 开始定时扫描
    startScan(newTask.id, selectedStrategy, params);
  };

  // 开始定时扫描
  const startScan = (taskId: string, strategyId: string, taskParams: TradingParams) => {
    // 立即执行一次
    scanSymbols(taskId, strategyId, taskParams);

    // 设置定时扫描
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(() => {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status === "running") {
        scanSymbols(taskId, strategyId, taskParams);
      }
    }, taskParams.scanInterval * 1000);
  };

  // 停止任务
  const stopTask = (taskId: string) => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        return { ...task, status: "stopped" as TaskStatus };
      }
      return task;
    }));

    addLog("info", `任务已停止`, taskId);
  };

  // 添加日志
  const addLog = (level: Log["level"], message: string, taskId?: string) => {
    setLogs(prev => [
      {
        time: Date.now(),
        level,
        message,
        taskId,
      },
      ...prev,
    ].slice(0, 100));
  };

  // 步骤1：API连接
  if (step === 1 && (!accountInfo || !apiKey)) {
    return (
      <div className="animate-fadeIn">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">连接币安账户</h2>
          <p className="text-gray-400">输入您的币安API密钥以开始自动交易</p>
        </div>

        <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入您的API Key"
                className="w-full bg-gray-700 rounded px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="输入您的API Secret"
                className="w-full bg-gray-700 rounded px-4 py-3 text-white"
              />
            </div>
            <button
              onClick={() => connectToAccount(apiKey, apiSecret)}
              disabled={isConnecting || !apiKey || !apiSecret}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                isConnecting || !apiKey || !apiSecret
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isConnecting ? "连接中..." : "连接账户"}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500">
          🔒 您的API密钥仅存储在浏览器本地，不会上传到服务器
        </p>
      </div>
    );
  }

  // 步骤1：选择策略
  if (step === 1) {
    return (
      <div className="animate-fadeIn">
        {/* 账户信息卡片 */}
        {accountInfo && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-green-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                账户已连接
              </h3>
              <button
                onClick={() => connectToAccount(apiKey, apiSecret)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                刷新余额
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-400">可用余额</div>
                <div className="text-xl font-bold text-white">{accountInfo.available.toFixed(2)} USDT</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">总钱包余额</div>
                <div className="text-xl font-bold text-white">{accountInfo.wallet.toFixed(2)} USDT</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">未实现盈亏</div>
                <div className={`text-xl font-bold ${accountInfo.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {accountInfo.unrealizedPnl >= 0 ? "+" : ""}{accountInfo.unrealizedPnl.toFixed(2)} USDT
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">持仓保证金</div>
                <div className="text-xl font-bold text-white">{accountInfo.totalPositionMargin.toFixed(2)} USDT</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">选择自动交易策略</h2>
          <p className="text-gray-400">选择一个策略开始自动交易</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {STRATEGIES.map((strategy) => (
            <div
              key={strategy.id}
              onClick={() => setSelectedStrategy(strategy.id)}
              className={`cursor-pointer rounded-xl p-6 border-2 transition-all ${
                selectedStrategy === strategy.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-700 bg-gray-800 hover:border-gray-600"
              }`}
            >
              <div className="text-4xl mb-4">{strategy.icon}</div>
              <h3 className="text-lg font-bold mb-2">{strategy.name}</h3>
              <p className="text-sm text-gray-400">{strategy.description}</p>
              {selectedStrategy === strategy.id && (
                <div className="mt-4 flex items-center text-blue-400 text-sm">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  已选择
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setStep(3)}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
          >
            查看运行中的任务
          </button>
          <button
            onClick={() => setStep(2)}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all"
          >
            下一步：配置参数
          </button>
        </div>
      </div>
    );
  }

  // 步骤2：配置参数
  if (step === 2) {
    return (
      <div className="animate-fadeIn">
        <div className="mb-6">
          <button
            onClick={() => setStep(1)}
            className="text-gray-400 hover:text-white text-sm mb-2"
          >
            ← 返回选择策略
          </button>
          <h2 className="text-2xl font-bold mb-2">配置交易参数</h2>
          <p className="text-gray-400">当前策略：{currentStrategy?.name}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 策略参数 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <span className="text-xl mr-2">⚙️</span>
              策略参数
            </h3>
            <div className="space-y-4">
              {currentStrategy?.params.includes("emaShort") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">EMA短期周期</label>
                  <input
                    type="number"
                    value={params.emaShort}
                    onChange={(e) => setParams({ ...params, emaShort: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              )}
              {currentStrategy?.params.includes("emaLong") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">EMA长期周期</label>
                  <input
                    type="number"
                    value={params.emaLong}
                    onChange={(e) => setParams({ ...params, emaLong: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              )}
              {currentStrategy?.params.includes("rsiPeriod") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">RSI周期</label>
                  <input
                    type="number"
                    value={params.rsiPeriod}
                    onChange={(e) => setParams({ ...params, rsiPeriod: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              )}
              {currentStrategy?.params.includes("volumePeriod") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">成交量周期</label>
                  <input
                    type="number"
                    value={params.volumePeriod}
                    onChange={(e) => setParams({ ...params, volumePeriod: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">止损比例 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.stopLossPercent}
                  onChange={(e) => setParams({ ...params, stopLossPercent: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">止盈1R (倍数)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={params.riskReward1}
                    onChange={(e) => setParams({ ...params, riskReward1: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">止盈2R (倍数)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={params.riskReward2}
                    onChange={(e) => setParams({ ...params, riskReward2: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              {currentStrategy?.params.includes("leverage") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">杠杆倍数</label>
                  <input
                    type="number"
                    value={params.leverage}
                    onChange={(e) => setParams({ ...params, leverage: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              )}
              {currentStrategy?.params.includes("minTrendDistance") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">最小趋势距离 (%)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={params.minTrendDistance}
                    onChange={(e) => setParams({ ...params, minTrendDistance: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 交易与运行参数 */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <span className="text-xl mr-2">💰</span>
                仓位管理
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">初始资金 (USDT)</label>
                  <input
                    type="number"
                    value={params.initialCapital}
                    onChange={(e) => setParams({ ...params, initialCapital: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">单笔最大仓位 (%)</label>
                  <input
                    type="number"
                    value={params.maxPositionPercent}
                    onChange={(e) => setParams({ ...params, maxPositionPercent: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <span className="text-xl mr-2">⚡</span>
                运行参数
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">交易对（逗号分隔）</label>
                  <input
                    type="text"
                    value={params.symbols}
                    onChange={(e) => setParams({ ...params, symbols: e.target.value })}
                    placeholder="例如: BTCUSDT,ETHUSDT"
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">扫描间隔（秒）</label>
                  <input
                    type="number"
                    min="1"
                    value={params.scanInterval}
                    onChange={(e) => setParams({ ...params, scanInterval: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">⚠️ 间隔过小可能导致API限流</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => {
              setParams(DEFAULT_TRADING_PARAMS);
            }}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
          >
            重置参数
          </button>
          <button
            onClick={startTask}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all"
          >
            🚀 启动自动交易
          </button>
        </div>
      </div>
    );
  }

  // 步骤3：交易监控
  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <button
          onClick={() => setStep(1)}
          className="text-gray-400 hover:text-white text-sm mb-2"
        >
          ← 返回选择策略
        </button>
        <h2 className="text-2xl font-bold mb-2">交易监控</h2>
        <p className="text-gray-400">实时监控和管理自动交易任务</p>
      </div>

      {/* 账户信息 */}
      {accountInfo && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400">可用余额</div>
              <div className="font-semibold text-white">{accountInfo.available.toFixed(2)} USDT</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">总余额</div>
              <div className="font-semibold text-white">{accountInfo.wallet.toFixed(2)} USDT</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">未实现盈亏</div>
              <div className={`font-semibold ${accountInfo.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {accountInfo.unrealizedPnl >= 0 ? "+" : ""}{accountInfo.unrealizedPnl.toFixed(2)} USDT
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">持仓保证金</div>
              <div className="font-semibold text-white">{accountInfo.totalPositionMargin.toFixed(2)} USDT</div>
            </div>
          </div>
        </div>
      )}

      {/* 全局操作按钮 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setShowInterventionModal(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>紧急停止</span>
        </button>
        <button
          onClick={() => setStep(1)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all"
        >
          新建任务
        </button>
      </div>

      {/* 任务列表 */}
      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 mb-6">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg">交易任务</h3>
        </div>

        {tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            暂无运行中的任务
            <div className="mt-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all"
              >
                创建新任务
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                selected={selectedTaskId === task.id}
                onSelect={setSelectedTaskId}
                onStop={() => stopTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 详细信息（选中任务） */}
      {selectedTaskId && tasks.find(t => t.id === selectedTaskId) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SignalList signals={signals} />
          <LogList logs={logs} taskId={selectedTaskId} />
        </div>
      )}

      {/* 紧急停止模态框 */}
      {showInterventionModal && (
        <EmergencyStopModal
          onConfirm={() => {
            tasks.forEach(task => stopTask(task.id));
            setShowInterventionModal(false);
          }}
          onCancel={() => setShowInterventionModal(false)}
        />
      )}
    </div>
  );
}

// 任务卡片组件
function TaskCard({
  task,
  selected,
  onSelect,
  onStop,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onStop: (id: string) => void;
}) {
  const statusStyles = {
    idle: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    running: "bg-green-500/20 text-green-400 border-green-500/30",
    paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    stopped: "bg-gray-600/20 text-gray-400 border-gray-600/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusLabels = {
    idle: "空闲",
    running: "运行中",
    paused: "已暂停",
    stopped: "已停止",
    error: "错误",
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      className={`p-4 md:p-6 cursor-pointer transition-colors ${
        selected ? "bg-gray-700/50" : "hover:bg-gray-700/30"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-lg">{task.name}</h4>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              statusStyles[task.status]
            }`}>
              {statusLabels[task.status]}
            </span>
          </div>
          <div className="text-sm text-gray-400 space-y-1">
            <div>策略: {task.strategyName}</div>
            <div>交易对: {task.symbols.join(", ")}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-gray-400 text-xs">信号数</div>
            <div className="font-semibold">{task.totalSignals}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">已执行</div>
            <div className="font-semibold">{task.executedTrades}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">失败</div>
            <div className="font-semibold text-red-400">{task.failedTrades}</div>
          </div>
          <div className="hidden md:block">
            <div className="text-gray-400 text-xs">净收益</div>
            <div className={`font-semibold ${task.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
              ${task.netProfit.toFixed(2)}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-gray-400 text-xs">最后更新</div>
            <div className="font-semibold text-xs">
              {new Date(task.lastUpdateTime).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {task.status === "running" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStop(task.id);
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all text-sm"
          >
            停止
          </button>
        )}
      </div>
    </div>
  );
}

// 信号列表组件
function SignalList({ signals }: { signals: Signal[] }) {
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h3 className="font-semibold text-lg">交易信号</h3>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {signals.length === 0 ? (
          <div className="text-center text-gray-400 py-8">暂无信号</div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  signal.executed
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-gray-700/50 border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{signal.symbol}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    signal.direction === "long"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {signal.direction.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mb-1">
                  价格: ${signal.price.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {signal.reason}
                </div>
                {signal.executed && (
                  <div className="text-xs text-green-400">✓ 已执行</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 日志列表组件
function LogList({ logs, taskId }: { logs: Log[]; taskId: string }) {
  const filteredLogs = logs.filter(log => !taskId || log.taskId === taskId || !log.taskId);

  const levelColors = {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    success: "text-green-400",
  };

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h3 className="font-semibold text-lg">运行日志</h3>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">暂无日志</div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-gray-500">
                  {new Date(log.time).toLocaleTimeString()}
                </span>
                <span className={levelColors[log.level]}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 紧急停止模态框组件
function EmergencyStopModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4 flex items-center text-red-400">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          紧急停止所有任务
        </h3>
        <p className="text-gray-400 mb-6">
          您确定要停止所有正在运行的自动交易任务吗？此操作将立即停止所有扫描和交易执行。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all"
          >
            确认停止
          </button>
        </div>
      </div>
    </div>
  );
}
