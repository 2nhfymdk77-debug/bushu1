"use client";

import React, { useState } from "react";

interface TradingRecordsProps {
  isMobile?: boolean;
}

export default function TradingRecords({ isMobile = false }: TradingRecordsProps) {
  const [viewMode, setViewMode] = useState<"list" | "stats">("list");
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("today");

  // 模拟交易记录数据
  const trades = [
    {
      id: "1",
      symbol: "BTCUSDT",
      direction: "long",
      entryTime: Date.now() - 3600000,
      entryPrice: 67500.0,
      exitTime: Date.now() - 1800000,
      exitPrice: 67800.0,
      profit: 300.0,
      profitPercent: 0.44,
      quantity: 0.01,
      reason: "EMA金叉 + RSI超卖反弹",
    },
    {
      id: "2",
      symbol: "ETHUSDT",
      direction: "short",
      entryTime: Date.now() - 7200000,
      exitTime: Date.now() - 5400000,
      exitPrice: 3420.0,
      entryPrice: 3450.0,
      profit: 30.0,
      profitPercent: 0.87,
      quantity: 0.1,
      reason: "EMA死叉 + 价格跌破支撑",
    },
    {
      id: "3",
      symbol: "BTCUSDT",
      direction: "long",
      entryTime: Date.now() - 10800000,
      exitTime: Date.now() - 9000000,
      exitPrice: 67300.0,
      entryPrice: 67400.0,
      profit: -100.0,
      profitPercent: -0.15,
      quantity: 0.01,
      reason: "回调至EMA支撑位",
    },
  ];

  const stats = {
    totalTrades: trades.length,
    winningTrades: trades.filter(t => t.profit > 0).length,
    losingTrades: trades.filter(t => t.profit < 0).length,
    totalProfit: trades.reduce((sum, t) => sum + t.profit, 0),
    totalLoss: Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0)),
    winRate: (trades.filter(t => t.profit > 0).length / trades.length) * 100,
    avgProfitPerTrade: trades.reduce((sum, t) => sum + t.profit, 0) / trades.length,
    maxProfit: Math.max(...trades.map(t => t.profit)),
    maxLoss: Math.min(...trades.map(t => t.profit)),
  };

  return (
    <div className="space-y-6">
      {/* 视图切换和筛选 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            交易列表
          </button>
          <button
            onClick={() => setViewMode("stats")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === "stats"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            统计分析
          </button>
        </div>

        <div className="flex space-x-2">
          {(["today", "week", "month", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                timeRange === range
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              {range === "today" ? "今天" : range === "week" ? "本周" : range === "month" ? "本月" : "全部"}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="总交易数"
          value={stats.totalTrades}
          color="blue"
          subtext={`盈: ${stats.winningTrades} 亏: ${stats.losingTrades}`}
        />
        <StatCard
          title="胜率"
          value={`${stats.winRate.toFixed(1)}%`}
          color={stats.winRate >= 60 ? "green" : stats.winRate >= 40 ? "yellow" : "red"}
          subtext={`盈利 ${stats.winningTrades} 笔`}
        />
        <StatCard
          title="总收益"
          value={`$${stats.totalProfit.toFixed(2)}`}
          color={stats.totalProfit >= 0 ? "green" : "red"}
          subtext={`平均每笔 $${stats.avgProfitPerTrade.toFixed(2)}`}
        />
        <StatCard
          title="盈亏比"
          value={stats.totalLoss !== 0 ? (stats.totalProfit / stats.totalLoss).toFixed(2) : "0"}
          color={stats.totalProfit > stats.totalLoss ? "green" : "red"}
          subtext={`最大盈: $${stats.maxProfit.toFixed(2)}`}
        />
      </div>

      {/* 交易列表视图 */}
      {viewMode === "list" && (
        <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="font-semibold text-lg">交易记录</h3>
          </div>

          {/* 表头 */}
          <div className="hidden md:grid md:grid-cols-8 gap-4 px-6 py-3 bg-gray-800/50 text-sm text-gray-400 font-medium">
            <div>时间</div>
            <div>交易对</div>
            <div>方向</div>
            <div>进场价</div>
            <div>出场价</div>
            <div>数量</div>
            <div>收益</div>
            <div>原因</div>
          </div>

          {/* 交易列表 */}
          <div className="divide-y divide-gray-700">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="p-4 md:grid md:grid-cols-8 md:gap-4 md:items-center hover:bg-gray-700/30 transition-colors"
              >
                <div className="mb-2 md:mb-0">
                  <div className="text-sm text-gray-400 md:hidden">时间</div>
                  <div className="text-sm">{new Date(trade.entryTime).toLocaleString()}</div>
                </div>
                <div className="mb-2 md:mb-0">
                  <div className="text-sm text-gray-400 md:hidden">交易对</div>
                  <div className="font-medium">{trade.symbol}</div>
                </div>
                <div className="mb-2 md:mb-0">
                  <div className="text-sm text-gray-400 md:hidden">方向</div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    trade.direction === "long"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {trade.direction === "long" ? "做多" : "做空"}
                  </span>
                </div>
                <div className="mb-2 md:mb-0">
                  <div className="text-sm text-gray-400 md:hidden">进场价</div>
                  <div className="text-sm">${trade.entryPrice.toLocaleString()}</div>
                </div>
                <div className="mb-2 md:mb-0">
                  <div className="text-sm text-gray-400 md:hidden">出场价</div>
                  <div className="text-sm">${trade.exitPrice.toLocaleString()}</div>
                </div>
                <div className="mb-2 md:mb-0">
                  <div className="text-sm text-gray-400 md:hidden">数量</div>
                  <div className="text-sm">{trade.quantity}</div>
                </div>
                <div className="mb-2 md:mb-0">
                  <div className="text-sm text-gray-400 md:hidden">收益</div>
                  <div className={`font-semibold ${trade.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {trade.profit >= 0 ? "+" : ""}${trade.profit.toFixed(2)}
                    <span className="text-xs text-gray-400 ml-1">
                      ({trade.profitPercent >= 0 ? "+" : ""}{trade.profitPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 md:hidden">原因</div>
                  <div className="text-xs text-gray-400 truncate">{trade.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 统计分析视图 */}
      {viewMode === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 收益分布 */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="font-semibold mb-4">收益分布</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">盈利交易</span>
                <span className="text-green-400 font-medium">${stats.totalProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">亏损交易</span>
                <span className="text-red-400 font-medium">-${stats.totalLoss.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <span className="text-gray-300 font-medium">净收益</span>
                <span className={`font-bold ${stats.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  ${stats.totalProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* 交易统计 */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="font-semibold mb-4">交易统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">总交易数</span>
                <span className="font-medium">{stats.totalTrades}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">胜率</span>
                <span className={`font-medium ${stats.winRate >= 60 ? "text-green-400" : "text-yellow-400"}`}>
                  {stats.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">平均每笔收益</span>
                <span className={`font-medium ${stats.avgProfitPerTrade >= 0 ? "text-green-400" : "text-red-400"}`}>
                  ${stats.avgProfitPerTrade.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">最大单笔盈利</span>
                <span className="text-green-400 font-medium">${stats.maxProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">最大单笔亏损</span>
                <span className="text-red-400 font-medium">${stats.maxLoss.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 盈亏比 */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="font-semibold mb-4">盈亏比分析</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">总盈利</span>
                <span className="text-green-400 font-medium">${stats.totalProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">总亏损</span>
                <span className="text-red-400 font-medium">${stats.totalLoss.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <span className="text-gray-300 font-medium">盈亏比</span>
                <span className={`font-bold ${stats.totalProfit > stats.totalLoss ? "text-green-400" : "text-red-400"}`}>
                  {stats.totalLoss !== 0 ? (stats.totalProfit / stats.totalLoss).toFixed(2) : "0"}
                </span>
              </div>
            </div>
          </div>

          {/* 交易对统计 */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="font-semibold mb-4">交易对统计</h3>
            <div className="space-y-3">
              {Array.from(new Set(trades.map(t => t.symbol))).map(symbol => {
                const symbolTrades = trades.filter(t => t.symbol === symbol);
                const symbolProfit = symbolTrades.reduce((sum, t) => sum + t.profit, 0);
                return (
                  <div key={symbol} className="flex justify-between items-center">
                    <span className="text-gray-400">{symbol}</span>
                    <span className={`font-medium ${symbolProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ${symbolProfit.toFixed(2)} ({symbolTrades.length} 笔)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 统计卡片组件
function StatCard({
  title,
  value,
  color,
  subtext,
}: {
  title: string;
  value: string | number;
  color: "blue" | "green" | "yellow" | "red";
  subtext: string;
}) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="text-sm text-gray-400 mb-2">{title}</div>
      <div className={`text-2xl font-bold mb-1 ${colorClasses[color]}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500">{subtext}</div>
    </div>
  );
}
