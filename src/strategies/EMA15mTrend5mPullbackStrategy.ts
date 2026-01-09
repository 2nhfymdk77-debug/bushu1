/**
 * 15分钟趋势+5分钟回调进场策略
 * 多时间框架策略：15分钟确认趋势方向，5分钟寻找回调进场点
 */

import {
  TradingStrategy,
  StrategyMeta,
  BaseStrategyParams,
  StrategyConfigItem,
  SignalDetectionResult,
  KLineData,
  Signal
} from "../types/strategy";

// 策略参数类型
export interface EMATrendPullbackParams extends BaseStrategyParams {
  // 时间周期参数
  trendTimeframe: string;  // 趋势识别周期（如15m, 1h, 4h）
  entryTimeframe: string;  // 进场信号周期（如5m, 15m）

  // EMA参数
  emaShort: number;
  emaLong: number;

  // RSI参数
  rsiPeriod: number;
  rsiThreshold: number;  // RSI阈值（用于判断超买超卖）

  // 成交量参数
  volumePeriod: number;

  // 趋势过滤参数
  minTrendDistance: number;  // 最小趋势距离（%）

  // 进场筛选条件开关
  enablePriceEMAFilter: boolean;      // 价格与EMA关系
  enableRSIFilter: boolean;           // RSI超买超卖检测
  enableTouchedEmaFilter: boolean;   // EMA回踩/反弹检测
  enableCandleColorFilter: boolean;  // K线颜色确认

  // 进场筛选条件参数
  emaTouchLookback: number;          // 回踩检测的K线数量
  minCandleChangePercent: number;   // 最小涨跌幅（%）
  minConditionsRequired: number;     // 进场需要满足的最少条件数
}

// 策略元信息
const STRATEGY_META: StrategyMeta = {
  id: "ema_trend_recognition",
  name: "EMA趋势识别",
  description: "多时间框架策略：使用自定义周期EMA确认趋势方向，在小周期图中寻找回调进场点。结合RSI、成交量、K线颜色等多重过滤条件。",
  version: "2.0.0",
  category: "趋势跟踪",
  author: "AutoTrader",
  timeframe: ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d"],
  riskLevel: "medium"
};

// 默认参数
const DEFAULT_PARAMS: EMATrendPullbackParams = {
  trendTimeframe: "15m",
  entryTimeframe: "5m",
  emaShort: 20,
  emaLong: 60,
  rsiPeriod: 14,
  rsiThreshold: 50,
  volumePeriod: 20,
  minTrendDistance: 0.05,
  enablePriceEMAFilter: true,
  enableRSIFilter: true,
  enableTouchedEmaFilter: true,
  enableCandleColorFilter: true,
  emaTouchLookback: 3,
  minCandleChangePercent: 0.1,
  minConditionsRequired: 2,
};

/**
 * 15分钟趋势+5分钟回调策略实现
 */
export class EMATrendPullbackStrategy implements TradingStrategy<EMATrendPullbackParams> {
  readonly meta = STRATEGY_META;

  getDefaultParams(): EMATrendPullbackParams {
    return { ...DEFAULT_PARAMS };
  }

  getConfigItems(): StrategyConfigItem[] {
    return [
      // 时间周期参数
      {
        key: "trendTimeframe",
        label: "趋势识别周期",
        type: "select",
        defaultValue: DEFAULT_PARAMS.trendTimeframe,
        options: [
          { value: "1m", label: "1分钟" },
          { value: "3m", label: "3分钟" },
          { value: "5m", label: "5分钟" },
          { value: "15m", label: "15分钟" },
          { value: "30m", label: "30分钟" },
          { value: "1h", label: "1小时" },
          { value: "2h", label: "2小时" },
          { value: "4h", label: "4小时" },
          { value: "6h", label: "6小时" },
          { value: "8h", label: "8小时" },
          { value: "12h", label: "12小时" },
          { value: "1d", label: "1天" },
        ],
        description: "用于确认大趋势方向的时间周期",
        category: "时间周期"
      },
      {
        key: "entryTimeframe",
        label: "进场信号周期",
        type: "select",
        defaultValue: DEFAULT_PARAMS.entryTimeframe,
        options: [
          { value: "1m", label: "1分钟" },
          { value: "3m", label: "3分钟" },
          { value: "5m", label: "5分钟" },
          { value: "15m", label: "15分钟" },
          { value: "30m", label: "30分钟" },
          { value: "1h", label: "1小时" },
          { value: "2h", label: "2小时" },
          { value: "4h", label: "4小时" },
          { value: "6h", label: "6小时" },
          { value: "8h", label: "8小时" },
          { value: "12h", label: "12小时" },
          { value: "1d", label: "1天" },
        ],
        description: "用于寻找回调进场点的时间周期（应小于趋势识别周期）",
        category: "时间周期"
      },

      // 基本参数
      {
        key: "emaShort",
        label: "EMA短期",
        type: "number",
        defaultValue: DEFAULT_PARAMS.emaShort,
        min: 5,
        max: 50,
        step: 1,
        description: "短期EMA周期，用于识别趋势",
        category: "基本参数"
      },
      {
        key: "emaLong",
        label: "EMA长期",
        type: "number",
        defaultValue: DEFAULT_PARAMS.emaLong,
        min: 20,
        max: 200,
        step: 1,
        description: "长期EMA周期，用于确认趋势方向",
        category: "基本参数"
      },
      {
        key: "minTrendDistance",
        label: "最小趋势距离 (%)",
        type: "number",
        defaultValue: DEFAULT_PARAMS.minTrendDistance,
        min: 0.01,
        max: 1,
        step: 0.01,
        description: "EMA短期和长期的最小距离百分比",
        category: "基本参数"
      },

      // RSI参数
      {
        key: "rsiPeriod",
        label: "RSI周期",
        type: "number",
        defaultValue: DEFAULT_PARAMS.rsiPeriod,
        min: 2,
        max: 30,
        step: 1,
        description: "RSI指标周期",
        category: "RSI参数"
      },
      {
        key: "rsiThreshold",
        label: "RSI阈值",
        type: "number",
        defaultValue: DEFAULT_PARAMS.rsiThreshold,
        min: 0,
        max: 100,
        step: 1,
        description: "RSI超买超卖判断阈值，低于为超卖，高于为超买",
        category: "RSI参数"
      },

      // 成交量参数
      {
        key: "volumePeriod",
        label: "成交量周期",
        type: "number",
        defaultValue: DEFAULT_PARAMS.volumePeriod,
        min: 5,
        max: 50,
        step: 1,
        description: "成交量平均周期",
        category: "成交量参数"
      },

      // 进场条件开关
      {
        key: "enablePriceEMAFilter",
        label: "启用价格与EMA关系过滤",
        type: "checkbox",
        defaultValue: DEFAULT_PARAMS.enablePriceEMAFilter,
        description: "多头：价格在EMA短期上方，空头：价格在EMA短期下方",
        category: "进场条件"
      },
      {
        key: "enableRSIFilter",
        label: "启用RSI超买超卖过滤",
        type: "checkbox",
        defaultValue: DEFAULT_PARAMS.enableRSIFilter,
        description: "多头：RSI从超卖区反弹，空头：RSI从超买区回落",
        category: "进场条件"
      },
      {
        key: "enableTouchedEmaFilter",
        label: "启用EMA回踩/反弹过滤",
        type: "checkbox",
        defaultValue: DEFAULT_PARAMS.enableTouchedEmaFilter,
        description: "检查最近N根K线是否触及EMA短期",
        category: "进场条件"
      },
      {
        key: "enableCandleColorFilter",
        label: "启用K线颜色确认",
        type: "checkbox",
        defaultValue: DEFAULT_PARAMS.enableCandleColorFilter,
        description: "多头：阳线，空头：阴线",
        category: "进场条件"
      },

      // 进场条件参数
      {
        key: "emaTouchLookback",
        label: "回踩K线数量",
        type: "number",
        defaultValue: DEFAULT_PARAMS.emaTouchLookback,
        min: 2,
        max: 10,
        step: 1,
        description: "回踩检测的K线数量",
        category: "进场条件"
      },
      {
        key: "minCandleChangePercent",
        label: "最小涨跌幅 (%)",
        type: "number",
        defaultValue: DEFAULT_PARAMS.minCandleChangePercent,
        min: 0,
        max: 1,
        step: 0.01,
        description: "K线确认的最小涨跌幅百分比",
        category: "进场条件"
      },

      // 进场条件数量
      {
        key: "minConditionsRequired",
        label: "最少满足条件数",
        type: "number",
        defaultValue: DEFAULT_PARAMS.minConditionsRequired,
        min: 1,
        max: 4,
        step: 1,
        description: "进场时最少需要满足的条件数量（1-4个）",
        category: "进场条件"
      },
    ];
  }

  validateParams(params: EMATrendPullbackParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.emaShort >= params.emaLong) {
      errors.push("EMA短期必须小于EMA长期");
    }

    if (params.minConditionsRequired < 1 || params.minConditionsRequired > 4) {
      errors.push("最少满足条件数必须在1-4之间");
    }

    if (params.rsiThreshold < 0 || params.rsiThreshold > 100) {
      errors.push("RSI阈值必须在0-100之间");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  detectSignal(
    symbol: string,
    klines: KLineData[],
    params: EMATrendPullbackParams
  ): SignalDetectionResult {
    // 检查数据量
    const minDataLength = params.emaLong + 10;
    if (klines.length < minDataLength) {
      return {
        signal: null,
        reason: "数据不足",
        details: `需要${minDataLength}条K线，实际只有${klines.length}条`
      };
    }

    // 计算指标
    const emaShort = this.calculateEMA(klines, params.emaShort);
    const emaLong = this.calculateEMA(klines, params.emaLong);
    const rsi = this.calculateRSI(klines, params.rsiPeriod);
    const volumeMA = this.calculateVolumeMA(klines, params.volumePeriod);

    // 判断趋势方向
    const trendDirection = this.getTrendDirection(
      klines,
      emaShort,
      emaLong,
      volumeMA,
      params
    );

    if (trendDirection === "none") {
      const dataIndex = klines.length - 1;
      const emaIndex = Math.min(emaShort.length, emaLong.length) - 1;
      const emaS = emaShort[emaIndex];
      const emaL = emaLong[emaIndex];
      const close = klines[dataIndex].close;
      const distance = Math.abs(emaS - emaL) / emaL * 100;

      return {
        signal: null,
        reason: "趋势不明确",
        details: `EMA${params.emaShort}:${emaS.toFixed(2)}, EMA${params.emaLong}:${emaL.toFixed(2)}, 价格:${close.toFixed(2)}, 距离:${distance.toFixed(2)}% < ${params.minTrendDistance}%`
      };
    }

    // 检查进场条件
    const entryResult = this.checkEntrySignal(
      klines,
      trendDirection,
      emaShort,
      emaLong,
      rsi,
      params
    );

    if (!entryResult.signal) {
      return {
        signal: null,
        reason: `${trendDirection === 'long' ? '多头' : '空头'}趋势，但进场条件不满足`,
        details: `${entryResult.reason}; ${entryResult.details}`
      };
    }

    const currentKline = klines[klines.length - 1];
    const signalReason = `${trendDirection === "long" ? "多头" : "空头"}趋势 + 回调进场 (${entryResult.reason})`;

    return {
      signal: {
        symbol,
        direction: entryResult.type,
        time: currentKline.timestamp,
        reason: signalReason,
        confidence: 0.85,
        entryPrice: currentKline.close,
      },
      reason: "信号触发",
      details: entryResult.details
    };
  }

  // ========== 内部辅助方法 ==========

  /**
   * 计算EMA
   */
  private calculateEMA(data: KLineData[], period: number): number[] {
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
  }

  /**
   * 计算RSI
   */
  private calculateRSI(data: KLineData[], period: number): number[] {
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

  /**
   * 计算成交量平均
   */
  private calculateVolumeMA(data: KLineData[], period: number): number[] {
    if (data.length < period) return [];

    const ma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - period + 1);
      const slice = data.slice(start, i + 1);
      const avg = slice.reduce((sum, k) => sum + k.volume, 0) / slice.length;
      ma.push(avg);
    }
    return ma;
  }

  /**
   * 获取趋势方向
   */
  private getTrendDirection(
    data: KLineData[],
    emaShort: number[],
    emaLong: number[],
    volumeMA: number[],
    params: EMATrendPullbackParams
  ): "long" | "short" | "none" {
    if (data.length < params.emaLong) return "none";

    const minEmaLength = Math.min(emaShort.length, emaLong.length, volumeMA.length);
    const emaIndex = minEmaLength - 1;
    const dataIndex = data.length - 1;

    const emaS = emaShort[emaIndex];
    const emaL = emaLong[emaIndex];
    const close = data[dataIndex].close;

    if (emaS === undefined || emaL === undefined || emaL === 0) {
      return "none";
    }

    // 检查趋势距离
    const distance = Math.abs(emaS - emaL) / emaL * 100;
    if (distance < params.minTrendDistance) {
      return "none";
    }

    // 多头条件
    const bullish = emaS > emaL && close > emaS;
    if (bullish) {
      return "long";
    }

    // 空头条件
    const bearish = emaS < emaL && close < emaS;
    if (bearish) {
      return "short";
    }

    return "none";
  }

  /**
   * 检查进场信号
   */
  private checkEntrySignal(
    data: KLineData[],
    trendDirection: "long" | "short",
    emaShort: number[],
    emaLong: number[],
    rsi: number[],
    params: EMATrendPullbackParams
  ): { signal: boolean; type: "long" | "short"; reason: string; details: string } {
    const minArrayLength = Math.min(emaShort.length, emaLong.length, rsi.length);
    const dataIndex = data.length - 1;
    const emaIndex = minArrayLength - 1;

    const current = data[dataIndex];
    const prev = data[dataIndex - 1];
    const prev2 = data[dataIndex - 2];

    const emaS = emaShort[emaIndex];
    const rsiCurrent = rsi[emaIndex];
    const rsiPrev = rsi[emaIndex - 1];

    if (emaS === undefined || rsiCurrent === undefined || rsiPrev === undefined) {
      return {
        signal: false,
        type: trendDirection,
        reason: "指标计算失败",
        details: "EMA或RSI值无效"
      };
    }

    const failedChecks: string[] = [];

    if (trendDirection === "long") {
      // 多头条件
      const priceAboveEMA = current.close > emaS;
      if (params.enablePriceEMAFilter && !priceAboveEMA) {
        failedChecks.push(`价格${current.close.toFixed(2)}不在EMA${params.emaShort}(${emaS.toFixed(2)})上方`);
      }

      const rsiRecovery = rsiCurrent < params.rsiThreshold && rsiCurrent > rsiPrev;
      if (params.enableRSIFilter && !rsiRecovery) {
        if (rsiCurrent >= params.rsiThreshold) {
          failedChecks.push(`RSI=${rsiCurrent.toFixed(1)}不在超卖区(需要<${params.rsiThreshold})`);
        } else if (rsiCurrent <= rsiPrev) {
          failedChecks.push(`RSI未反弹(${rsiCurrent.toFixed(1)} <= ${rsiPrev.toFixed(1)})`);
        }
      }

      const touchedEma = prev.low <= emaS || prev2.low <= emaS;
      if (params.enableTouchedEmaFilter && !touchedEma) {
        failedChecks.push(`最近${params.emaTouchLookback}根K线未触及EMA${params.emaShort}`);
      }

      const candleChange = (current.close - current.open) / current.open * 100;
      const bullishCandle = current.close > current.open &&
                           candleChange >= params.minCandleChangePercent;
      if (params.enableCandleColorFilter && !bullishCandle) {
        if (current.close <= current.open) {
          failedChecks.push(`当前不是阳线`);
        } else {
          failedChecks.push(`阳线涨幅${candleChange.toFixed(3)}%不足${params.minCandleChangePercent}%`);
        }
      }

      // 计算满足的条件数
      let passedConditions = 0;
      if (!params.enablePriceEMAFilter || priceAboveEMA) passedConditions++;
      if (!params.enableRSIFilter || rsiRecovery) passedConditions++;
      if (!params.enableTouchedEmaFilter || touchedEma) passedConditions++;
      if (!params.enableCandleColorFilter || bullishCandle) passedConditions++;

      const enabledConditionsCount = [
        params.enablePriceEMAFilter,
        params.enableRSIFilter,
        params.enableTouchedEmaFilter,
        params.enableCandleColorFilter
      ].filter(Boolean).length || 4;

      const minRequired = Math.min(params.minConditionsRequired, enabledConditionsCount);

      if (passedConditions >= minRequired) {
        return {
          signal: true,
          type: "long",
          reason: `多头进场（${passedConditions}/${enabledConditionsCount}条件满足）`,
          details: `价格:${current.close.toFixed(2)}, RSI:${rsiCurrent.toFixed(1)}, EMA${params.emaShort}:${emaS.toFixed(2)}`
        };
      } else {
        return {
          signal: false,
          type: trendDirection,
          reason: `多头进场未通过 (${passedConditions}/${enabledConditionsCount}条件, 需要${minRequired}个)`,
          details: `未满足条件: ${failedChecks.length > 0 ? failedChecks.join('; ') : '满足条件不足' + minRequired + '个'}`
        };
      }
    } else {
      // 空头条件
      const priceBelowEMA = current.close < emaS;
      if (params.enablePriceEMAFilter && !priceBelowEMA) {
        failedChecks.push(`价格${current.close.toFixed(2)}不在EMA${params.emaShort}(${emaS.toFixed(2)})下方`);
      }

      const rsiDecline = rsiCurrent > params.rsiThreshold && rsiCurrent < rsiPrev;
      if (params.enableRSIFilter && !rsiDecline) {
        if (rsiCurrent <= params.rsiThreshold) {
          failedChecks.push(`RSI=${rsiCurrent.toFixed(1)}不在超买区(需要>${params.rsiThreshold})`);
        } else if (rsiCurrent >= rsiPrev) {
          failedChecks.push(`RSI未回落(${rsiCurrent.toFixed(1)} >= ${rsiPrev.toFixed(1)})`);
        }
      }

      const touchedEma = prev.high >= emaS || prev2.high >= emaS;
      if (params.enableTouchedEmaFilter && !touchedEma) {
        failedChecks.push(`最近${params.emaTouchLookback}根K线未触及EMA${params.emaShort}`);
      }

      const candleChange = (current.open - current.close) / current.open * 100;
      const bearishCandle = current.close < current.open &&
                           candleChange >= params.minCandleChangePercent;
      if (params.enableCandleColorFilter && !bearishCandle) {
        if (current.close >= current.open) {
          failedChecks.push(`当前不是阴线`);
        } else {
          failedChecks.push(`阴线跌幅${candleChange.toFixed(3)}%不足${params.minCandleChangePercent}%`);
        }
      }

      // 计算满足的条件数
      let passedConditions = 0;
      if (!params.enablePriceEMAFilter || priceBelowEMA) passedConditions++;
      if (!params.enableRSIFilter || rsiDecline) passedConditions++;
      if (!params.enableTouchedEmaFilter || touchedEma) passedConditions++;
      if (!params.enableCandleColorFilter || bearishCandle) passedConditions++;

      const enabledConditionsCount = [
        params.enablePriceEMAFilter,
        params.enableRSIFilter,
        params.enableTouchedEmaFilter,
        params.enableCandleColorFilter
      ].filter(Boolean).length || 4;

      const minRequired = Math.min(params.minConditionsRequired, enabledConditionsCount);

      if (passedConditions >= minRequired) {
        return {
          signal: true,
          type: "short",
          reason: `空头进场（${passedConditions}/${enabledConditionsCount}条件满足）`,
          details: `价格:${current.close.toFixed(2)}, RSI:${rsiCurrent.toFixed(1)}, EMA${params.emaShort}:${emaS.toFixed(2)}`
        };
      } else {
        return {
          signal: false,
          type: trendDirection,
          reason: `空头进场未通过 (${passedConditions}/${enabledConditionsCount}条件, 需要${minRequired}个)`,
          details: `未满足条件: ${failedChecks.length > 0 ? failedChecks.join('; ') : '满足条件不足' + minRequired + '个'}`
        };
      }
    }
  }
}
