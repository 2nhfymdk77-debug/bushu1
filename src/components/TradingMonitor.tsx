"use client";

import React, { useState } from "react";

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
  scanInterval: number; // 扫描间隔（秒）
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
  scanInterval: 5, // 默认5秒扫描一次
};

// 策略定义（与回测一致）
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

  // 获取当前策略
  const currentStrategy = STRATEGIES.find(s => s.id === selectedStrategy);

  // 步骤1：选择策略
  if (step === 1) {
    return (
      <div className="animate-fadeIn">
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
            onClick={handleStartTask}
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
        <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all">
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
                onAction={handleTaskAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* 详细信息（选中任务） */}
      {selectedTaskId && tasks.find(t => t.id === selectedTaskId) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SignalList signals={signals} />
          <LogList logs={logs} />
        </div>
      )}

      {/* 紧急停止模态框 */}
      {showInterventionModal && (
        <EmergencyStopModal
          onConfirm={handleEmergencyStop}
          onCancel={() => setShowInterventionModal(false)}
        />
      )}
    </div>
  );

  // 启动任务
  function handleStartTask() {
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

    // 添加日志
    addLog("success", `任务 "${newTask.name}" 已启动`, newTask.id);
  }

  // 任务操作
  function handleTaskAction(taskId: string, action: string) {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        let newStatus = task.status;
        if (action === "start") newStatus = "running";
        if (action === "pause") newStatus = "paused";
        if (action === "stop") newStatus = "stopped";

        if (newStatus !== task.status) {
          addLog("info", `任务 "${task.name}" ${action === "start" ? "已恢复" : action === "pause" ? "已暂停" : "已停止"}`, taskId);
        }

        return { ...task, status: newStatus as TaskStatus };
      }
      return task;
    }));
  }

  // 紧急停止
  function handleEmergencyStop() {
    setTasks(prev => prev.map(task => ({
      ...task,
      status: "stopped" as TaskStatus,
    })));
    addLog("error", "已紧急停止所有任务");
    setShowInterventionModal(false);
  }

  // 添加日志
  function addLog(level: Log["level"], message: string, taskId?: string) {
    setLogs(prev => [
      {
        time: Date.now(),
        level,
        message,
        taskId,
      },
      ...prev,
    ].slice(0, 50)); // 保留最近50条
  }
}

// 任务卡片组件
function TaskCard({
  task,
  selected,
  onSelect,
  onAction,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onAction: (id: string, action: string) => void;
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
            <div className="text-gray-400 text-xs">胜率</div>
            <div className={`font-semibold ${task.winRate >= 60 ? "text-green-400" : "text-red-400"}`}>
              {task.winRate.toFixed(1)}%
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-gray-400 text-xs">净收益</div>
            <div className={`font-semibold ${task.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
              ${task.netProfit.toFixed(2)}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-gray-400 text-xs">风险状态</div>
            <div className={`font-semibold ${
              task.riskStatus === "normal" ? "text-green-400" :
              task.riskStatus === "warning" ? "text-yellow-400" : "text-red-400"
            }`}>
              {task.riskStatus === "normal" ? "正常" :
               task.riskStatus === "warning" ? "警告" : "严重"}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {task.status === "running" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onAction(task.id, "pause"); }}
                className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                title="暂停"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAction(task.id, "stop"); }}
                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                title="停止"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
            </>
          )}
          {task.status === "paused" && (
            <button
              onClick={(e) => { e.stopPropagation(); onAction(task.id, "start"); }}
              className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              title="恢复"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 信号列表组件
function SignalList({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg">最新信号</h3>
        </div>
        <div className="p-8 text-center text-gray-400">暂无信号</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-lg">最新信号</h3>
        <span className="text-sm text-gray-400">最近20条</span>
      </div>
      <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
        {signals.slice(0, 20).map((signal, index) => (
          <div key={index} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium">{signal.symbol}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  signal.direction === "long"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}>
                  {signal.direction === "long" ? "做多" : "做空"}
                </span>
                {signal.executed && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                    已执行
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-400">
                ${signal.price.toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-gray-400">{signal.reason}</div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(signal.time).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 日志列表组件
function LogList({ logs }: { logs: Log[] }) {
  const logLevelColors = {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    success: "text-green-400",
  };

  if (logs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg">实时日志</h3>
        </div>
        <div className="p-8 text-center text-gray-400">暂无日志</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-lg">实时日志</h3>
        <span className="text-sm text-gray-400">最近20条</span>
      </div>
      <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
        {logs.slice(0, 20).map((log, index) => (
          <div key={index} className="p-4">
            <div className="flex items-start space-x-3">
              <span className={`text-xs font-medium ${logLevelColors[log.level]}`}>
                {log.level.toUpperCase()}
              </span>
              <div className="flex-1 text-sm">{log.message}</div>
              <span className="text-xs text-gray-500">
                {new Date(log.time).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 紧急停止模态框
function EmergencyStopModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
          <span className="text-red-500">⚠️</span>
          <span>紧急停止确认</span>
        </h3>
        <p className="text-gray-300 mb-6">
          您即将紧急停止所有交易任务。此操作将：
        </p>
        <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
          <li>立即停止所有正在运行的任务</li>
          <li>取消所有未执行的挂单</li>
          <li>保留当前持仓，不会强制平仓</li>
        </ul>
        <div className="flex space-x-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all"
          >
            确认紧急停止
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
