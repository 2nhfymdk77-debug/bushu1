"use client";

import React, { useState, useRef, useEffect } from "react";
import CandlestickChart from "./CandlestickChart";

// 类型定义
interface KLine {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  entryTime: number;
  exitTime: number;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  pnl: number;
  pnlPercent: number;
  reason: string;
}

interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  trades: Trade[];
}

export interface StrategyParams {
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
}

export const DEFAULT_PARAMS: StrategyParams = {
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
};

export default function CryptoBacktestTool() {
  const [params, setParams] = useState<StrategyParams>(DEFAULT_PARAMS);
  const [klines15m, setKlines15m] = useState<KLine[]>([]);
  const [klines5m, setKlines5m] = useState<KLine[]>([]);
  const [emaShort15m, setEmaShort15m] = useState<number[]>([]);
  const [emaLong15m, setEmaLong15m] = useState<number[]>([]);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

  // 生成模拟数据
  const generateMockData = () => {
    const now = Date.now();
    const data15m: KLine[] = [];
    const data5m: KLine[] = [];
    
    let price = 50000;
    const volatility = 0.002;
    
    // 生成15分钟数据（30天）
    for (let i = 0; i < 2880; i++) {
      const time = now - (2880 - i) * 15 * 60 * 1000;
      const change = (Math.random() - 0.48) * 2 * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * price;
      const low = Math.min(open, close) - Math.random() * volatility * price;
      const volume = Math.random() * 1000000000 + 500000000;
      
      data15m.push({ timestamp: time, open, high, low, close, volume });
      price = close;
    }
    
    // 生成5分钟数据（与15分钟对应）
    price = data15m[0].open;
    for (let i = 0; i < 8640; i++) {
      const time = now - (8640 - i) * 5 * 60 * 1000;
      const change = (Math.random() - 0.48) * 2 * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
      const volume = Math.random() * 300000000 + 150000000;
      
      data5m.push({ timestamp: time, open, high, low, close, volume });
      price = close;
    }
    
    setKlines15m(data15m);
    setKlines5m(data5m);
    return { data15m, data5m };
  };

  // 计算EMA
  const calculateEMA = (data: KLine[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // 第一个EMA值使用SMA
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      sum += data[i].close;
    }
    ema.push(sum / Math.min(period, data.length));
    
    // 后续EMA值
    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i].close - ema[i - period]) * multiplier + ema[i - period];
      ema.push(currentEMA);
    }
    
    // 填充前面的值
    for (let i = 0; i < period - 1 && ema.length < data.length; i++) {
      ema.unshift(ema[0]);
    }
    
    return ema;
  };

  // 计算RSI
  const calculateRSI = (data: KLine[], period: number): number[] => {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // 初始平均
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = 0; i < period - 1; i++) {
      rsi.push(50);
    }
    
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
    
    return rsi;
  };

  // 计算成交量均值
  const calculateVolumeMA = (data: KLine[], period: number): number[] => {
    const ma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - period + 1);
      const slice = data.slice(start, i + 1);
      const avg = slice.reduce((sum, k) => sum + k.volume, 0) / slice.length;
      ma.push(avg);
    }
    return ma;
  };

  // 15分钟趋势判断
  const getTrendDirection = (index: number, emaShort: number[], emaLong: number[], volumeMA: number[]): "long" | "short" | "none" => {
    if (index < params.emaLong) return "none";
    
    const emaS = emaShort[index];
    const emaL = emaLong[index];
    const close = klines15m[index].close;
    const volume = klines15m[index].volume;
    const volMA = volumeMA[index];
    
    // 检查趋势距离
    const distance = Math.abs(emaS - emaL) / emaL * 100;
    if (distance < params.minTrendDistance) return "none";
    
    // 多头条件
    const bullish = emaS > emaL && close > emaS && volume >= volMA;
    if (bullish) {
      // 检查最近3根K线是否跌破EMA60
      let valid = true;
      for (let i = 1; i <= 3 && index - i >= 0; i++) {
        if (klines15m[index - i].close < emaLong[index - i]) {
          valid = false;
          break;
        }
      }
      if (valid) return "long";
    }
    
    // 空头条件
    const bearish = emaS < emaL && close < emaS && volume >= volMA;
    if (bearish) {
      let valid = true;
      for (let i = 1; i <= 3 && index - i >= 0; i++) {
        if (klines15m[index - i].close > emaLong[index - i]) {
          valid = false;
          break;
        }
      }
      if (valid) return "short";
    }
    
    return "none";
  };

  // 5分钟进场逻辑
  const checkEntrySignal = (index: number, trendDirection: "long" | "short", emaShort5m: number[], emaLong5m: number[], rsi5m: number[]): { signal: boolean, type: "long" | "short" } => {
    if (index < params.emaLong + 10) return { signal: false, type: trendDirection };
    
    const current = klines5m[index];
    const prev = klines5m[index - 1];
    const prev2 = klines5m[index - 2];
    const emaS = emaShort5m[index];
    const emaL = emaLong5m[index];
    const rsi = rsi5m[index];
    const rsiPrev = rsi5m[index - 1];
    
    if (trendDirection === "long") {
      // 做多条件：价格回踩EMA20或EMA60后重新站上
      const touchedEma = prev.low <= emaS || prev.low <= emaL;
      const recovered = current.close > emaS;
      const rsiUp = rsi > rsiPrev && rsi < 70;
      const bullishCandle = current.close > current.open && current.close > prev.close;
      
      if (touchedEma && recovered && (rsiUp || bullishCandle)) {
        return { signal: true, type: "long" };
      }
    } else {
      // 做空条件：价格反弹EMA20或EMA60后重新跌破
      const touchedEma = prev.high >= emaS || prev.high >= emaL;
      const brokeDown = current.close < emaS;
      const rsiDown = rsi < rsiPrev && rsi > 30;
      const bearishCandle = current.close < current.open && current.close < prev.close;
      
      if (touchedEma && brokeDown && (rsiDown || bearishCandle)) {
        return { signal: true, type: "short" };
      }
    }
    
    return { signal: false, type: trendDirection };
  };

  // 运行回测
  const runBacktest = () => {
    if (klines15m.length === 0 || klines5m.length === 0) {
      alert("请先生成或导入数据");
      return;
    }
    
    setIsLoading(true);
    setResult(null);
    
    setTimeout(() => {
      try {
        // 计算指标
        const emaShort15m = calculateEMA(klines15m, params.emaShort);
        const emaLong15m = calculateEMA(klines15m, params.emaLong);
        const volumeMA15m = calculateVolumeMA(klines15m, params.volumePeriod);
        const emaShort5m = calculateEMA(klines5m, params.emaShort);
        const emaLong5m = calculateEMA(klines5m, params.emaLong);
        const rsi5m = calculateRSI(klines5m, params.rsiPeriod);
        
        const trades: Trade[] = [];
        let inPosition = false;
        let currentPosition: Trade | null = null;
        
        // 找到5分钟K线对应的15分钟趋势
        const get15mIndex = (k5: number): number => {
          const time5 = klines5m[k5].timestamp;
          for (let i = 0; i < klines15m.length; i++) {
            if (klines15m[i].timestamp > time5) return i - 1;
          }
          return klines15m.length - 1;
        };
        
        // 遍历5分钟K线
        for (let i = 1; i < klines5m.length; i++) {
          if (inPosition && currentPosition) {
            // 检查止损止盈
            const current = klines5m[i];
            const { stopLoss, takeProfit1, takeProfit2, direction } = currentPosition;
            
            let exitPrice = null;
            let exitReason = "";
            
            if (direction === "long") {
              if (current.low <= stopLoss) {
                exitPrice = stopLoss;
                exitReason = "止损";
              } else if (current.high >= takeProfit2) {
                exitPrice = takeProfit2;
                exitReason = "止盈2R";
              } else if (current.high >= takeProfit1) {
                // 移动止损到进场价
                currentPosition.stopLoss = currentPosition.entryPrice;
                if (current.low <= currentPosition.stopLoss) {
                  exitPrice = currentPosition.stopLoss;
                  exitReason = "移动止损";
                }
              }
            } else {
              if (current.high >= stopLoss) {
                exitPrice = stopLoss;
                exitReason = "止损";
              } else if (current.low <= takeProfit2) {
                exitPrice = takeProfit2;
                exitReason = "止盈2R";
              } else if (current.low <= takeProfit1) {
                currentPosition.stopLoss = currentPosition.entryPrice;
                if (current.high >= currentPosition.stopLoss) {
                  exitPrice = currentPosition.stopLoss;
                  exitReason = "移动止损";
                }
              }
            }
            
            if (exitPrice) {
              const pnl = direction === "long"
                ? (exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice * 100 * params.leverage
                : (currentPosition.entryPrice - exitPrice) / currentPosition.entryPrice * 100 * params.leverage;
              
              trades.push({
                ...currentPosition,
                exitTime: current.timestamp,
                exitPrice,
                pnl,
                pnlPercent: pnl,
                reason: exitReason,
              });
              
              inPosition = false;
              currentPosition = null;
            }
            continue;
          }
          
          // 获取15分钟趋势方向
          const index15m = get15mIndex(i);
          if (index15m < 0) continue;
          
          const trendDirection = getTrendDirection(index15m, emaShort15m, emaLong15m, volumeMA15m);
          
          if (trendDirection === "none") continue;
          
          // 检查5分钟进场信号
          const { signal, type } = checkEntrySignal(i, trendDirection, emaShort5m, emaLong5m, rsi5m);
          
          if (signal) {
            const current = klines5m[i];
            const stopLoss = type === "long"
              ? Math.min(current.low, klines5m[i - 1].low) * (1 - params.stopLossPercent / 100)
              : Math.max(current.high, klines5m[i - 1].high) * (1 + params.stopLossPercent / 100);
            
            const riskAmount = Math.abs(current.close - stopLoss) / current.close * 100;
            const takeProfit1 = type === "long"
              ? current.close * (1 + riskAmount * params.riskReward1 / 100)
              : current.close * (1 - riskAmount * params.riskReward1 / 100);
            const takeProfit2 = type === "long"
              ? current.close * (1 + riskAmount * params.riskReward2 / 100)
              : current.close * (1 - riskAmount * params.riskReward2 / 100);
            
            currentPosition = {
              entryTime: current.timestamp,
              exitTime: 0,
              direction: type,
              entryPrice: current.close,
              exitPrice: 0,
              stopLoss,
              takeProfit1,
              takeProfit2,
              pnl: 0,
              pnlPercent: 0,
              reason: "进场",
            };
            
            inPosition = true;
          }
        }
        
        // 统计结果
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);
        
        const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        
        let maxDrawdown = 0;
        let peak = 0;
        let cumulative = 0;
        trades.forEach(t => {
          cumulative += t.pnlPercent;
          peak = Math.max(peak, cumulative);
          maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
        });
        
        // 保存EMA数据用于图表展示
        setEmaShort15m(emaShort15m);
        setEmaLong15m(emaLong15m);
        
        setResult({
          totalTrades: trades.length,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
          winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
          totalProfit,
          totalLoss,
          netProfit: totalProfit - totalLoss,
          avgWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
          avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
          profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
          maxDrawdown,
          trades,
        });
      } catch (error) {
        console.error("回测出错:", error);
        alert("回测过程中发生错误，请检查数据");
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN");
  };

  // 格式化数字
  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 参数配置区 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">参数配置</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">EMA短期周期</label>
            <input
              type="number"
              value={params.emaShort}
              onChange={(e) => setParams({ ...params, emaShort: Number(e.target.value) })}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">EMA长期周期</label>
            <input
              type="number"
              value={params.emaLong}
              onChange={(e) => setParams({ ...params, emaLong: Number(e.target.value) })}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">RSI周期</label>
            <input
              type="number"
              value={params.rsiPeriod}
              onChange={(e) => setParams({ ...params, rsiPeriod: Number(e.target.value) })}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          
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
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">杠杆倍数</label>
            <input
              type="number"
              value={params.leverage}
              onChange={(e) => setParams({ ...params, leverage: Number(e.target.value) })}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          
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
        </div>
        
        <div className="mt-6 space-y-3">
          <button
            onClick={generateMockData}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition"
          >
            生成模拟数据
          </button>
          
          <button
            onClick={runBacktest}
            disabled={isLoading || klines15m.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 rounded transition"
          >
            {isLoading ? "回测中..." : "运行回测"}
          </button>
          
          <button
            onClick={() => setParams(DEFAULT_PARAMS)}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 rounded transition"
          >
            重置参数
          </button>
        </div>
        
        <div className="mt-4 text-sm text-gray-400">
          <p>数据状态: {klines15m.length > 0 ? `已加载 (${klines15m.length}根15分钟K线)` : "未加载"}</p>
        </div>
      </div>
      
      {/* 结果展示区 */}
      <div className="lg:col-span-2 space-y-6">
        {result && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400">总交易次数</p>
                <p className="text-2xl font-bold">{result.totalTrades}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400">胜率</p>
                <p className={`text-2xl font-bold ${result.winRate >= 50 ? "text-green-500" : "text-red-500"}`}>
                  {formatNumber(result.winRate)}%
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400">净利润</p>
                <p className={`text-2xl font-bold ${result.netProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatNumber(result.netProfit)}%
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400">盈亏比</p>
                <p className="text-2xl font-bold">
                  {result.profitFactor === Infinity ? "∞" : formatNumber(result.profitFactor)}
                </p>
              </div>
            </div>
            
            {/* K线图展示 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">15分钟K线图 (含EMA指标和交易信号)</h3>
              <CandlestickChart
                klines={klines15m}
                emaShort={emaShort15m}
                emaLong={emaLong15m}
                trades={result.trades}
                height={500}
              />
              <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-blue-500"></div>
                  <span className="text-gray-400">EMA{params.emaShort}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-yellow-500"></div>
                  <span className="text-gray-400">EMA{params.emaLong}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-green-500"></div>
                  <span className="text-gray-400">做多进场/盈利</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-red-500"></div>
                  <span className="text-gray-400">做空进场/亏损</span>
                </div>
              </div>
            </div>
            
            {/* 详细统计 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">详细统计</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-400">盈利交易</p>
                  <p className="text-green-500 font-semibold">{result.winningTrades} 笔</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">亏损交易</p>
                  <p className="text-red-500 font-semibold">{result.losingTrades} 笔</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">总盈利</p>
                  <p className="text-green-500 font-semibold">{formatNumber(result.totalProfit)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">总亏损</p>
                  <p className="text-red-500 font-semibold">{formatNumber(result.totalLoss)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">平均盈利</p>
                  <p className="text-green-500 font-semibold">{formatNumber(result.avgWin)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">平均亏损</p>
                  <p className="text-red-500 font-semibold">{formatNumber(result.avgLoss)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">最大回撤</p>
                  <p className="text-yellow-500 font-semibold">{formatNumber(result.maxDrawdown)}%</p>
                </div>
              </div>
            </div>
            
            {/* 交易明细 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">交易明细</h3>
                <button
                  onClick={() => setShowTrades(!showTrades)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {showTrades ? "收起" : "展开"}
                </button>
              </div>
              
              {showTrades && (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">序号</th>
                        <th className="px-3 py-2 text-left">方向</th>
                        <th className="px-3 py-2 text-left">进场价格</th>
                        <th className="px-3 py-2 text-left">出场价格</th>
                        <th className="px-3 py-2 text-left">止损</th>
                        <th className="px-3 py-2 text-left">止盈</th>
                        <th className="px-3 py-2 text-left">盈亏</th>
                        <th className="px-3 py-2 text-left">原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((trade, index) => (
                        <tr key={index} className="border-t border-gray-700 hover:bg-gray-700/50">
                          <td className="px-3 py-2">{index + 1}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${trade.direction === "long" ? "bg-green-600" : "bg-red-600"}`}>
                              {trade.direction === "long" ? "做多" : "做空"}
                            </span>
                          </td>
                          <td className="px-3 py-2">{formatNumber(trade.entryPrice, 2)}</td>
                          <td className="px-3 py-2">{formatNumber(trade.exitPrice, 2)}</td>
                          <td className="px-3 py-2">{formatNumber(trade.stopLoss, 2)}</td>
                          <td className="px-3 py-2">{formatNumber(trade.takeProfit2, 2)}</td>
                          <td className={`px-3 py-2 font-semibold ${trade.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {formatNumber(trade.pnl, 2)}%
                          </td>
                          <td className="px-3 py-2">{trade.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        
        {!result && klines15m.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">开始使用回测工具</p>
            <ol className="text-left text-gray-300 space-y-2 max-w-md mx-auto">
              <li>1. 调整左侧策略参数（或使用默认值）</li>
              <li>2. 点击"生成模拟数据"加载测试数据</li>
              <li>3. 点击"运行回测"开始策略回测</li>
              <li>4. 查看回测结果和交易明细</li>
            </ol>
          </div>
        )}
        
        {!result && klines15m.length > 0 && !isLoading && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-400">数据已加载，点击"运行回测"开始分析</p>
          </div>
        )}
      </div>
    </div>
  );
}
