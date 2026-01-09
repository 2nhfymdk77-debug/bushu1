"use client";

import React, { useState } from "react";
import CandlestickChart from "./CandlestickChart";
import { SMCLiquidityFVGStrategy, SMCLiquidityFVGParams } from "../strategies/SMCLiquidityFVGStrategy";
import { alignTimeframes, getMainBars, getMidBars, getLowBars, isMainBarUpdated } from "../utils/timeframeAligner";
import { LiquidityFVGTracker } from "../utils/liquidityFVGTracker";

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
  // SMC 策略参数
  mainTimeframe?: string;
  midTimeframe?: string;
  lowTimeframe?: string;
  liquidityLookback?: number;
  liquidityTolerance?: number;
  displacementThreshold?: number;
  displacementMinBars?: number;
  fvgMinSize?: number;
  fvgMaxSize?: number;
  entryFVGPercent?: number;
  stopLossBuffer?: number;
  takeProfitTP1?: number;
  takeProfitTP2?: number;
  riskPercent?: number;
  maxConsecutiveLosses?: number;
  cooldownBars?: number;
  minVolumeRatio?: number;
  filterSideways?: boolean;
  adxThreshold?: number;

  // 通用参数
  initialCapital: number;
  maxPositionPercent: number;
  makerFee: number;
  takerFee: number;
  symbol: string;
  startDate: string;
  endDate: string;
}

export const DEFAULT_PARAMS: StrategyParams = {
  mainTimeframe: "15m",
  midTimeframe: "5m",
  lowTimeframe: "1m",
  liquidityLookback: 20,
  liquidityTolerance: 0.05,
  displacementThreshold: 1.5,
  displacementMinBars: 3,
  fvgMinSize: 0.01,
  fvgMaxSize: 0.5,
  entryFVGPercent: 0.5,
  stopLossBuffer: 0.01,
  takeProfitTP1: 0.8,
  takeProfitTP2: 1.5,
  riskPercent: 1,
  maxConsecutiveLosses: 3,
  cooldownBars: 20,
  minVolumeRatio: 1.2,
  filterSideways: true,
  adxThreshold: 20,
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
    id: "smc_liquidity_fvg",
    name: "SMC 流动性 + FVG",
    description: "基于 ICT/SMC 理论的智能资金策略。识别流动性扫荡、确认机构位移，通过 FVG 回踩进行低风险入场。",
    icon: "💧",
    params: ["mainTimeframe", "midTimeframe", "lowTimeframe", "liquidityLookback", "liquidityTolerance", "displacementThreshold", "displacementMinBars", "fvgMinSize", "fvgMaxSize", "entryFVGPercent", "stopLossBuffer", "takeProfitTP1", "takeProfitTP2", "riskPercent", "minVolumeRatio", "filterSideways"]
  }
];

export default function CryptoBacktestTool() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const strategy = new SMCLiquidityFVGStrategy();
  const strategyDefaultParams = strategy.getDefaultParams();

  const [params, setParams] = useState<StrategyParams>({
    ...DEFAULT_PARAMS,
    ...strategyDefaultParams,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [klines15m, setKlines15m] = useState<KLine[]>([]);
  const [klines5m, setKlines5m] = useState<KLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

  // 获取当前策略
  const currentStrategy = STRATEGIES.find(s => s.id === selectedStrategy);

  // 步骤1：策略信息展示
  if (step === 1) {
    return (
      <div className="animate-fadeIn">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">SMC 流动性 + FVG 回测策略</h2>
          <p className="text-gray-400">基于 ICT/SMC 理论的智能资金策略。识别流动性扫荡、确认机构位移，通过 FVG 回踩进行低风险入场。</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="text-4xl mb-4">💧</div>
            <div className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-sm">
              高风险
            </div>
          </div>
          <h3 className="text-lg font-bold mb-2">{STRATEGIES[0].name}</h3>
          <p className="text-sm text-gray-400 mb-4">{STRATEGIES[0].description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-400">版本</div>
              <div className="font-medium">1.0.0</div>
            </div>
            <div>
              <div className="text-gray-400">分类</div>
              <div className="font-medium">Smart Money Concepts</div>
            </div>
            <div>
              <div className="text-gray-400">支持周期</div>
              <div className="font-medium">1m, 5m, 15m</div>
            </div>
            <div>
              <div className="text-gray-400">风险等级</div>
              <div className="font-medium text-red-400">高</div>
            </div>
          </div>
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
              {/* SMC 策略参数 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">主周期（流动性识别）</label>
                <select
                  value={params.mainTimeframe || "15m"}
                  onChange={(e) => setParams({ ...params, mainTimeframe: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="5m">5 分钟</option>
                  <option value="15m">15 分钟</option>
                  <option value="30m">30 分钟</option>
                  <option value="1h">1 小时</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">中周期（位移确认）</label>
                <select
                  value={params.midTimeframe || "5m"}
                  onChange={(e) => setParams({ ...params, midTimeframe: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="1m">1 分钟</option>
                  <option value="5m">5 分钟</option>
                  <option value="15m">15 分钟</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">低周期（入场）</label>
                <select
                  value={params.lowTimeframe || "1m"}
                  onChange={(e) => setParams({ ...params, lowTimeframe: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="1m">1 分钟</option>
                  <option value="5m">5 分钟</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">流动性回看周期</label>
                <input
                  type="number"
                  value={params.liquidityLookback || 20}
                  onChange={(e) => setParams({ ...params, liquidityLookback: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">流动性容差 (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={params.liquidityTolerance || 0.05}
                  onChange={(e) => setParams({ ...params, liquidityTolerance: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">位移阈值 (ATR倍数)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.displacementThreshold || 1.5}
                  onChange={(e) => setParams({ ...params, displacementThreshold: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">最少连续K线数</label>
                <input
                  type="number"
                  value={params.displacementMinBars || 3}
                  onChange={(e) => setParams({ ...params, displacementMinBars: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">FVG 最小大小 (%)</label>
                <input
                  type="number"
                  step="0.005"
                  value={params.fvgMinSize || 0.01}
                  onChange={(e) => setParams({ ...params, fvgMinSize: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">FVG 最大大小 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.fvgMaxSize || 0.5}
                  onChange={(e) => setParams({ ...params, fvgMaxSize: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">入场位置 (FVG %)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.entryFVGPercent || 0.5}
                  onChange={(e) => setParams({ ...params, entryFVGPercent: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">止损缓冲 (%)</label>
                <input
                  type="number"
                  step="0.005"
                  value={params.stopLossBuffer || 0.01}
                  onChange={(e) => setParams({ ...params, stopLossBuffer: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">第一目标 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.takeProfitTP1 || 0.8}
                  onChange={(e) => setParams({ ...params, takeProfitTP1: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">第二目标 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.takeProfitTP2 || 1.5}
                  onChange={(e) => setParams({ ...params, takeProfitTP2: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">最小成交量比</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.minVolumeRatio || 1.2}
                  onChange={(e) => setParams({ ...params, minVolumeRatio: Number(e.target.value) })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="filterSideways"
                  checked={params.filterSideways !== undefined ? params.filterSideways : true}
                  onChange={(e) => setParams({ ...params, filterSideways: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="filterSideways" className="ml-2 text-sm text-gray-400">
                  过滤震荡市
                </label>
              </div>
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
              emaShort={[]}
              emaLong={[]}
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

  // 生成 SMC 策略用的多时间框架数据
  function generateMockDataSMC() {
    const now = Date.now();
    const data15m: KLine[] = [];
    const data5m: KLine[] = [];
    const data1m: KLine[] = [];

    let price = 50000;
    const volatility = 0.002;

    // 生成15分钟数据
    for (let i = 0; i < 960; i++) {  // 10天
      const time = now - (960 - i) * 15 * 60 * 1000;
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
    for (let i = 0; i < 2880; i++) {
      const time = now - (2880 - i) * 5 * 60 * 1000;
      const change = (Math.random() - 0.48) * 2 * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
      const volume = Math.random() * 300000000 + 150000000;

      data5m.push({ timestamp: time, open, high, low, close, volume });
      price = close;
    }

    // 生成1分钟数据
    price = data15m[0].open;
    for (let i = 0; i < 14400; i++) {
      const time = now - (14400 - i) * 1 * 60 * 1000;
      const change = (Math.random() - 0.48) * 2 * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * price * 0.3;
      const low = Math.min(open, close) - Math.random() * volatility * price * 0.3;
      const volume = Math.random() * 100000000 + 50000000;

      data1m.push({ timestamp: time, open, high, low, close, volume });
      price = close;
    }

    setKlines15m(data15m);
    setKlines5m(data5m);
    return { data15m, data5m, data1m };
  }

  // SMC 策略回测逻辑
  function runSMCBacktest(data15m: KLine[], data5m: KLine[], data1m: KLine[]): Trade[] {
    const smcStrategy = new SMCLiquidityFVGStrategy();

    // 转换数据格式
    const klineData15m: any[] = data15m.map(k => ({
      timestamp: k.timestamp,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }));
    const klineData5m: any[] = data5m.map(k => ({
      timestamp: k.timestamp,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }));
    const klineData1m: any[] = data1m.map(k => ({
      timestamp: k.timestamp,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }));

    // 对齐多时间框架
    const aligned = alignTimeframes(
      klineData15m,
      klineData5m,
      klineData1m,
      params.mainTimeframe || "15m",
      params.midTimeframe || "5m",
      params.lowTimeframe || "1m"
    );

    const trades: Trade[] = [];
    const tracker = new LiquidityFVGTracker();
    let inPosition = false;
    let currentPosition: Trade | null = null;

    const smcParams: SMCLiquidityFVGParams = {
      mainTimeframe: params.mainTimeframe || "15m",
      midTimeframe: params.midTimeframe || "5m",
      lowTimeframe: params.lowTimeframe || "1m",
      liquidityLookback: params.liquidityLookback || 20,
      liquidityTolerance: params.liquidityTolerance || 0.05,
      displacementThreshold: params.displacementThreshold || 1.5,
      displacementMinBars: params.displacementMinBars || 3,
      fvgMinSize: params.fvgMinSize || 0.01,
      fvgMaxSize: params.fvgMaxSize || 0.5,
      entryFVGPercent: params.entryFVGPercent || 0.5,
      stopLossBuffer: params.stopLossBuffer || 0.01,
      takeProfitTP1: params.takeProfitTP1 || 0.8,
      takeProfitTP2: params.takeProfitTP2 || 1.5,
      riskPercent: params.riskPercent || 1,
      maxConsecutiveLosses: params.maxConsecutiveLosses || 3,
      cooldownBars: params.cooldownBars || 20,
      minVolumeRatio: params.minVolumeRatio || 1.2,
      filterSideways: params.filterSideways !== undefined ? params.filterSideways : true,
      adxThreshold: params.adxThreshold || 20,
    };

    // 处理所有K线
    tracker.process(
      klineData15m,
      smcParams.liquidityLookback,
      smcParams.liquidityTolerance
    );

    // 使用策略检测历史信号
    const signals = smcStrategy.detectHistoricalSignals(klineData15m, smcParams);

    for (const signalData of signals) {
      const { signal, startIndex } = signalData;

      // 检查是否可以入场
      const canEnter = smcStrategy.checkBacktestEntry(
        klineData15m,
        startIndex,
        signal,
        smcParams
      );

      if (canEnter) {
        const exitResult = smcStrategy.calculateBacktestExit(
          signal.entryPrice,
          signal.direction,
          klineData15m,
          startIndex,
          smcParams
        );

        const direction = signal.direction;
        const positionSize = params.initialCapital * (params.maxPositionPercent / 100);
        const quantity = positionSize / signal.entryPrice;

        const grossPnl = direction === "long"
          ? (exitResult.exitPrice - signal.entryPrice) / signal.entryPrice * 100
          : (signal.entryPrice - exitResult.exitPrice) / signal.entryPrice * 100;

        const entryFee = positionSize * (params.takerFee / 100);
        const exitFee = positionSize * (params.takerFee / 100);
        const totalFee = entryFee + exitFee;

        const grossPnlUsdt = positionSize * (grossPnl / 100);
        const netPnlUsdt = grossPnlUsdt - totalFee;

        trades.push({
          entryTime: signal.time,
          exitTime: klineData15m[exitResult.exitIndex].timestamp,
          direction,
          entryPrice: signal.entryPrice,
          exitPrice: exitResult.exitPrice,
          stopLoss: direction === "long"
            ? signal.entryPrice * (1 - smcParams.stopLossBuffer)
            : signal.entryPrice * (1 + smcParams.stopLossBuffer),
          takeProfit1: direction === "long"
            ? signal.entryPrice * (1 + smcParams.takeProfitTP1 / 100)
            : signal.entryPrice * (1 - smcParams.takeProfitTP1 / 100),
          takeProfit2: direction === "long"
            ? signal.entryPrice * (1 + smcParams.takeProfitTP2 / 100)
            : signal.entryPrice * (1 - smcParams.takeProfitTP2 / 100),
          pnl: grossPnl,
          pnlPercent: grossPnl,
          entryFee,
          exitFee,
          totalFee,
          netPnl: netPnlUsdt,
          positionSize,
          quantity,
          leverage: 1,
          reason: exitResult.exitType === "stop_loss" ? "止损" : exitResult.exitType === "take_profit" ? "止盈" : "超时",
        });
      }
    }

    return trades;
  }

  // 主回测函数
  function runBacktest() {
    setIsLoading(true);
    setResult(null);

    // 生成 SMC 策略用的数据
    const generated = generateMockDataSMC();
    const data15m = generated.data15m;
    const data5m = generated.data5m;
    const data1m = generated.data1m;

    setTimeout(() => {
      try {
        // 执行 SMC 策略回测
        const trades = runSMCBacktest(data15m, data5m, data1m);

        // 计算统计结果
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
        alert(`回测过程中发生错误: ${error instanceof Error ? error.message : String(error)}\n请检查控制台获取详细信息`);
      } finally {
        setIsLoading(false);
      }
    }, 100);
  }

  function formatNumber(num: number, decimals: number = 2) {
    return num.toFixed(decimals);
  }
}
