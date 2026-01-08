"use client";

import React, { useState, useEffect, useRef } from "react";

// 类型定义
interface KLineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StrategyParams {
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

const DEFAULT_PARAMS: StrategyParams = {
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
  markPrice: number;
  unRealizedProfit: number;
  leverage: number;
  notional: number;
  // 分段止盈和移动止损的额外信息
  highestPrice?: number; // 多头最高价
  lowestPrice?: number;  // 空头最低价
  takeProfitExecuted?: {
    r1: boolean;  // 1R止盈是否执行
    r2: boolean;  // 2R止盈是否执行
    r3: boolean;  // 3R止盈是否执行
  };
  trailingStopPrice?: number; // 当前移动止损价格
  stopLossBreakeven?: boolean; // 止损是否已移动到保本价
}

interface Order {
  symbol: string;
  orderId: number;
  side: string;
  type: string;
  quantity: number;
  price: number;
  executedQty: number;
  status: string;
  time: number;
  updateTime: number;
}

interface AccountBalance {
  available: number;
  wallet: number;
  unrealizedPnl: number;
}

interface TradeRecord {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: number;
  price: number;
  time: number;
  status: "FILLED" | "PARTIALLY_FILLED" | "PENDING" | "FAILED";
  orderId?: number;
  pnl?: number;
}

interface Signal {
  symbol: string;
  direction: "long" | "short";
  time: number;
  reason: string;
  confidence: number;
  entryPrice: number;
  executed?: boolean;
  notExecutedReason?: string;
}

interface TradingConfig {
  positionSizePercent: number;
  maxOpenPositions: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxDailyLoss: number;
  dailyTradesLimit: number;
  // 自动平仓配置
  autoStopLoss: boolean;
  autoTakeProfit: boolean;
  reverseSignalClose: boolean;
  // 分段止盈配置
  usePartialTakeProfit: boolean;  // 使用分段止盈
  partialTakeProfitR1: number;   // 1R止盈比例（%）
  partialTakeProfitR2: number;   // 2R止盈比例（%）
  partialTakeProfitR3: number;   // 3R止盈比例（%）
  // 移动止损配置
  useTrailingStop: boolean;       // 使用移动止损
  trailingStopTriggerR: number;   // 触发移动止损的R值（如1R）
  trailingStopMoveToBreakeven: boolean; // 达到1R后移动到保本价
}

const DEFAULT_TRADING_CONFIG: TradingConfig = {
  positionSizePercent: 10,
  maxOpenPositions: 3,
  stopLossPercent: 0.5,
  takeProfitPercent: 1.0,
  maxDailyLoss: 5,
  dailyTradesLimit: 10,
  // 默认开启自动止损止盈和反向信号平仓
  autoStopLoss: true,
  autoTakeProfit: false,  // 关闭简单止盈，使用分段止盈
  reverseSignalClose: true,
  // 分段止盈配置（按照用户要求）
  usePartialTakeProfit: true,
  partialTakeProfitR1: 50,  // 1R止盈50%
  partialTakeProfitR2: 50,  // 2R止盈剩余50%
  partialTakeProfitR3: 50,  // 3R止盈所有（实际上2R已经全平了）
  // 移动止损配置
  useTrailingStop: true,
  trailingStopTriggerR: 1,  // 1R时触发移动止损
  trailingStopMoveToBreakeven: true, // 达到1R后移动到保本价
};

export default function BinanceAutoTrader() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(true);
  const [testMode, setTestMode] = useState(true);
  const [connected, setConnected] = useState(false);
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [symbols, setSymbols] = useState<FuturesSymbol[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [isTrading, setIsTrading] = useState(false);
  const [autoTrading, setAutoTrading] = useState(false);
  const [autoScanAll, setAutoScanAll] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([]);
  const [strategyParams, setStrategyParams] = useState<StrategyParams>(DEFAULT_PARAMS);
  const [tradingConfig, setTradingConfig] = useState<TradingConfig>(DEFAULT_TRADING_CONFIG);
  const [klineData, setKlineData] = useState<Map<string, KLineData[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastSignalTime, setLastSignalTime] = useState<number>(0);
  const [dailyTradesCount, setDailyTradesCount] = useState(0);
  const [scanIntervalRef, setScanIntervalRef] = useState<NodeJS.Timeout | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const emaCacheRef = useRef<Map<string, { short: number[]; long: number[]; volMA: number[] }>>(new Map());

  // 从localStorage加载配置
  useEffect(() => {
    const savedApiKey = localStorage.getItem("binance_api_key");
    const savedApiSecret = localStorage.getItem("binance_api_secret");
    const savedTestnet = localStorage.getItem("binance_testnet");
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedApiSecret) setApiSecret(savedApiSecret);
    if (savedTestnet) setTestnet(savedTestnet === "true");
  }, []);

  // 自动扫描所有合约
  const scanAllSymbols = async () => {
    if (!connected || !autoScanAll) return;

    try {
      setScanProgress("正在获取热门合约...");

      // 获取24h ticker数据
      const tickerResponse = await fetch(
        "https://fapi.binance.com/fapi/v1/ticker/24hr",
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!tickerResponse.ok) {
        throw new Error("获取ticker数据失败");
      }

      const tickers = await tickerResponse.json();

      // 按成交量排序,取前20个USDT合约
      const usdtTickers = tickers
        .filter((t: any) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 10000000)
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 20)
        .map((t: any) => t.symbol);

      setScanProgress(`正在扫描 ${usdtTickers.length} 个热门合约...`);

      // 对每个合约进行信号检测
      let signalsFound = 0;
      let tradesExecuted = 0;
      const maxCheckSymbols = Math.min(usdtTickers.length, 15); // 每次最多检查15个

      for (let i = 0; i < maxCheckSymbols; i++) {
        const symbol = usdtTickers[i];
        setScanProgress(`正在扫描 ${i + 1}/${maxCheckSymbols}: ${symbol} (已交易: ${tradesExecuted})`);

        // 检查是否达到持仓数量限制
        if (positions.length >= tradingConfig.maxOpenPositions) {
          console.log(`已达到最大持仓数量限制 (${tradingConfig.maxOpenPositions})，停止开新仓位`);
          setScanProgress(`已达到最大持仓限制 (${tradingConfig.maxOpenPositions})，继续扫描中...`);
        }

        // 检查是否达到每日交易次数限制
        if (dailyTradesCount >= tradingConfig.dailyTradesLimit) {
          console.log(`已达到每日交易限制 (${tradingConfig.dailyTradesLimit})，停止开新仓位`);
          setScanProgress(`已达到每日交易限制 (${tradingConfig.dailyTradesLimit})，继续扫描中...`);
        }

        // 获取K线数据
        try {
          const klineResponse = await fetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=100`
          );

          if (!klineResponse.ok) continue;

          const klineDataRaw = await klineResponse.json();

          const klines: KLineData[] = klineDataRaw.map((k: any[]) => ({
            timestamp: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }));

          // 检测信号
          if (klines.length >= strategyParams.emaLong + 10) {
            const signal = checkSignals(symbol, klines);
            if (signal) {
              signalsFound++;

              // 检查是否可以执行交易
              let canExecute = autoTrading;
              let notExecutedReason = "";

              if (!autoTrading) {
                notExecutedReason = "自动交易未开启";
                canExecute = false;
              } else if (positions.length >= tradingConfig.maxOpenPositions) {
                notExecutedReason = `已达到最大持仓限制 (${tradingConfig.maxOpenPositions})`;
                canExecute = false;
              } else if (dailyTradesCount >= tradingConfig.dailyTradesLimit) {
                notExecutedReason = `已达到每日交易限制 (${tradingConfig.dailyTradesLimit})`;
                canExecute = false;
              }

              // 添加到信号列表
              setSignals((prev) => {
                const exists = prev.some(s =>
                  s.symbol === signal.symbol &&
                  s.direction === signal.direction &&
                  Date.now() - s.time < 300000
                );
                if (!exists) {
                  return [{
                    ...signal,
                    executed: canExecute,
                    notExecutedReason: canExecute ? undefined : notExecutedReason
                  }, ...prev.slice(0, 49)];
                }
                return prev;
              });

              // 执行交易（仅在未达到限制时）
              if (canExecute) {
                await executeTrade(signal);
                tradesExecuted++;
              }
            }
          }
        } catch (err) {
          console.error(`扫描${symbol}失败:`, err);
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setScanProgress(`扫描完成: 发现 ${signalsFound} 个信号, 执行 ${tradesExecuted} 笔交易`);

      // 5秒后清除扫描状态
      setTimeout(() => setScanProgress(""), 5000);
    } catch (err: any) {
      console.error("自动扫描失败:", err);
      setScanProgress("扫描失败: " + (err.message || "未知错误"));
      setTimeout(() => setScanProgress(""), 5000);
    }
  };

  // 监听自动扫描开关
  useEffect(() => {
    if (autoScanAll && isTrading && connected && autoTrading) {
      // 立即执行一次扫描
      scanAllSymbols();

      // 每5分钟扫描一次
      const interval = setInterval(scanAllSymbols, 5 * 60 * 1000);
      setScanIntervalRef(interval);
    } else {
      if (scanIntervalRef) {
        clearInterval(scanIntervalRef);
        setScanIntervalRef(null);
      }
    }

    return () => {
      if (scanIntervalRef) {
        clearInterval(scanIntervalRef);
      }
    };
  }, [autoScanAll, isTrading, connected, autoTrading]);

  // 检查持仓并自动平仓
  const checkPositionsAndAutoClose = async () => {
    if (!autoTrading || !connected || positions.length === 0) return;

    for (const position of positions) {
      if (position.positionAmt === 0) continue;

      const symbol = position.symbol;
      const isLong = position.positionAmt > 0;
      const currentPrice = position.markPrice;
      const entryPrice = position.entryPrice;
      const pnl = position.unRealizedProfit;

      // 计算风险值R（止损距离）
      const riskDistance = entryPrice * (tradingConfig.stopLossPercent / 100);
      const rPrice = riskDistance; // 1R的价格距离

      // 计算1R、2R、3R价格
      const r1Price = isLong ? entryPrice + rPrice : entryPrice - rPrice;
      const r2Price = isLong ? entryPrice + rPrice * 2 : entryPrice - rPrice * 2;
      const r3Price = isLong ? entryPrice + rPrice * 3 : entryPrice - rPrice * 3;

      // 基础止损价格
      const stopLossPrice = isLong
        ? entryPrice * (1 - tradingConfig.stopLossPercent / 100)
        : entryPrice * (1 + tradingConfig.stopLossPercent / 100);

      // 当前实际止损价格（可能已移动）
      const currentStopLossPrice = position.trailingStopPrice || stopLossPrice;

      // 1. 简单自动止盈（如果不使用分段止盈）
      if (tradingConfig.autoTakeProfit && !tradingConfig.usePartialTakeProfit) {
        const takeProfitPrice = isLong
          ? entryPrice * (1 + tradingConfig.takeProfitPercent / 100)
          : entryPrice * (1 - tradingConfig.takeProfitPercent / 100);

        const hitTakeProfit = isLong
          ? currentPrice >= takeProfitPrice
          : currentPrice <= takeProfitPrice;

        if (hitTakeProfit) {
          console.log(`触发达盈: ${symbol} 价格: ${currentPrice.toFixed(2)} 止盈价: ${takeProfitPrice.toFixed(2)}`);
          await executeAutoClose(position, "止盈触发");
          continue;
        }
      }

      // 2. 分段止盈
      if (tradingConfig.usePartialTakeProfit) {
        const tpExecuted = position.takeProfitExecuted || { r1: false, r2: false, r3: false };

        // 2.1 检查1R止盈（50%）
        if (!tpExecuted.r1) {
          const hitR1 = isLong ? currentPrice >= r1Price : currentPrice <= r1Price;
          if (hitR1) {
            console.log(`达到1R止盈位: ${symbol} 价格: ${currentPrice.toFixed(2)} 1R价: ${r1Price.toFixed(2)}`);
            // 平仓50%
            await executePartialClose(position, 0.5, "1R止盈50%");
            continue; // 执行后继续下一个持仓
          }
        }

        // 2.2 检查2R-3R止盈（剩余50%）
        if (tpExecuted.r1 && !tpExecuted.r2) {
          const hitR2 = isLong ? currentPrice >= r2Price : currentPrice <= r2Price;
          if (hitR2) {
            console.log(`达到2R止盈位: ${symbol} 价格: ${currentPrice.toFixed(2)} 2R价: ${r2Price.toFixed(2)}`);
            // 平仓剩余100%（因为之前已经平了50%，现在平剩下的全部）
            await executePartialClose(position, 1.0, "2R全部止盈");
            continue;
          }
        }

        // 2.3 检查3R止盈（作为兜底）
        if (tpExecuted.r2 && !tpExecuted.r3) {
          const hitR3 = isLong ? currentPrice >= r3Price : currentPrice <= r3Price;
          if (hitR3) {
            console.log(`达到3R止盈位: ${symbol} 价格: ${currentPrice.toFixed(2)} 3R价: ${r3Price.toFixed(2)}`);
            // 平仓剩余所有
            await executePartialClose(position, 1.0, "3R全部止盈");
            continue;
          }
        }
      }

      // 3. 移动止损
      if (tradingConfig.useTrailingStop) {
        // 更新最高价/最低价
        const newHighestPrice = isLong
          ? Math.max(position.highestPrice || entryPrice, currentPrice)
          : position.highestPrice || entryPrice;
        const newLowestPrice = !isLong
          ? Math.min(position.lowestPrice || entryPrice, currentPrice)
          : position.lowestPrice || entryPrice;

        // 检查是否达到触发移动止损的R值
        const triggerPrice = isLong
          ? entryPrice + rPrice * tradingConfig.trailingStopTriggerR
          : entryPrice - rPrice * tradingConfig.trailingStopTriggerR;

        const hitTrigger = isLong
          ? currentPrice >= triggerPrice
          : currentPrice <= triggerPrice;

        // 如果达到1R且要求移动到保本价
        if (hitTrigger && tradingConfig.trailingStopMoveToBreakeven && !position.stopLossBreakeven) {
          console.log(`触发移动止损到保本价: ${symbol}`);
          // 移动止损到保本价（入场价）
          // 这里只是逻辑，实际需要通过API修改止损订单
          // 目前我们只能在价格跌破保本价时平仓
        }

        // 计算移动止损价格
        let trailingStopPrice = stopLossPrice;

        if (hitTrigger) {
          if (isLong) {
            // 多头：最高价 - 移动止损距离
            const trailingDistance = rPrice * tradingConfig.trailingStopTriggerR;
            trailingStopPrice = newHighestPrice - trailingDistance;
          } else {
            // 空头：最低价 + 移动止损距离
            const trailingDistance = rPrice * tradingConfig.trailingStopTriggerR;
            trailingStopPrice = newLowestPrice + trailingDistance;
          }

          // 如果配置了移动到保本价，且移动止损价格不如保本价有利
          if (tradingConfig.trailingStopMoveToBreakeven) {
            if (isLong && trailingStopPrice < entryPrice) {
              trailingStopPrice = entryPrice;
            } else if (!isLong && trailingStopPrice > entryPrice) {
              trailingStopPrice = entryPrice;
            }
          }
        }

        // 检查是否触发移动止损
        const hitTrailingStop = isLong
          ? currentPrice <= trailingStopPrice
          : currentPrice >= trailingStopPrice;

        if (hitTrailingStop) {
          console.log(`触发移动止损: ${symbol} 价格: ${currentPrice.toFixed(2)} 移动止损价: ${trailingStopPrice.toFixed(2)}`);
          await executeAutoClose(position, "移动止损触发");
          continue;
        }
      }

      // 4. 自动止损（简单止损，优先级最低）
      if (tradingConfig.autoStopLoss) {
        const hitStopLoss = isLong
          ? currentPrice <= currentStopLossPrice
          : currentPrice >= currentStopLossPrice;

        if (hitStopLoss) {
          console.log(`触发止损: ${symbol} 价格: ${currentPrice.toFixed(2)} 止损价: ${currentStopLossPrice.toFixed(2)}`);
          await executeAutoClose(position, "止损触发");
          continue;
        }
      }

      // 5. 反向信号平仓
      if (tradingConfig.reverseSignalClose) {
        const symbolData = klineData.get(symbol);
        if (symbolData && symbolData.length >= strategyParams.emaLong + 10) {
          const signal = checkSignals(symbol, symbolData);

          if (signal) {
            // 检测到反向信号
            const isReverseSignal = (isLong && signal.direction === "short") ||
                                   (!isLong && signal.direction === "long");

            if (isReverseSignal) {
              console.log(`反向信号平仓: ${symbol} 持仓方向: ${isLong ? "多头" : "空头"} 信号: ${signal.direction}`);
              await executeAutoClose(position, `反向信号: ${signal.direction}`);
              continue;
            }
          }
        }
      }
    }
  };

  // 执行部分平仓
  const executePartialClose = async (position: Position, percent: number, reason: string) => {
    if (!connected || !apiKey || !apiSecret) return;

    try {
      const isLong = position.positionAmt > 0;
      const side = isLong ? "SELL" : "BUY";
      const totalQuantity = Math.abs(position.positionAmt);
      const closeQuantity = totalQuantity * percent;

      if (!testMode) {
        // 真实平仓
        const response = await fetch("/api/binance/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            testnet,
            symbol: position.symbol,
            side,
            type: "MARKET",
            quantity: closeQuantity.toFixed(3),
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "平仓失败");
        }
      }

      // 记录平仓交易
      const closeTrade: TradeRecord = {
        id: Date.now().toString(),
        symbol: position.symbol,
        side,
        type: "MARKET",
        quantity: closeQuantity,
        price: position.markPrice,
        time: Date.now(),
        status: "FILLED",
      };

      setTradeRecords((prev) => [closeTrade, ...prev.slice(0, 99)]);

      // 更新止盈执行状态
      if (reason.includes("1R")) {
        setPositions((prev) =>
          prev.map((p) =>
            p.symbol === position.symbol
              ? {
                  ...p,
                  positionAmt: isLong ? p.positionAmt - closeQuantity : p.positionAmt + closeQuantity,
                  takeProfitExecuted: { ...(p.takeProfitExecuted || { r1: false, r2: false, r3: false }), r1: true },
                }
              : p
          )
        );
      } else if (reason.includes("2R")) {
        setPositions((prev) =>
          prev.map((p) =>
            p.symbol === position.symbol
              ? {
                  ...p,
                  positionAmt: isLong ? p.positionAmt - closeQuantity : p.positionAmt + closeQuantity,
                  takeProfitExecuted: { ...(p.takeProfitExecuted || { r1: false, r2: false, r3: false }), r2: true },
                }
              : p
          )
        );
      } else if (reason.includes("3R")) {
        setPositions((prev) =>
          prev.map((p) =>
            p.symbol === position.symbol
              ? {
                  ...p,
                  positionAmt: isLong ? p.positionAmt - closeQuantity : p.positionAmt + closeQuantity,
                  takeProfitExecuted: { ...(p.takeProfitExecuted || { r1: false, r2: false, r3: false }), r3: true },
                }
              : p
          )
        );
      }

      console.log(`部分平仓成功: ${position.symbol} 比例: ${(percent * 100).toFixed(0)}% 原因: ${reason} 盈亏: ${(position.unRealizedProfit * percent).toFixed(2)} USDT`);
    } catch (err: any) {
      console.error(`部分平仓失败: ${position.symbol}`, err);
      setError(`部分平仓失败: ${err.message}`);
    }
  };

  // 执行自动平仓
  const executeAutoClose = async (position: Position, reason: string) => {
    if (!connected || !apiKey || !apiSecret) return;

    try {
      const isLong = position.positionAmt > 0;
      const side = isLong ? "SELL" : "BUY";
      const quantity = Math.abs(position.positionAmt);

      if (!testMode) {
        // 真实平仓
        const response = await fetch("/api/binance/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            testnet,
            symbol: position.symbol,
            side,
            type: "MARKET",
            quantity: quantity.toFixed(3),
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "平仓失败");
        }
      }

      // 记录平仓交易
      const closeTrade: TradeRecord = {
        id: Date.now().toString(),
        symbol: position.symbol,
        side,
        type: "MARKET",
        quantity,
        price: position.markPrice,
        time: Date.now(),
        status: "FILLED",
      };

      setTradeRecords((prev) => [closeTrade, ...prev.slice(0, 99)]);
      console.log(`平仓成功: ${position.symbol} 原因: ${reason} 盈亏: ${position.unRealizedProfit.toFixed(2)} USDT`);
    } catch (err: any) {
      console.error(`自动平仓失败: ${position.symbol}`, err);
      setError(`自动平仓失败: ${err.message}`);
    }
  };

  // 每日重置交易计数
  useEffect(() => {
    const resetDailyTrades = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const tomorrowMidnight = new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
      const timeUntilReset = tomorrowMidnight.getTime() - now.getTime();

      const resetTimeout = setTimeout(() => {
        setDailyTradesCount(0);
        resetDailyTrades();
      }, timeUntilReset);

      return () => clearTimeout(resetTimeout);
    };

    const cleanup = resetDailyTrades();
    return cleanup;
  }, []);

  // 保存配置到localStorage
  const saveConfig = () => {
    localStorage.setItem("binance_api_key", apiKey);
    localStorage.setItem("binance_api_secret", apiSecret);
    localStorage.setItem("binance_testnet", String(testnet));
  };

  // 连接币安API
  const connectBinance = async () => {
    setLoading(true);
    setError("");

    try {
      // 获取合约列表
      const symbolsResponse = await fetch(
        "https://fapi.binance.com/fapi/v1/exchangeInfo?productType=UM",
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!symbolsResponse.ok) {
        throw new Error("获取合约列表失败");
      }

      const symbolsData = await symbolsResponse.json();
      const usdtSymbols = symbolsData.symbols.filter(
        (s: FuturesSymbol) =>
          s.status === "TRADING" &&
          s.quoteAsset === "USDT" &&
          s.contractType === "PERPETUAL"
      );

      setSymbols(usdtSymbols);

      // 获取账户余额
      if (apiKey && apiSecret) {
        const balanceResponse = await fetch("/api/binance/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, apiSecret, testnet }),
        });

        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setAccountBalance(balanceData);
        }
      }

      setConnected(true);
      saveConfig();

      // 默认选择主流币
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

  // 获取账户信息
  const fetchAccountInfo = async () => {
    if (!connected || !apiKey || !apiSecret) return;

    try {
      // 获取余额
      const balanceResponse = await fetch("/api/binance/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, testnet }),
      });

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setAccountBalance(balanceData);
      }

      // 获取持仓
      const positionsResponse = await fetch("/api/binance/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, testnet }),
      });

      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json();

        // 初始化新增字段
        const initializedPositions = positionsData.map((p: Position) => ({
          ...p,
          highestPrice: p.highestPrice || p.entryPrice,
          lowestPrice: p.lowestPrice || p.entryPrice,
          takeProfitExecuted: p.takeProfitExecuted || { r1: false, r2: false, r3: false },
          trailingStopPrice: p.trailingStopPrice,
          stopLossBreakeven: p.stopLossBreakeven || false,
        }));

        setPositions(initializedPositions);

        // 检查持仓并自动平仓
        await checkPositionsAndAutoClose();
      }

      // 获取订单
      const ordersResponse = await fetch("/api/binance/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, testnet, limit: 50 }),
      });

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        setOrders(ordersData);
      }
    } catch (err: any) {
      console.error("获取账户信息失败:", err);
    }
  };

  // 开始/停止定时刷新
  useEffect(() => {
    if (isTrading && connected) {
      fetchAccountInfo();
      refreshIntervalRef.current = setInterval(fetchAccountInfo, 5000); // 每5秒刷新
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isTrading, connected]);

  // 计算EMA
  const calculateEMA = (data: KLineData[], period: number): number[] => {
    if (data.length < period) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    ema.push(sum / period);

    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i].close - ema[i - period]) * multiplier + ema[i - period];
      ema.push(currentEMA);
    }

    return ema;
  };

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
  const checkSignals = (symbol: string, data15m: KLineData[]): Signal | null => {
    if (data15m.length < strategyParams.emaLong + 10) return null;

    const emaShort = calculateEMA(data15m, strategyParams.emaShort);
    const emaLong = calculateEMA(data15m, strategyParams.emaLong);
    const volMA = calculateVolumeMA(data15m, strategyParams.volumePeriod);

    const current = data15m[data15m.length - 1];
    const emaS = emaShort[emaShort.length - 1];
    const emaL = emaLong[emaLong.length - 1];
    const volMAVal = volMA[volMA.length - 1];

    const distance = Math.abs(emaS - emaL) / emaL * 100;
    if (distance < strategyParams.minTrendDistance) return null;

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
          direction: "long",
          time: current.timestamp,
          reason: `EMA${strategyParams.emaShort} > EMA${strategyParams.emaLong}`,
          confidence: 0.75,
          entryPrice: current.close,
        };
      }
    }

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
          direction: "short",
          time: current.timestamp,
          reason: `EMA${strategyParams.emaShort} < EMA${strategyParams.emaLong}`,
          confidence: 0.75,
          entryPrice: current.close,
        };
      }
    }

    return null;
  };

  // 执行交易
  const executeTrade = async (signal: Signal) => {
    if (!autoTrading || !connected || !accountBalance) return;

    // 检查每日交易限制
    if (dailyTradesCount >= tradingConfig.dailyTradesLimit) {
      console.log("已达到每日交易限制");
      return;
    }

    // 检查持仓数量限制
    if (positions.length >= tradingConfig.maxOpenPositions) {
      console.log("已达到最大持仓数量");
      return;
    }

    // 检查时间间隔（避免频繁交易）
    const now = Date.now();
    if (now - lastSignalTime < 300000) { // 5分钟
      return;
    }

    try {
      const side = signal.direction === "long" ? "BUY" : "SELL";
      const type = "MARKET";
      const availableBalance = accountBalance.available;
      const positionValue = availableBalance * (tradingConfig.positionSizePercent / 100);
      const quantity = positionValue / signal.entryPrice;

      // 计算止损止盈
      const stopLossPrice = signal.direction === "long"
        ? signal.entryPrice * (1 - tradingConfig.stopLossPercent / 100)
        : signal.entryPrice * (1 + tradingConfig.stopLossPercent / 100);
      const takeProfitPrice = signal.direction === "long"
        ? signal.entryPrice * (1 + tradingConfig.takeProfitPercent / 100)
        : signal.entryPrice * (1 - tradingConfig.takeProfitPercent / 100);

      let orderId = undefined;
      let orderStatus: "FILLED" | "PARTIALLY_FILLED" | "PENDING" | "FAILED" = "PENDING";

      if (!testMode) {
        // 真实下单
        const response = await fetch("/api/binance/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            testnet,
            symbol: signal.symbol,
            side,
            type,
            quantity: quantity.toFixed(3),
            stopLoss: stopLossPrice.toFixed(2),
            takeProfit: takeProfitPrice.toFixed(2),
          }),
        });

        const result = await response.json();
        if (response.ok) {
          orderId = result.orderId;
          orderStatus = result.status === "FILLED" ? "FILLED" : "PENDING";
        } else {
          orderStatus = "FAILED";
          throw new Error(result.error || "下单失败");
        }
      } else {
        // 测试模式，模拟成交
        orderStatus = "FILLED";
      }

      const trade: TradeRecord = {
        id: Date.now().toString(),
        symbol: signal.symbol,
        side,
        type,
        quantity,
        price: signal.entryPrice,
        time: signal.time,
        status: orderStatus,
        orderId,
      };

      setTradeRecords((prev) => [trade, ...prev.slice(0, 99)]);
      setLastSignalTime(now);
      setDailyTradesCount((prev) => prev + 1);
    } catch (err: any) {
      console.error("交易执行失败:", err);
      setError(err.message || "交易执行失败");

      const failedTrade: TradeRecord = {
        id: Date.now().toString(),
        symbol: signal.symbol,
        side: signal.direction === "long" ? "BUY" : "SELL",
        type: "MARKET",
        quantity: 0,
        price: signal.entryPrice,
        time: signal.time,
        status: "FAILED",
      };
      setTradeRecords((prev) => [failedTrade, ...prev.slice(0, 99)]);
    }
  };

  // 连接WebSocket
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
        const updated = [...existing, kline].slice(-200);
        newMap.set(symbol, updated);
        return newMap;
      });

      const symbolData = klineData.get(symbol) || [];
      if (symbolData.length >= strategyParams.emaLong + 10) {
        const signal = checkSignals(symbol, [...symbolData, kline].slice(-200));
        if (signal) {
          // 检查是否可以执行交易
          let canExecute = autoTrading;
          let notExecutedReason = "";

          if (!autoTrading) {
            notExecutedReason = "自动交易未开启";
            canExecute = false;
          } else if (positions.length >= tradingConfig.maxOpenPositions) {
            notExecutedReason = `已达到最大持仓限制 (${tradingConfig.maxOpenPositions})`;
            canExecute = false;
          } else if (dailyTradesCount >= tradingConfig.dailyTradesLimit) {
            notExecutedReason = `已达到每日交易限制 (${tradingConfig.dailyTradesLimit})`;
            canExecute = false;
          }

          setSignals((prev) => {
            const lastSignal = prev[0];
            if (
              lastSignal &&
              lastSignal.symbol === signal.symbol &&
              lastSignal.direction === signal.direction &&
              Date.now() - lastSignal.time < 300000
            ) {
              return prev;
            }
            return [{
              ...signal,
              executed: canExecute,
              notExecutedReason: canExecute ? undefined : notExecutedReason
            }, ...prev.slice(0, 49)];
          });

          if (canExecute) {
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

  // 手动重置每日交易计数
  const resetDailyTradesCount = () => {
    setDailyTradesCount(0);
  };

  // 开始/停止监控
  const toggleMonitoring = () => {
    if (isTrading) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsTrading(false);
      setAutoTrading(false);
    } else {
      if (selectedSymbols.length === 0) {
        setError("请至少选择一个合约");
        return;
      }
      connectWebSocket();
      setIsTrading(true);
    }
  };

  // 监控开始时获取历史数据
  useEffect(() => {
    if (isTrading && selectedSymbols.length > 0) {
      selectedSymbols.forEach((symbol) => fetchKlines(symbol));
    }
  }, [isTrading, selectedSymbols]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (scanIntervalRef) {
        clearInterval(scanIntervalRef);
      }
    };
  }, [scanIntervalRef]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  const totalPnL = positions.reduce((sum, p) => sum + p.unRealizedProfit, 0);

  return (
    <div className="space-y-6">
      {/* API配置 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">币安API配置</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        <div className="flex items-center gap-4 mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={testnet}
              onChange={(e) => setTestnet(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-gray-300">测试网</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-gray-300">模拟交易（不真实下单）</span>
          </label>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded mt-4">
            {error}
          </div>
        )}

        <button
          onClick={connectBinance}
          disabled={loading || !apiKey || !apiSecret}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 rounded transition"
        >
          {loading ? "连接中..." : "连接币安"}
        </button>

        {connected && (
          <div className="flex items-center gap-2 text-green-500 mt-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>已连接{testnet ? "测试网" : "主网"}</span>
          </div>
        )}
      </div>

      {/* 账户信息 */}
      {connected && accountBalance && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">账户信息</h2>
            <button
              onClick={fetchAccountInfo}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
            >
              刷新
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">可用余额</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(accountBalance.available)} USDT
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">钱包余额</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(accountBalance.wallet)} USDT
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">未实现盈亏</p>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
                {totalPnL >= 0 ? "+" : ""}{formatNumber(totalPnL)} USDT
              </p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">持仓数量</p>
              <p className="text-2xl font-bold text-white">
                {positions.length}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-bold mb-4">自动平仓管理</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.autoStopLoss}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, autoStopLoss: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">自动止损</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  价格达到止损位时自动平仓
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.autoTakeProfit}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, autoTakeProfit: e.target.checked })
                    }
                    disabled={tradingConfig.usePartialTakeProfit}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${tradingConfig.usePartialTakeProfit ? "text-gray-500" : "text-gray-300"}`}>
                    自动止盈（简单）
                  </span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  {tradingConfig.usePartialTakeProfit ? "已使用分段止盈" : "价格达到止盈位时自动平仓"}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.usePartialTakeProfit}
                    onChange={(e) => {
                      const newConfig = { ...tradingConfig, usePartialTakeProfit: e.target.checked };
                      if (e.target.checked) {
                        newConfig.autoTakeProfit = false; // 开启分段止盈时关闭简单止盈
                      }
                      setTradingConfig(newConfig);
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">分段止盈</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  1R平50%，2R-3R全平
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.useTrailingStop}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, useTrailingStop: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">移动止损</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  达到1R后移动止损
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.trailingStopMoveToBreakeven}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, trailingStopMoveToBreakeven: e.target.checked })
                    }
                    disabled={!tradingConfig.useTrailingStop}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${!tradingConfig.useTrailingStop ? "text-gray-500" : "text-gray-300"}`}>
                    移动到保本价
                  </span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  {!tradingConfig.useTrailingStop ? "需先开启移动止损" : "达到1R后止损移到保本"}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.reverseSignalClose}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, reverseSignalClose: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">反向信号平仓</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  出现反向信号时自动平仓
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-900/20 rounded">
              <h4 className="font-bold text-blue-400 mb-2">平仓策略说明</h4>
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                <li><span className="text-green-400">分段止盈</span>: 1R平50%仓位，2R平剩余50%仓位，保护已实现的利润</li>
                <li><span className="text-green-400">移动止损</span>: 达到1R后，止损价随价格移动，锁定更多利润</li>
                <li><span className="text-green-400">移动到保本价</span>: 达到1R后，止损移动到入场价，确保不亏损</li>
                <li><span className="text-yellow-400">R值说明</span>: 1R = 止损距离（如止损0.5%，1R = 价格移动0.5%）</li>
                <li>每5秒自动检查持仓，触发条件立即执行平仓</li>
                <li>分段止盈和简单止盈互斥，建议使用分段止盈</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 持仓信息 */}
      {connected && positions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">当前持仓</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">合约</th>
                  <th className="px-3 py-2 text-left">方向</th>
                  <th className="px-3 py-2 text-left">数量</th>
                  <th className="px-3 py-2 text-left">入场价</th>
                  <th className="px-3 py-2 text-left">标记价</th>
                  {tradingConfig.usePartialTakeProfit ? (
                    <>
                      <th className="px-3 py-2 text-left text-yellow-400">1R价</th>
                      <th className="px-3 py-2 text-left text-yellow-400">2R价</th>
                      <th className="px-3 py-2 text-left text-yellow-400">分段状态</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left text-red-400">止损价</th>
                      <th className="px-3 py-2 text-left text-green-400">止盈价</th>
                    </>
                  )}
                  {tradingConfig.useTrailingStop && (
                    <th className="px-3 py-2 text-left text-blue-400">移动止损</th>
                  )}
                  <th className="px-3 py-2 text-left">未实现盈亏</th>
                  <th className="px-3 py-2 text-left">杠杆</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, index) => {
                  const isLong = pos.positionAmt > 0;
                  const riskDistance = pos.entryPrice * (tradingConfig.stopLossPercent / 100);
                  const r1Price = isLong ? pos.entryPrice + riskDistance : pos.entryPrice - riskDistance;
                  const r2Price = isLong ? pos.entryPrice + riskDistance * 2 : pos.entryPrice - riskDistance * 2;
                  const r3Price = isLong ? pos.entryPrice + riskDistance * 3 : pos.entryPrice - riskDistance * 3;

                  const stopLossPrice = isLong
                    ? pos.entryPrice * (1 - tradingConfig.stopLossPercent / 100)
                    : pos.entryPrice * (1 + tradingConfig.stopLossPercent / 100);
                  const takeProfitPrice = isLong
                    ? pos.entryPrice * (1 + tradingConfig.takeProfitPercent / 100)
                    : pos.entryPrice * (1 - tradingConfig.takeProfitPercent / 100);

                  const tpExecuted = pos.takeProfitExecuted || { r1: false, r2: false, r3: false };
                  const highestPrice = pos.highestPrice || pos.entryPrice;
                  const lowestPrice = pos.lowestPrice || pos.entryPrice;

                  return (
                    <tr key={index} className="border-t border-gray-700">
                      <td className="px-3 py-2 font-bold">{pos.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          pos.positionAmt > 0 ? "bg-green-600" : "bg-red-600"
                        }`}>
                          {pos.positionAmt > 0 ? "做多" : "做空"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{Math.abs(pos.positionAmt).toFixed(4)}</td>
                      <td className="px-3 py-2">{pos.entryPrice.toFixed(2)}</td>
                      <td className="px-3 py-2">{pos.markPrice.toFixed(2)}</td>

                      {tradingConfig.usePartialTakeProfit ? (
                        <>
                          <td className={`px-3 py-2 ${pos.markPrice >= r1Price ? "text-green-500 font-bold" : "text-yellow-400"}`}>
                            {r1Price.toFixed(2)}
                            {pos.markPrice >= r1Price && " ✓"}
                          </td>
                          <td className={`px-3 py-2 ${pos.markPrice >= r2Price ? "text-green-500 font-bold" : "text-yellow-400"}`}>
                            {r2Price.toFixed(2)}
                            {pos.markPrice >= r2Price && " ✓"}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <div className="space-y-1">
                              <span className={tpExecuted.r1 ? "text-green-500" : "text-gray-500"}>
                                {tpExecuted.r1 ? "✓ 1R:50%" : "○ 1R:50%"}
                              </span>
                              <span className={tpExecuted.r2 ? "text-green-500" : "text-gray-500"}>
                                {tpExecuted.r2 ? "✓ 2R:100%" : "○ 2R:100%"}
                              </span>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-red-400">{stopLossPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-green-400">{takeProfitPrice.toFixed(2)}</td>
                        </>
                      )}

                      {tradingConfig.useTrailingStop && (
                        <td className="px-3 py-2 text-blue-400 text-xs">
                          {pos.trailingStopPrice ? pos.trailingStopPrice.toFixed(2) : "-"}
                          {pos.stopLossBreakeven && " (保本)"}
                        </td>
                      )}

                      <td className={`px-3 py-2 font-semibold ${pos.unRealizedProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {pos.unRealizedProfit >= 0 ? "+" : ""}{pos.unRealizedProfit.toFixed(2)} USDT
                      </td>
                      <td className="px-3 py-2">{pos.leverage}x</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
          <div className="mt-4 text-sm text-gray-400">
            已选择: {selectedSymbols.length} 个合约
          </div>
        </div>
      )}

      {/* 交易参数配置 */}
      {connected && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">交易参数配置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                单笔仓位比例 (%)
                <span className="text-xs text-gray-500 ml-2">每笔交易占可用余额的比例</span>
              </label>
              <input
                type="number"
                value={tradingConfig.positionSizePercent}
                onChange={(e) =>
                  setTradingConfig({ ...tradingConfig, positionSizePercent: Number(e.target.value) })
                }
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                min="1"
                max="100"
              />
              <div className="text-xs text-gray-500 mt-1">
                最大可用余额: {accountBalance ? `${(accountBalance.available * tradingConfig.positionSizePercent / 100).toFixed(2)} USDT` : '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                最大持仓数量
                <span className="text-xs text-gray-500 ml-2">同时持有的最大仓位数</span>
              </label>
              <input
                type="number"
                value={tradingConfig.maxOpenPositions}
                onChange={(e) =>
                  setTradingConfig({ ...tradingConfig, maxOpenPositions: Number(e.target.value) })
                }
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                min="1"
              />
              <div className="text-xs text-gray-500 mt-1">
                当前持仓: <span className={positions.length >= tradingConfig.maxOpenPositions ? "text-red-500 font-bold" : "text-green-500"}>{positions.length}/{tradingConfig.maxOpenPositions}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">止损比例 (%)</label>
              <input
                type="number"
                step="0.1"
                value={tradingConfig.stopLossPercent}
                onChange={(e) =>
                  setTradingConfig({ ...tradingConfig, stopLossPercent: Number(e.target.value) })
                }
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">止盈比例 (%)</label>
              <input
                type="number"
                step="0.1"
                value={tradingConfig.takeProfitPercent}
                onChange={(e) =>
                  setTradingConfig({ ...tradingConfig, takeProfitPercent: Number(e.target.value) })
                }
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">每日最大亏损 (%)</label>
              <input
                type="number"
                value={tradingConfig.maxDailyLoss}
                onChange={(e) =>
                  setTradingConfig({ ...tradingConfig, maxDailyLoss: Number(e.target.value) })
                }
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                每日交易限制
                <span className="text-xs text-gray-500 ml-2">
                  (已用: <span className={dailyTradesCount >= tradingConfig.dailyTradesLimit ? "text-red-500 font-bold" : "text-green-500"}>{dailyTradesCount}</span>)
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={tradingConfig.dailyTradesLimit}
                  onChange={(e) =>
                    setTradingConfig({ ...tradingConfig, dailyTradesLimit: Number(e.target.value) })
                  }
                  className="flex-1 bg-gray-700 rounded px-3 py-2 text-white"
                  min="1"
                />
                <button
                  onClick={resetDailyTradesCount}
                  disabled={dailyTradesCount === 0}
                  className={`px-3 py-2 rounded transition ${
                    dailyTradesCount === 0
                      ? "bg-gray-600 cursor-not-allowed text-gray-400"
                      : "bg-yellow-600 hover:bg-yellow-700 text-white"
                  }`}
                  title="重置今日交易计数"
                >
                  重置
                </button>
              </div>
              {dailyTradesCount >= tradingConfig.dailyTradesLimit && (
                <div className="mt-1 text-xs text-red-500">
                  ⚠️ 已达到每日交易限制,自动交易将暂停
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-bold mb-4">策略参数</h3>
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
                <label className="block text-sm text-gray-400 mb-1">最小趋势距离 (%)</label>
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

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-bold mb-4">自动平仓管理</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.autoStopLoss}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, autoStopLoss: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">自动止损</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  价格达到止损位时自动平仓
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.autoTakeProfit}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, autoTakeProfit: e.target.checked })
                    }
                    disabled={tradingConfig.usePartialTakeProfit}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${tradingConfig.usePartialTakeProfit ? "text-gray-500" : "text-gray-300"}`}>
                    自动止盈（简单）
                  </span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  {tradingConfig.usePartialTakeProfit ? "已使用分段止盈" : "价格达到止盈位时自动平仓"}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.usePartialTakeProfit}
                    onChange={(e) => {
                      const newConfig = { ...tradingConfig, usePartialTakeProfit: e.target.checked };
                      if (e.target.checked) {
                        newConfig.autoTakeProfit = false; // 开启分段止盈时关闭简单止盈
                      }
                      setTradingConfig(newConfig);
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">分段止盈</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  1R平50%，2R-3R全平
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.useTrailingStop}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, useTrailingStop: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">移动止损</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  达到1R后移动止损
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.trailingStopMoveToBreakeven}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, trailingStopMoveToBreakeven: e.target.checked })
                    }
                    disabled={!tradingConfig.useTrailingStop}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${!tradingConfig.useTrailingStop ? "text-gray-500" : "text-gray-300"}`}>
                    移动到保本价
                  </span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  {!tradingConfig.useTrailingStop ? "需先开启移动止损" : "达到1R后止损移到保本"}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tradingConfig.reverseSignalClose}
                    onChange={(e) =>
                      setTradingConfig({ ...tradingConfig, reverseSignalClose: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">反向信号平仓</span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  出现反向信号时自动平仓
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-900/20 rounded">
              <h4 className="font-bold text-blue-400 mb-2">平仓策略说明</h4>
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                <li><span className="text-green-400">分段止盈</span>: 1R平50%仓位，2R平剩余50%仓位，保护已实现的利润</li>
                <li><span className="text-green-400">移动止损</span>: 达到1R后，止损价随价格移动，锁定更多利润</li>
                <li><span className="text-green-400">移动到保本价</span>: 达到1R后，止损移动到入场价，确保不亏损</li>
                <li><span className="text-yellow-400">R值说明</span>: 1R = 止损距离（如止损0.5%，1R = 价格移动0.5%）</li>
                <li>每5秒自动检查持仓，触发条件立即执行平仓</li>
                <li>分段止盈和简单止盈互斥，建议使用分段止盈</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 控制面板 */}
      {connected && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold mb-2">交易控制</h2>
              <div className="text-sm text-gray-400">
                监控 {selectedSymbols.length} 个合约 | {testMode ? "模拟交易" : "实盘交易"} | {testnet ? "测试网" : "主网"}
              </div>
            </div>
            <div className="flex items-center gap-4">
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

              {isTrading && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoTrading}
                    onChange={(e) => {
                      if (!testMode && e.target.checked) {
                        const confirm = window.confirm(
                          "⚠️ 警告：您即将在非测试模式下开启自动交易！\n\n这会使用真实资金进行交易。\n\n确定要继续吗？"
                        );
                        if (!confirm) return;
                      }
                      setAutoTrading(e.target.checked);
                    }}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${autoTrading ? "text-green-500 font-bold" : "text-gray-300"}`}>
                    自动交易
                  </span>
                </label>
              )}
            </div>
          </div>

          {isTrading && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-bold">正在监控</span>
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">今日交易: </span>
                  <span className="text-white">{dailyTradesCount}/{tradingConfig.dailyTradesLimit}</span>
                </div>
                <div>
                  <span className="text-gray-400">当前持仓: </span>
                  <span className="text-white">{positions.length}/{tradingConfig.maxOpenPositions}</span>
                </div>
                <div>
                  <span className="text-gray-400">自动交易: </span>
                  <span className={autoTrading ? "text-green-500" : "text-gray-500"}>
                    {autoTrading ? "开启" : "关闭"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">运行时间: </span>
                  <span className="text-white">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              {/* 自动扫描控制 */}
              <div className="mt-4 pt-4 border-t border-gray-600">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoScanAll}
                      onChange={(e) => setAutoScanAll(e.target.checked)}
                      disabled={!autoTrading}
                      className="w-4 h-4"
                    />
                    <span className={`text-sm ${autoScanAll ? "text-blue-500 font-bold" : "text-gray-300"}`}>
                      自动扫描所有合约 (每5分钟)
                    </span>
                  </label>

                  {dailyTradesCount > 0 && (
                    <button
                      onClick={resetDailyTradesCount}
                      className="px-4 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm transition"
                    >
                      重置交易计数器
                    </button>
                  )}
                </div>

                {autoScanAll && (
                  <div className="mt-3 p-3 bg-blue-900/20 rounded text-sm text-blue-300">
                    <div className="font-bold mb-1">扫描规则:</div>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      <li>自动扫描24h成交量最高的前20个合约</li>
                      <li>每5分钟扫描一次，最多检查15个合约</li>
                      <li>持仓数量未达限制时继续开仓 (当前: {positions.length}/{tradingConfig.maxOpenPositions})</li>
                      <li>每日交易次数未达限制时继续交易 (今日: {dailyTradesCount}/{tradingConfig.dailyTradesLimit})</li>
                      <li>发现信号但达到限制时，仍会继续扫描以发现新信号</li>
                    </ul>
                  </div>
                )}

                {scanProgress && (
                  <div className="mt-2 text-sm text-blue-400 animate-pulse">
                    {scanProgress}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 实时交易信息 */}
      {isTrading && signals.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">实时交易信号</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {signals.map((signal, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  signal.direction === "long"
                    ? "bg-green-900/20 border-green-800"
                    : "bg-red-900/20 border-red-800"
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
                    <span className="font-bold text-lg">{signal.symbol}</span>
                    {signal.executed !== undefined && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          signal.executed ? "bg-blue-600" : "bg-orange-600"
                        }`}
                      >
                        {signal.executed ? "已执行" : "未执行"}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{formatNumber(signal.entryPrice, 2)}</div>
                    <div className="text-xs text-gray-400">{formatTime(signal.time)}</div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-300">{signal.reason}</div>
                {signal.notExecutedReason && (
                  <div className="mt-1 text-xs text-orange-400">
                    ⚠️ {signal.notExecutedReason}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
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
                    <td className="px-3 py-2">{trade.quantity.toFixed(4)}</td>
                    <td className="px-3 py-2">
                      {trade.price > 0 ? trade.price.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          trade.status === "FILLED"
                            ? "text-green-500"
                            : trade.status === "FAILED"
                            ? "text-red-500"
                            : "text-yellow-500"
                        }
                      >
                        {trade.status === "FILLED" ? "已成交" : trade.status === "FAILED" ? "失败" : "待成交"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 实时价格 */}
      {isTrading && selectedSymbols.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">实时价格</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {selectedSymbols.map((symbol) => {
              const data = klineData.get(symbol);
              const currentPrice = data?.[data.length - 1]?.close || 0;
              const prevPrice = data?.[data.length - 2]?.close || currentPrice;
              const priceChange = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
              const position = positions.find((p) => p.symbol === symbol);
              const hasPosition = position !== undefined;

              return (
                <div
                  key={symbol}
                  className={`bg-gray-700 rounded-lg p-4 border-2 transition ${
                    hasPosition ? "border-blue-500" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{symbol}</p>
                    {hasPosition && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                  <p className={`text-lg mt-2 ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {currentPrice > 0 ? currentPrice.toFixed(2) : "-"}
                  </p>
                  <p className={`text-sm ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)}%
                  </p>
                  {position && (
                    <div className="mt-2 pt-2 border-t border-gray-600">
                      <p className="text-xs text-gray-400">持仓: {Math.abs(position.positionAmt).toFixed(4)}</p>
                      <p className={`text-xs ${position.unRealizedProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {position.unRealizedProfit >= 0 ? "+" : ""}
                        {position.unRealizedProfit.toFixed(2)} USDT
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
