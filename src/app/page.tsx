"use client";

import React, { useState } from "react";
import CryptoBacktestTool from "@/components/CryptoBacktestTool";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">加密货币日内交易策略回测工具</h1>
          <p className="text-gray-400">基于15分钟趋势过滤 + 5分钟回调进场的短线交易策略</p>
        </header>
        
        <CryptoBacktestTool />
      </div>
    </div>
  );
}
