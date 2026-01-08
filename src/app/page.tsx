"use client";

import React, { useState } from "react";
import CryptoBacktestTool from "@/components/CryptoBacktestTool";
import BinanceAutoTrader from "@/components/BinanceAutoTrader";

type TabType = "backtest" | "trading";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("backtest");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">加密货币日内交易系统</h1>
          <p className="text-gray-400">基于15分钟趋势过滤 + 5分钟回调进场的短线交易策略</p>
        </header>

        {/* 标签页导航 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("backtest")}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              activeTab === "backtest"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            策略回测
          </button>
          <button
            onClick={() => setActiveTab("trading")}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              activeTab === "trading"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            自动交易
          </button>
        </div>

        {/* 内容区域 */}
        {activeTab === "backtest" ? <CryptoBacktestTool /> : <BinanceAutoTrader />}
      </div>
    </div>
  );
}
