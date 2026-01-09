"use client";

import React, { useState } from "react";
import CryptoBacktestTool from "@/components/CryptoBacktestTool";
import BinanceAutoTrader from "@/components/BinanceAutoTrader";

type TabType = "backtest" | "trading";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("backtest");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-4 md:py-8">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">加密货币日内交易系统</h1>
          <p className="text-gray-400 text-sm md:text-base">基于15分钟趋势过滤 + 5分钟回调进场的短线交易策略</p>
        </header>

        {/* 标签页导航 - 移动端使用底部导航 */}
        <nav className="mb-6">
          {/* 桌面端：顶部标签页 */}
          <div className="hidden md:flex gap-4">
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

          {/* 移动端：底部固定导航 */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-2 z-50">
            <div className="flex justify-around">
              <button
                onClick={() => setActiveTab("backtest")}
                className={`flex flex-col items-center py-2 px-4 rounded-lg transition ${
                  activeTab === "backtest"
                    ? "text-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xs">回测</span>
              </button>
              <button
                onClick={() => setActiveTab("trading")}
                className={`flex flex-col items-center py-2 px-4 rounded-lg transition ${
                  activeTab === "trading"
                    ? "text-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-xs">交易</span>
              </button>
            </div>
          </div>
        </nav>

        {/* 内容区域 - 移动端底部留出导航栏空间 */}
        <div className="md:pb-0 pb-20">
          {activeTab === "backtest" ? <CryptoBacktestTool /> : <BinanceAutoTrader />}
        </div>
      </div>
    </div>
  );
}
