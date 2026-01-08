"use client";

import React, { useState, useEffect, useRef } from "react";
import CryptoBacktestTool, { StrategyParams, DEFAULT_PARAMS } from "./CryptoBacktestTool";

// 类型定义
interface KLineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FuturesSymbol {
  symbol: string;
  contractType: string;
  status: string;
  pricePrecision: number;
  tickSize: string;
  quoteAsset: string;
}

interface Position {
  symbol: string;
  positionSide: string;
  positionAmt: number;
  entryPrice: number;
  unRealizedProfit: number;
  leverage: number;
}

interface TradeRecord {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: number;
  price: number;
  time: number;
  status: "FILLED" | "PARTIALLY_FILLED" | "PENDING";
}

interface Signal {
  symbol: string;
  direction: "long" | "short";
  time: number;
  reason: string;
  confidence: number;
}

export default function BinanceAutoTrader() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testMode, setTestMode] = useState(true);
  const [connected, setConnected] = useState(false);
  const [symbols, setSymbols] = useState<FuturesSymbol[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [isTrading, setIsTrading] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([]);
  const [strategyParams, setStrategyParams] = useState<StrategyParams>(DEFAULT_PARAMS);
  const [klineData, setKlineData] = useState<Map<string, KLineData[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const emaCacheRef = useRef<Map<string, { short: number[]; long: number[]; volMA: number[] }>>(new Map());

  // 从localStorage加载配置
  useEffect(() => {
    const savedApiKey = localStorage.getItem("binance_api_key");
    const savedApiSecret = localStorage.getItem("binance_api_secret");
    const savedTestMode = localStorage.getItem("binance_test_mode");
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedApiSecret) setApiSecret(savedApiSecret);
    if (savedTestMode) setTestMode(savedTestMode === "true");
  }, []);

  // 保存配置到localStorage
  const saveConfig = () => {
    localStorage.setItem("binance_api_key", apiKey);
    localStorage.setItem("binance_api_secret", apiSecret);
    localStorage.setItem("binance_test_mode", String(testMode));
  };

  // 连接币安API获取合约列表
  const connectBinance = async () => {
    setLoading(true);
    setError("");

    try {
      // 获取USDT本位合约列表
      const response = await fetch(
        "https://fapi.binance.com/fapi/v1/exchangeInfo?productType=UM",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("获取合约列表失败");
      }

      const data = await response.json();
      const usdtSymbols = data.symbols.filter(
        (s: FuturesSymbol) =>
          s.status === "TRADING" &&
          s.quoteAsset === "USDT" &&
          s.contractType === "PERPETUAL"
      );

      setSymbols(usdtSymbols);
      setConnected(true);
      saveConfig();

      // 默认选择一些主流币
      const popularSymbols = usdtSymbols
        .filter((s: FuturesSymbol) =>
          ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"].includes(s.symbol)
        )
        .map((s: FuturesSymbol) => s.symbol);
      setSelectedSymbols(popularSymbols);
    } catch (err: any) {
      setError(err.message || "连接失败");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // 计算EMA
  const calculateEMA = (data: KLineData[], period: number): number[] => {
    if (data.length < period) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    ema.push(sum / period);

    // EMA
    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i].close - ema[i - period]) * multiplier + ema[i - period];
      ema.push(currentEMA);
    }

    return ema;
  };

  // 计算成交量均线
  const calculateVolumeMA = (data: KLineData[], period: number): number[] => {
    if (data.length < period) return [];

    const ma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - period + 1);
      const slice = data.slice(start, i + 1);
      const avg = slice.reduce((sum, k) => sum + k.volume, 0) / slice.length;
      ma.push(avg);
    }
    return ma;
  };

  // 检测交易信号
  const checkSignals = (symbol: string, data15m: KLineData[]) => {
    if (data15m.length < strategyParams.emaLong + 10) return null;

    const emaShort = calculateEMA(data15m, strategyParams.emaShort);
    const emaLong = calculateEMA(data15m, strategyParams.emaLong);
    const volMA = calculateVolumeMA(data15m, strategyParams.volumePeriod);

    // 缓存EMA数据
    const current = data15m[data15m.length - 1];
    const prev = data15m[data15m.length - 2];
    const emaS = emaShort[emaShort.length - 1];
    const emaL = emaLong[emaLong.length - 1];
    const volMAVal = volMA[volMA.length - 1];

    // 检查趋势距离
    const distance = Math.abs(emaS - emaL) / emaL * 100;
    if (distance < strategyParams.minTrendDistance) return null;

    // 多头信号
    const bullish =
      emaS > emaL &&
      current.close > emaS &&
      current.volume >= volMAVal;

    if (bullish) {
      let valid = true;
      for (let i = 1; i <= 3; i++) {
        if (data15m[data15m.length - 1 - i].close < emaLong[emaLong.length - 1 - i]) {
          valid = false;
          break;
        }
      }
      if (valid) {
        return {
          symbol,
          direction: "long" as const,
          time: current.timestamp,
          reason: `EMA${strategyParams.emaShort} > EMA${strategyParams.emaLong}, 价格站上均线`,
          confidence: 0.75,
        };
      }
    }

    // 空头信号
    const bearish =
      emaS < emaL &&
      current.close < emaS &&
      current.volume >= volMAVal;

    if (bearish) {
      let valid = true;
      for (let i = 1; i <= 3; i++) {
        if (data15m[data15m.length - 1 - i].close > emaLong[emaLong.length - 1 - i]) {
          valid = false;
          break;
        }
      }
      if (valid) {
        return {
          symbol,
          direction: "short" as const,
          time: current.timestamp,
          reason: `EMA${strategyParams.emaShort} < EMA${strategyParams.emaLong}, 价格跌破均线`,
          confidence: 0.75,
        };
      }
    }

    return null;
  };

  // 连接WebSocket获取实时K线
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const streams = selectedSymbols.map(s => `${s.toLowerCase()}@kline_15m`).join("/");
    const wsUrl = `wss://fstream.binance.com/ws/${streams}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const symbol = data.s;

      const kline = {
        timestamp: data.k.t,
        open: parseFloat(data.k.o),
        high: parseFloat(data.k.h),
        low: parseFloat(data.k.l),
        close: parseFloat(data.k.c),
        volume: parseFloat(data.k.v),
      };

      setKlineData((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(symbol) || [];
        const updated = [...existing, kline].slice(-200); // 保留最近200根K线
        newMap.set(symbol, updated);
        return newMap;
      });

      // 检查信号
      const symbolData = klineData.get(symbol) || [];
      if (symbolData.length >= strategyParams.emaLong + 10) {
        const signal = checkSignals(symbol, [...symbolData, kline].slice(-200));
        if (signal) {
          setSignals((prev) => {
            // 避免重复信号
            const lastSignal = prev[0];
            if (
              lastSignal &&
              lastSignal.symbol === signal.symbol &&
              lastSignal.direction === signal.direction &&
              Date.now() - lastSignal.time < 300000 // 5分钟内不重复
            ) {
              return prev;
            }
            return [signal, ...prev.slice(0, 49)];
          });

          // 自动交易
          if (autoTradeEnabled) {
            executeTrade(signal);
          }
        }
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket连接错误");
    };
  };

  // 执行交易
  const executeTrade = async (signal: Signal) => {
    if (!autoTradeEnabled || !connected) return;

    try {
      const side = signal.direction === "long" ? "BUY" : "SELL";
      const type = "MARKET";
      const quantity = 0.001; // 默认数量，实际应根据风险计算

      // 真实API调用（需要后端代理以保护密钥安全）
      // 这里是演示，实际生产环境应该通过后端API代理
      if (!testMode) {
        alert(`生产环境需要后端代理API\n\n模拟交易: ${signal.symbol} ${side}`);
      }

      const trade: TradeRecord = {
        id: Date.now().toString(),
        symbol: signal.symbol,
        side,
        type,
        quantity,
        price: 0,
        time: signal.time,
        status: testMode ? "FILLED" : "PENDING",
      };

      setTradeRecords((prev) => [trade, ...prev.slice(0, 99)]);
    } catch (err: any) {
      setError(err.message || "交易执行失败");
    }
  };

  // 获取当前持仓
  const fetchPositions = async () => {
    if (!connected || !apiKey || !apiSecret) return;

    try {
      // 注意：真实环境中需要通过后端代理，不应在前端直接调用
      // 这里只是示例，实际需要后端API
      setPositions([]);
    } catch (err: any) {
      console.error("获取持仓失败:", err);
    }
  };

  // 开始/停止监控
  const toggleMonitoring = () => {
    if (isTrading) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsTrading(false);
      setAutoTradeEnabled(false);
    } else {
      if (selectedSymbols.length === 0) {
        setError("请至少选择一个合约");
        return;
      }
      connectWebSocket();
      setIsTrading(true);
    }
  };

  // 获取K线历史数据
  const fetchKlines = async (symbol: string) => {
    try {
      const response = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=200`
      );
      const data = await response.json();

      const klines: KLineData[] = data.map((k: any[]) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      setKlineData((prev) => {
        const newMap = new Map(prev);
        newMap.set(symbol, klines);
        return newMap;
      });
    } catch (err: any) {
      console.error(`获取${symbol}K线数据失败:`, err);
    }
  };

  // 开始监控时获取历史数据
  useEffect(() => {
    if (isTrading && selectedSymbols.length > 0) {
      selectedSymbols.forEach((symbol) => fetchKlines(symbol));
    }
  }, [isTrading, selectedSymbols]);

  // 组件卸载时关闭WebSocket
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  return (
    <div className="space-y-6">
      {/* API配置 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">币安API配置</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入您的币安API Key"
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="输入您的币安API Secret"
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="testMode"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="testMode" className="text-gray-300">
              测试模式（不执行真实交易，仅模拟）
            </label>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <button
            onClick={connectBinance}
            disabled={loading || !apiKey}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 rounded transition"
          >
            {loading ? "连接中..." : "连接币安"}
          </button>

          {connected && (
            <div className="flex items-center gap-2 text-green-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>已连接币安</span>
            </div>
          )}
        </div>
      </div>

      {/* 合约选择 */}
      {connected && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">选择监控合约</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto">
            {symbols.map((symbol) => (
              <label
                key={symbol.symbol}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                  selectedSymbols.includes(symbol.symbol)
                    ? "bg-blue-600"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSymbols.includes(symbol.symbol)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSymbols([...selectedSymbols, symbol.symbol]);
                    } else {
                      setSelectedSymbols(selectedSymbols.filter((s) => s !== symbol.symbol));
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">{symbol.symbol}</span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-2">
              已选择: {selectedSymbols.length} 个合约
            </p>
          </div>
        </div>
      )}

      {/* 策略参数 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">策略参数</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">EMA短期</label>
            <input
              type="number"
              value={strategyParams.emaShort}
              onChange={(e) =>
                setStrategyParams({ ...strategyParams, emaShort: Number(e.target.value) })
              }
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">EMA长期</label>
            <input
              type="number"
              value={strategyParams.emaLong}
              onChange={(e) =>
                setStrategyParams({ ...strategyParams, emaLong: Number(e.target.value) })
              }
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">最小趋势距离(%)</label>
            <input
              type="number"
              step="0.05"
              value={strategyParams.minTrendDistance}
              onChange={(e) =>
                setStrategyParams({ ...strategyParams, minTrendDistance: Number(e.target.value) })
              }
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>

      {/* 控制面板 */}
      {connected && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">交易控制</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoTradeEnabled}
                  onChange={(e) => {
                    if (!testMode && e.target.checked) {
                      const confirm = window.confirm(
                        "⚠️ 警告：您即将在非测试模式下开启自动交易！\n\n这会使用真实资金进行交易。\n\n确定要继续吗？"
                      );
                      if (!confirm) return;
                    }
                    setAutoTradeEnabled(e.target.checked);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">
                  自动交易 {autoTradeEnabled ? "(已开启)" : "(已关闭)"}
                </span>
              </label>
              <button
                onClick={toggleMonitoring}
                className={`px-6 py-2 rounded font-medium transition ${
                  isTrading
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isTrading ? "停止监控" : "开始监控"}
              </button>
            </div>
          </div>

          {isTrading && (
            <div className="flex items-center gap-2 text-green-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>
                正在监控 {selectedSymbols.length} 个合约 | {testMode ? "测试模式" : "交易模式"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 交易信号 */}
      {isTrading && signals.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">交易信号 (最近50条)</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {signals.map((signal, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  signal.direction === "long" ? "bg-green-900/30" : "bg-red-900/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        signal.direction === "long" ? "bg-green-600" : "bg-red-600"
                      }`}
                    >
                      {signal.direction === "long" ? "做多" : "做空"}
                    </span>
                    <span className="font-bold">{signal.symbol}</span>
                  </div>
                  <span className="text-sm text-gray-400">{formatTime(signal.time)}</span>
                </div>
                <p className="text-sm text-gray-300 mt-2">{signal.reason}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-400">置信度:</span>
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        signal.confidence >= 0.7 ? "bg-green-500" : "bg-yellow-500"
                      }`}
                      style={{ width: `${signal.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sm">{(signal.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 交易记录 */}
      {tradeRecords.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">交易记录</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">时间</th>
                  <th className="px-3 py-2 text-left">合约</th>
                  <th className="px-3 py-2 text-left">方向</th>
                  <th className="px-3 py-2 text-left">类型</th>
                  <th className="px-3 py-2 text-left">数量</th>
                  <th className="px-3 py-2 text-left">价格</th>
                  <th className="px-3 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {tradeRecords.map((trade) => (
                  <tr key={trade.id} className="border-t border-gray-700">
                    <td className="px-3 py-2">{formatTime(trade.time)}</td>
                    <td className="px-3 py-2 font-bold">{trade.symbol}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          trade.side === "BUY" ? "bg-green-600" : "bg-red-600"
                        }`}
                      >
                        {trade.side === "BUY" ? "买入" : "卖出"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{trade.type}</td>
                    <td className="px-3 py-2">{trade.quantity}</td>
                    <td className="px-3 py-2">
                      {trade.price > 0 ? trade.price.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          trade.status === "FILLED" ? "text-green-500" : "text-yellow-500"
                        }
                      >
                        {trade.status === "FILLED" ? "已成交" : "待成交"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 实时价格展示 */}
      {isTrading && selectedSymbols.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">实时价格</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {selectedSymbols.map((symbol) => {
              const data = klineData.get(symbol);
              const currentPrice = data?.[data.length - 1]?.close || 0;
              const prevPrice = data?.[data.length - 2]?.close || currentPrice;
              const priceChange = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

              return (
                <div key={symbol} className="bg-gray-700 rounded-lg p-4">
                  <p className="font-bold">{symbol}</p>
                  <p className={`text-lg ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {currentPrice > 0 ? currentPrice.toFixed(2) : "-"}
                  </p>
                  <p className={`text-sm ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 策略回测工具 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">策略回测工具</h2>
        <CryptoBacktestTool />
      </div>
    </div>
  );
}
