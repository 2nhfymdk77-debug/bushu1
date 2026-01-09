"use client";

import React, { useState, useEffect } from "react";

// 任务状态类型
type TaskStatus = "idle" | "running" | "paused" | "stopped" | "error";

// 任务接口
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

// 信号接口
interface Signal {
  symbol: string;
  direction: "long" | "short";
  time: number;
  price: number;
  reason: string;
}

// 日志接口
interface Log {
  time: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
  taskId?: string;
}

interface TradingMonitorProps {
  isMobile?: boolean;
}

export default function TradingMonitor({ isMobile = false }: TradingMonitorProps) {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "task1",
      name: "BTC自动交易",
      strategyName: "15分钟趋势+5分钟回调",
      symbols: ["BTCUSDT"],
      status: "running",
      totalSignals: 45,
      executedTrades: 23,
      skippedTrades: 20,
      failedTrades: 2,
      netProfit: 1234.56,
      winRate: 65.2,
      riskStatus: "normal",
      lastUpdateTime: Date.now(),
    },
    {
      id: "task2",
      name: "ETH自动交易",
      strategyName: "15分钟趋势+5分钟回调",
      symbols: ["ETHUSDT"],
      status: "paused",
      totalSignals: 38,
      executedTrades: 18,
      skippedTrades: 18,
      failedTrades: 2,
      netProfit: -56.78,
      winRate: 55.6,
      riskStatus: "normal",
      lastUpdateTime: Date.now() - 300000,
    },
  ]);

  const [signals, setSignals] = useState<Signal[]>([
    {
      symbol: "BTCUSDT",
      direction: "long",
      time: Date.now() - 120000,
      price: 67500.0,
      reason: "EMA金叉 + RSI超卖反弹",
    },
    {
      symbol: "ETHUSDT",
      direction: "short",
      time: Date.now() - 300000,
      price: 3450.0,
      reason: "EMA死叉 + 价格跌破支撑",
    },
  ]);

  const [logs, setLogs] = useState<Log[]>([
    { time: Date.now() - 60000, level: "success", message: "BTCUSDT 做多订单执行成功，价格 67500.0", taskId: "task1" },
    { time: Date.now() - 120000, level: "info", message: "检测到 BTCUSDT 做多信号", taskId: "task1" },
    { time: Date.now() - 180000, level: "warn", message: "ETHUSDT 账户余额不足，跳过信号", taskId: "task2" },
    { time: Date.now() - 240000, level: "info", message: "任务 ETH自动交易 已暂停", taskId: "task2" },
  ]);

  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || "");
  const [showInterventionModal, setShowInterventionModal] = useState(false);

  // 状态样式映射
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

  const logLevelColors = {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    success: "text-green-400",
  };

  // 任务操作处理
  const handleTaskAction = async (taskId: string, action: string) => {
    console.log(`Task ${taskId}: ${action}`);
    // 这里应该调用API执行实际操作
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        if (action === "start") return { ...task, status: "running" as TaskStatus };
        if (action === "pause") return { ...task, status: "paused" as TaskStatus };
        if (action === "stop") return { ...task, status: "stopped" as TaskStatus };
        if (action === "delete") return task; // 实际应该删除
      }
      return task;
    }));
  };

  // 紧急停止
  const handleEmergencyStop = () => {
    if (confirm("确定要紧急停止所有任务吗？这将立即停止所有正在运行的交易任务。")) {
      console.log("Emergency stop triggered");
      setTasks(prev => prev.map(task => ({
        ...task,
        status: "stopped" as TaskStatus,
      })));
      setShowInterventionModal(false);
    }
  };

  // 手动平仓
  const handleClosePosition = (taskId: string, symbol: string) => {
    if (confirm(`确定要手动平仓 ${symbol} 吗？`)) {
      console.log(`Close position for ${symbol} in task ${taskId}`);
    }
  };

  // 取消挂单
  const handleCancelOrders = (taskId: string, symbol?: string) => {
    const msg = symbol
      ? `确定要取消 ${symbol} 的所有挂单吗？`
      : "确定要取消所有挂单吗？";
    if (confirm(msg)) {
      console.log(`Cancel orders: ${symbol || "all"} for task ${taskId}`);
    }
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <div className="space-y-6">
      {/* 全局操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowInterventionModal(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>紧急停止</span>
        </button>
        <button className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all">
          刷新状态
        </button>
      </div>

      {/* 任务列表 */}
      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg">交易任务</h3>
        </div>

        <div className="divide-y divide-gray-700">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={`p-4 md:p-6 cursor-pointer transition-colors ${
                selectedTaskId === task.id ? "bg-gray-700/50" : "hover:bg-gray-700/30"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* 任务信息 */}
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

                {/* 统计数据 */}
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
                  <div className={isMobile ? "hidden" : "block"}>
                    <div className="text-gray-400 text-xs">净收益</div>
                    <div className={`font-semibold ${task.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ${task.netProfit.toFixed(2)}
                    </div>
                  </div>
                  <div className={isMobile ? "hidden" : "block"}>
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

                {/* 操作按钮 */}
                <div className="flex items-center space-x-2">
                  {task.status === "running" && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTaskAction(task.id, "pause"); }}
                        className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                        title="暂停"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancelOrders(task.id); }}
                        className="p-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                        title="取消挂单"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                  {task.status === "paused" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTaskAction(task.id, "start"); }}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      title="恢复"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}
                  {task.status !== "stopped" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTaskAction(task.id, "stop"); }}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      title="停止"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 详细信息（选中任务） */}
      {selectedTask && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 最新信号 */}
          <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-lg">最新信号</h3>
              <span className="text-sm text-gray-400">最近20条</span>
            </div>
            <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
              {signals.length === 0 ? (
                <div className="p-8 text-center text-gray-400">暂无信号</div>
              ) : (
                signals.map((signal, index) => (
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
                      </div>
                      <span className="text-sm text-gray-400">
                        ${signal.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">{signal.reason}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 实时日志 */}
          <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-lg">实时日志</h3>
              <span className="text-sm text-gray-400">最近20条</span>
            </div>
            <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-400">暂无日志</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="p-4">
                    <div className="flex items-start space-x-3">
                      <span className={`text-xs ${logLevelColors[log.level]}`}>
                        {log.level.toUpperCase()}
                      </span>
                      <div className="flex-1 text-sm">{log.message}</div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.time).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 手动干预模态框 */}
      {showInterventionModal && (
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
                onClick={handleEmergencyStop}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all"
              >
                确认紧急停止
              </button>
              <button
                onClick={() => setShowInterventionModal(false)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
