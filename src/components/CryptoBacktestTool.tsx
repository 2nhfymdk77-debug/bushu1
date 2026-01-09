"use client";

import React, { useState } from "react";
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
  entryFee: number;
  exitFee: number;
  totalFee: number;
  netPnl: number;
  positionSize: number;
  quantity: number;
  leverage: number;
  reason: string;
}

interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  grossProfit: number;
  totalFees: number;
  netProfit: number;
  totalReturnRate: number;
  netReturnRate: number;
  annualizedReturn: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  trades: Trade[];
  initialCapital: number;
  finalCapital: number;
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
  initialCapital: number;
  maxPositionPercent: number;
  makerFee: number;
  takerFee: number;
  symbol: string;
  startDate: string;
  endDate: string;
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
  initialCapital: 10000,
  maxPositionPercent: 30,
  makerFee: 0.02,
  takerFee: 0.05,
  symbol: "BTCUSDT",
  startDate: "",
  endDate: "",
};

// 策略定义
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

export default function CryptoBacktestTool() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [params, setParams] = useState<StrategyParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [klines15m, setKlines15m] = useState<KLine[]>([]);
  const [klines5m, setKlines5m] = useState<KLine[]>([]);
  const [emaShort15m, setEmaShort15m] = useState<number[]>([]);
  const [emaLong15m, setEmaLong15m] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

  // 获取当前策略
  const currentStrategy = STRATEGIES.find(s => s.id === selectedStrategy);

  // 步骤1：选择策略
  if (step === 1) {
    return (
      <div className="animate-fadeIn">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">选择回测策略</h2>
          <p className="text-gray-400">选择一个策略开始回测</p>
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

        <div className="flex justify-end">
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
          <h2 className="text-2xl font-bold mb-2">配置回测参数</h2>
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

          {/* 交易与回测参数 */}
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
                <span className="text-xl mr-2">💸</span>
                交易成本 (币安普通用户)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">挂单费率 (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={params.makerFee}
                    onChange={(e) => setParams({ ...params, makerFee: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">吃单费率 (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={params.takerFee}
                    onChange={(e) => setParams({ ...params, takerFee: Number(e.target.value) })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <span className="text-xl mr-2">📅</span>
                回测范围
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">交易对</label>
                  <input
                    type="text"
                    value={params.symbol}
                    onChange={(e) => setParams({ ...params, symbol: e.target.value })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">开始日期</label>
                    <input
                      type="date"
                      value={params.startDate}
                      onChange={(e) => setParams({ ...params, startDate: e.target.value })}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">结束日期</label>
                    <input
                      type="date"
                      value={params.endDate}
                      onChange={(e) => setParams({ ...params, endDate: e.target.value })}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => {
              setParams(DEFAULT_PARAMS);
            }}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
          >
            重置参数
          </button>
          <button
            onClick={() => {
              setStep(3);
              runBacktest();
            }}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all"
          >
            🚀 开始回测
          </button>
        </div>
      </div>
    );
  }

  // 步骤3：显示结果
  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <button
          onClick={() => setStep(2)}
          className="text-gray-400 hover:text-white text-sm mb-2"
        >
          ← 返回配置参数
        </button>
        <h2 className="text-2xl font-bold mb-2">回测结果</h2>
        <p className="text-gray-400">策略：{currentStrategy?.name}</p>
      </div>

      {isLoading ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">回测进行中...</p>
        </div>
      ) : result ? (
        <div className="space-y-6">
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
              <p className="text-sm text-gray-400">净收益率</p>
              <p className={`text-2xl font-bold ${result.netReturnRate >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatNumber(result.netReturnRate)}%
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">最终资金</p>
              <p className="text-2xl font-bold">
                {formatNumber(result.finalCapital, 2)}
              </p>
            </div>
          </div>

          {/* K线图 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">K线图</h3>
            <CandlestickChart
              klines={klines15m}
              emaShort={emaShort15m}
              emaLong={emaLong15m}
              trades={result.trades}
              height={500}
            />
          </div>

          {/* 详细统计 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">详细统计</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-400">初始资金</p>
                <p className="font-semibold">{formatNumber(result.initialCapital, 2)} USDT</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">最终资金</p>
                <p className={`font-semibold ${result.finalCapital >= result.initialCapital ? "text-green-500" : "text-red-500"}`}>
                  {formatNumber(result.finalCapital, 2)} USDT
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">毛利润</p>
                <p className={`font-semibold ${result.grossProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatNumber(result.grossProfit)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">总手续费</p>
                <p className="text-yellow-500 font-semibold">{formatNumber(result.totalFees, 2)} USDT</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">净利润</p>
                <p className={`font-semibold ${result.netProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatNumber(result.netProfit, 2)} USDT
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">净收益率</p>
                <p className={`font-semibold ${result.netReturnRate >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatNumber(result.netReturnRate)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">年化收益率</p>
                <p className={`font-semibold ${result.annualizedReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatNumber(result.annualizedReturn)}%
                </p>
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
                      <th className="px-2 py-2 text-left whitespace-nowrap">序号</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">方向</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">仓位</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">杠杆</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">进场价</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">出场价</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">毛盈亏</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">手续费</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">净盈亏</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade, index) => (
                      <tr key={index} className="border-t border-gray-700 hover:bg-gray-700/50">
                        <td className="px-2 py-2">{index + 1}</td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${trade.direction === "long" ? "bg-green-600" : "bg-red-600"}`}>
                            {trade.direction === "long" ? "做多" : "做空"}
                          </span>
                        </td>
                        <td className="px-2 py-2">{formatNumber(trade.positionSize, 0)} USDT</td>
                        <td className="px-2 py-2">{trade.leverage}x</td>
                        <td className="px-2 py-2">{formatNumber(trade.entryPrice, 2)}</td>
                        <td className="px-2 py-2">{formatNumber(trade.exitPrice, 2)}</td>
                        <td className={`px-2 py-2 font-semibold ${trade.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatNumber(trade.pnl, 2)}%
                        </td>
                        <td className="px-2 py-2 text-yellow-500">
                          {formatNumber(trade.totalFee, 2)} USDT
                        </td>
                        <td className={`px-2 py-2 font-semibold ${trade.netPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatNumber(trade.netPnl, 2)} USDT
                        </td>
                        <td className="px-2 py-2">{trade.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                setResult(null);
                setStep(1);
              }}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all"
            >
              🔄 新建回测
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  // 回测逻辑函数
  function generateMockData() {
    const now = Date.now();
    const data15m: KLine[] = [];
    const data5m: KLine[] = [];

    let price = 50000;
    const volatility = 0.002;

    // 生成15分钟数据
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

    // 生成5分钟数据
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
  }

  function calculateEMA(data: KLine[], period: number): number[] {
    const ema: number[] = new Array(data.length).fill(0);
    const multiplier = 2 / (period + 1);

    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      sum += data[i].close;
    }
    ema[period - 1] = sum / Math.min(period, data.length);

    for (let i = 0; i < period - 1; i++) {
      ema[i] = ema[period - 1];
    }

    for (let i = period; i < data.length; i++) {
      ema[i] = (data[i].close - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  }

  function calculateRSI(data: KLine[], period: number): number[] {
    const rsi: number[] = new Array(data.length).fill(50);
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    if (gains.length < period) {
      return rsi;
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    let firstRSI: number;
    if (avgLoss === 0) {
      firstRSI = 100;
    } else {
      const rs = avgGain / avgLoss;
      firstRSI = 100 - 100 / (1 + rs);
    }
    rsi[period] = firstRSI;

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i + 1] = 100 - 100 / (1 + rs);
    }

    return rsi;
  }

  function calculateVolumeMA(data: KLine[], period: number): number[] {
    const ma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - period + 1);
      const slice = data.slice(start, i + 1);
      const avg = slice.reduce((sum, k) => sum + k.volume, 0) / slice.length;
      ma.push(avg);
    }
    return ma;
  }

  function getTrendDirection(index: number, emaShort: number[], emaLong: number[], volumeMA: number[]): "long" | "short" | "none" {
    if (index < params.emaLong) return "none";

    const emaS = emaShort[index];
    const emaL = emaLong[index];
    const close = klines15m[index].close;
    const volume = klines15m[index].volume;
    const volMA = volumeMA[index];

    const distance = Math.abs(emaS - emaL) / emaL * 100;
    if (distance < params.minTrendDistance) return "none";

    const bullish = emaS > emaL && close > emaS && volume >= volMA;
    if (bullish) {
      let valid = true;
      for (let i = 1; i <= 3 && index - i >= 0; i++) {
        if (klines15m[index - i].close < emaLong[index - i]) {
          valid = false;
          break;
        }
      }
      if (valid) return "long";
    }

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
  }

  function checkEntrySignal(index: number, trendDirection: "long" | "short", emaShort5m: number[], emaLong5m: number[], rsi5m: number[]): { signal: boolean, type: "long" | "short" } {
    if (index < params.emaLong + 10) return { signal: false, type: trendDirection };

    const current = klines5m[index];
    const prev = klines5m[index - 1];
    const prev2 = klines5m[index - 2];
    const emaS = emaShort5m[index];
    const emaL = emaLong5m[index];
    const rsi = rsi5m[index];
    const rsiPrev = rsi5m[index - 1];

    if (trendDirection === "long") {
      const touchedEma = prev.low <= emaS || prev.low <= emaL;
      const recovered = current.close > emaS;
      const rsiUp = rsi > rsiPrev && rsi < 70;
      const bullishCandle = current.close > current.open && current.close > prev.close;

      if (touchedEma && recovered && (rsiUp || bullishCandle)) {
        return { signal: true, type: "long" };
      }
    } else {
      const touchedEma = prev.high >= emaS || prev.high >= emaL;
      const brokeDown = current.close < emaS;
      const rsiDown = rsi < rsiPrev && rsi > 30;
      const bearishCandle = current.close < current.open && current.close < prev.close;

      if (touchedEma && brokeDown && (rsiDown || bearishCandle)) {
        return { signal: true, type: "short" };
      }
    }

    return { signal: false, type: trendDirection };
  }

  function runBacktest() {
    const { data15m, data5m } = generateMockData();

    setTimeout(() => {
      try {
        const emaShort15m = calculateEMA(klines15m, params.emaShort);
        const emaLong15m = calculateEMA(klines15m, params.emaLong);
        const volumeMA15m = calculateVolumeMA(klines15m, params.volumePeriod);
        const emaShort5m = calculateEMA(klines5m, params.emaShort);
        const emaLong5m = calculateEMA(klines5m, params.emaLong);
        const rsi5m = calculateRSI(klines5m, params.rsiPeriod);

        const trades: Trade[] = [];
        let inPosition = false;
        let currentPosition: Trade | null = null;

        const get15mIndex = (k5: number): number => {
          const time5 = klines5m[k5].timestamp;
          for (let i = 0; i < klines15m.length; i++) {
            if (klines15m[i].timestamp > time5) return i - 1;
          }
          return klines15m.length - 1;
        };

        for (let i = 1; i < klines5m.length; i++) {
          if (inPosition && currentPosition) {
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
              const entryPrice = currentPosition.entryPrice;
              const direction = currentPosition.direction;
              const leverage = params.leverage;

              const positionSize = params.initialCapital * (params.maxPositionPercent / 100);
              const quantity = positionSize / entryPrice;

              const grossPnl = direction === "long"
                ? (exitPrice - entryPrice) / entryPrice * 100 * leverage
                : (entryPrice - exitPrice) / entryPrice * 100 * leverage;

              const entryFee = positionSize * (params.takerFee / 100);
              const exitFee = positionSize * (params.takerFee / 100);
              const totalFee = entryFee + exitFee;

              const grossPnlUsdt = positionSize * (grossPnl / 100);
              const netPnlUsdt = grossPnlUsdt - totalFee;

              const netPnlPercent = (netPnlUsdt / positionSize) * 100;

              trades.push({
                ...currentPosition,
                exitTime: current.timestamp,
                exitPrice,
                pnl: grossPnl,
                pnlPercent: grossPnl,
                entryFee,
                exitFee,
                totalFee,
                netPnl: netPnlUsdt,
                positionSize,
                quantity,
                leverage,
                reason: exitReason,
              });

              inPosition = false;
              currentPosition = null;
            }
            continue;
          }

          const index15m = get15mIndex(i);
          if (index15m < 0) continue;

          const trendDirection = getTrendDirection(index15m, emaShort15m, emaLong15m, volumeMA15m);

          if (trendDirection === "none") continue;

          const { signal, type } = checkEntrySignal(i, trendDirection, emaShort5m, emaLong5m, rsi5m);

          if (signal) {
            const current = klines5m[i];
            const entryPrice = current.close;
            const stopLoss = type === "long"
              ? Math.min(current.low, klines5m[i - 1].low) * (1 - params.stopLossPercent / 100)
              : Math.max(current.high, klines5m[i - 1].high) * (1 + params.stopLossPercent / 100);

            const riskAmount = Math.abs(entryPrice - stopLoss) / entryPrice * 100;
            const takeProfit1 = type === "long"
              ? entryPrice * (1 + riskAmount * params.riskReward1 / 100)
              : entryPrice * (1 - riskAmount * params.riskReward1 / 100);
            const takeProfit2 = type === "long"
              ? entryPrice * (1 + riskAmount * params.riskReward2 / 100)
              : entryPrice * (1 - riskAmount * params.riskReward2 / 100);

            const positionSize = params.initialCapital * (params.maxPositionPercent / 100);
            const quantity = positionSize / entryPrice;

            currentPosition = {
              entryTime: current.timestamp,
              exitTime: 0,
              direction: type,
              entryPrice,
              exitPrice: 0,
              stopLoss,
              takeProfit1,
              takeProfit2,
              pnl: 0,
              pnlPercent: 0,
              entryFee: 0,
              exitFee: 0,
              totalFee: 0,
              netPnl: 0,
              positionSize,
              quantity,
              leverage: params.leverage,
              reason: "进场",
            };

            inPosition = true;
          }
        }

        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);

        const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

        const grossProfit = totalProfit - totalLoss;

        const totalFees = trades.reduce((sum, t) => sum + t.totalFee, 0);

        const netProfitUsdt = trades.reduce((sum, t) => sum + t.netPnl, 0);

        const netReturnRate = (netProfitUsdt / params.initialCapital) * 100;

        let maxDrawdown = 0;
        let peak = 0;
        let cumulative = 0;
        trades.forEach(t => {
          cumulative += t.netPnl;
          peak = Math.max(peak, cumulative);
          maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
        });

        const totalReturnRate = netReturnRate;

        let annualizedReturn = 0;
        if (trades.length > 0) {
          const firstEntryTime = trades[0].entryTime;
          const lastExitTime = trades[trades.length - 1].exitTime;
          const tradingDays = (lastExitTime - firstEntryTime) / (1000 * 60 * 60 * 24);
          if (tradingDays > 0) {
            const years = tradingDays / 365;
            const finalValue = 1 + totalReturnRate / 100;
            annualizedReturn = (Math.pow(finalValue, 1 / years) - 1) * 100;
          }
        }

        const finalCapital = params.initialCapital + netProfitUsdt;

        setEmaShort15m(emaShort15m);
        setEmaLong15m(emaLong15m);

        setResult({
          totalTrades: trades.length,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
          winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
          totalProfit,
          totalLoss,
          grossProfit,
          totalFees,
          netProfit: netProfitUsdt,
          totalReturnRate,
          netReturnRate,
          annualizedReturn,
          avgWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
          avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
          profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
          maxDrawdown: (maxDrawdown / params.initialCapital) * 100,
          trades,
          initialCapital: params.initialCapital,
          finalCapital,
        });
      } catch (error) {
        console.error("回测出错:", error);
        alert("回测过程中发生错误，请检查数据");
      } finally {
        setIsLoading(false);
      }
    }, 100);
  }

  function formatNumber(num: number, decimals: number = 2) {
    return num.toFixed(decimals);
  }
}
