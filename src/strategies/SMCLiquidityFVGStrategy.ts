import {
  TradingStrategy,
  StrategyMeta,
  BaseStrategyParams,
  SignalDetectionResult,
  KLineData,
  Signal,
} from "../types/strategy";

/**
 * SMC 流动性 + FVG 回踩策略
 * 基于 ICT/SMC（智能资金）理论
 *
 * 核心思想：
 * 1. 在"流动性被扫 + 机构位移确认"后
 * 2. 通过 FVG（公平价值缺口）回踩进行低风险入场
 * 3. 顺势捕捉结构性行情
 */
export interface SMCLiquidityFVGParams extends BaseStrategyParams {
  // 时间框架配置
  mainTimeframe: string;     // 主周期（识别流动性）- 15m
  midTimeframe: string;      // 中周期（确认位移）- 5m
  lowTimeframe: string;      // 低周期（回踩入场）- 1m

  // 流动性识别参数
  liquidityLookback: number; // 识别流动性时向前看多少根K线
  liquidityTolerance: number; // 流动性扫荡容差（百分比）

  // 位移确认参数
  displacementThreshold: number; // 位移阈值（ATR倍数）
  displacementMinBars: number;  // 最少连续同向K线数

  // FVG 识别参数
  fvgMinSize: number;        // FVG 最小大小（百分比）
  fvgMaxSize: number;        // FVG 最大大小（百分比）

  // 入场规则
  entryFVGPercent: number;   // 入场位置（FVG 的百分比位置，0.5 表示中位）

  // 止损止盈
  stopLossBuffer: number;    // 止损缓冲（百分比）
  takeProfitTP1: number;     // 第一目标（百分比）
  takeProfitTP2: number;     // 第二目标（百分比）

  // 风险控制
  riskPercent: number;        // 单笔风险百分比
  maxConsecutiveLosses: number; // 最大连续亏损笔数
  cooldownBars: number;      // 冷却期K线数

  // 过滤条件
  minVolumeRatio: number;    // 最小成交量比
  filterSideways: boolean;   // 是否过滤震荡市
  adxThreshold: number;     // ADX 阈值（用于判断趋势强度）
}

export const DEFAULT_SMC_PARAMS: SMCLiquidityFVGParams = {
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
};

/**
 * 流动性结构
 */
interface LiquidityLevel {
  type: "high" | "low";
  price: number;
  timestamp: number;
  index: number;
}

/**
 * FVG 结构
 */
interface FVG {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  middle: number;
  timestamp: number;
  strength: number; // 强度评分
}

/**
 * 位移事件
 */
interface Displacement {
  type: "bullish" | "bearish";
  startTimestamp: number;
  endTimestamp: number;
  strength: number;
  fvgs: FVG[];
}

/**
 * 流动性扫荡事件
 */
interface LiquiditySweep {
  type: "bullish" | "bearish"; // 扫高为 bullish，扫低为 bearish
  sweepPrice: number;
  originalLiquidity: LiquidityLevel;
  sweepTimestamp: number;
  isConfirmed: boolean; // 是否确认假突破
}

export class SMCLiquidityFVGStrategy
  implements TradingStrategy<SMCLiquidityFVGParams>
{
  readonly meta: StrategyMeta = {
    id: "smc_liquidity_fvg",
    name: "SMC 流动性 + FVG 回踩",
    description:
      "基于 ICT/SMC 理论的智能资金策略。识别流动性扫荡、确认机构位移，通过 FVG 回踩进行低风险入场。",
    version: "1.0.0",
    category: "Smart Money Concepts",
    author: "Vibe Trading",
    timeframe: ["1m", "5m", "15m"],
    riskLevel: "high",
  };

  getDefaultParams(): SMCLiquidityFVGParams {
    return { ...DEFAULT_SMC_PARAMS };
  }

  getConfigItems() {
    return [
      {
        key: "mainTimeframe",
        label: "主周期（流动性识别）",
        type: "select" as const,
        defaultValue: "15m",
        options: [
          { value: "5m", label: "5 分钟" },
          { value: "15m", label: "15 分钟" },
          { value: "30m", label: "30 分钟" },
          { value: "1h", label: "1 小时" },
        ],
        description: "用于识别流动性区域的时间周期",
        category: "时间周期",
      },
      {
        key: "midTimeframe",
        label: "中周期（位移确认）",
        type: "select" as const,
        defaultValue: "5m",
        options: [
          { value: "1m", label: "1 分钟" },
          { value: "5m", label: "5 分钟" },
          { value: "15m", label: "15 分钟" },
        ],
        description: "用于确认位移的时间周期",
        category: "时间周期",
      },
      {
        key: "lowTimeframe",
        label: "低周期（入场）",
        type: "select" as const,
        defaultValue: "1m",
        options: [
          { value: "1m", label: "1 分钟" },
          { value: "5m", label: "5 分钟" },
        ],
        description: "用于 FVG 回踩入场的时间周期",
        category: "时间周期",
      },
      {
        key: "liquidityLookback",
        label: "流动性回看周期",
        type: "number" as const,
        defaultValue: 20,
        min: 10,
        max: 100,
        step: 5,
        description: "识别流动性时向前看的K线数量",
        category: "流动性识别",
      },
      {
        key: "liquidityTolerance",
        label: "流动性容差 (%)",
        type: "number" as const,
        defaultValue: 0.05,
        min: 0.01,
        max: 0.2,
        step: 0.01,
        description: "流动性扫荡的容差百分比",
        category: "流动性识别",
      },
      {
        key: "displacementThreshold",
        label: "位移阈值 (ATR倍数)",
        type: "number" as const,
        defaultValue: 1.5,
        min: 1.0,
        max: 3.0,
        step: 0.1,
        description: "位移强度的最小ATR倍数",
        category: "位移确认",
      },
      {
        key: "displacementMinBars",
        label: "最少连续K线数",
        type: "number" as const,
        defaultValue: 3,
        min: 2,
        max: 10,
        step: 1,
        description: "确认位移的最少连续同向K线数",
        category: "位移确认",
      },
      {
        key: "fvgMinSize",
        label: "FVG 最小大小 (%)",
        type: "number" as const,
        defaultValue: 0.01,
        min: 0.005,
        max: 0.05,
        step: 0.005,
        description: "FVG 的最小大小（相对于价格的百分比）",
        category: "FVG 识别",
      },
      {
        key: "fvgMaxSize",
        label: "FVG 最大大小 (%)",
        type: "number" as const,
        defaultValue: 0.5,
        min: 0.1,
        max: 2.0,
        step: 0.1,
        description: "FVG 的最大大小",
        category: "FVG 识别",
      },
      {
        key: "entryFVGPercent",
        label: "入场位置 (FVG %)",
        type: "number" as const,
        defaultValue: 0.5,
        min: 0.3,
        max: 0.7,
        step: 0.1,
        description: "在 FVG 的哪个位置入场（0.5 表示中位）",
        category: "入场规则",
      },
      {
        key: "stopLossBuffer",
        label: "止损缓冲 (%)",
        type: "number" as const,
        defaultValue: 0.01,
        min: 0.005,
        max: 0.05,
        step: 0.005,
        description: "止损设置在 FVG 边界之外的缓冲距离",
        category: "止损止盈",
      },
      {
        key: "takeProfitTP1",
        label: "第一目标 (%)",
        type: "number" as const,
        defaultValue: 0.8,
        min: 0.3,
        max: 2.0,
        step: 0.1,
        description: "第一止盈目标百分比",
        category: "止损止盈",
      },
      {
        key: "takeProfitTP2",
        label: "第二目标 (%)",
        type: "number" as const,
        defaultValue: 1.5,
        min: 0.5,
        max: 3.0,
        step: 0.1,
        description: "第二止盈目标百分比",
        category: "止损止盈",
      },
      {
        key: "riskPercent",
        label: "单笔风险 (%)",
        type: "number" as const,
        defaultValue: 1,
        min: 0.5,
        max: 2,
        step: 0.5,
        description: "单笔交易风险占账户余额的百分比",
        category: "风险控制",
      },
      {
        key: "maxConsecutiveLosses",
        label: "最大连续亏损",
        type: "number" as const,
        defaultValue: 3,
        min: 2,
        max: 5,
        step: 1,
        description: "触发冷却的最大连续亏损笔数",
        category: "风险控制",
      },
      {
        key: "minVolumeRatio",
        label: "最小成交量比",
        type: "number" as const,
        defaultValue: 1.2,
        min: 1.0,
        max: 2.0,
        step: 0.1,
        description: "位移时成交量需要大于平均成交量的倍数",
        category: "过滤条件",
      },
      {
        key: "filterSideways",
        label: "过滤震荡市",
        type: "checkbox" as const,
        defaultValue: true,
        description: "是否过滤震荡市场环境",
        category: "过滤条件",
      },
    ];
  }

  validateParams(params: SMCLiquidityFVGParams): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (params.riskPercent <= 0 || params.riskPercent > 5) {
      errors.push("风险百分比必须在 0-5% 之间");
    }
    if (params.fvgMinSize >= params.fvgMaxSize) {
      errors.push("FVG 最小大小必须小于最大大小");
    }
    if (params.displacementMinBars < 2) {
      errors.push("最少连续K线数不能小于2");
    }
    if (params.entryFVGPercent <= 0 || params.entryFVGPercent >= 1) {
      errors.push("入场位置必须在 0-1 之间");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  detectSignal(
    symbol: string,
    klines: KLineData[],
    params: SMCLiquidityFVGParams
  ): SignalDetectionResult {
    // 验证参数
    const validation = this.validateParams(params);
    if (!validation.valid) {
      return {
        signal: null,
        reason: `参数验证失败: ${validation.errors.join(", ")}`,
        details: "",
      };
    }

    // 确保有足够的数据
    const minBars = Math.max(
      params.liquidityLookback + 20,
      params.displacementMinBars + 10
    );
    if (klines.length < minBars) {
      return {
        signal: null,
        reason: `K线数据不足，需要至少 ${minBars} 根`,
        details: "",
      };
    }

    // 1. 识别流动性区域
    const liquidityLevels = this.identifyLiquidityLevels(klines, params);

    if (liquidityLevels.length === 0) {
      return {
        signal: null,
        reason: "未识别到流动性区域",
        details: "",
      };
    }

    // 2. 检测流动性扫荡
    const sweeps = this.detectLiquiditySweeps(
      klines,
      liquidityLevels,
      params
    );

    if (sweeps.length === 0) {
      return {
        signal: null,
        reason: "未检测到流动性扫荡",
        details: "",
      };
    }

    // 3. 确认假突破并查找最近的位移
    const latestSweep = sweeps[sweeps.length - 1];
    if (!latestSweep.isConfirmed) {
      return {
        signal: null,
        reason: "流动性扫荡未确认假突破",
        details: "",
      };
    }

    // 4. 检测位移（在扫荡之后）
    const displacement = this.detectDisplacement(
      klines,
      latestSweep,
      params
    );

    if (!displacement) {
      return {
        signal: null,
        reason: "未检测到有效位移",
        details: "",
      };
    }

    // 5. 识别 FVG
    if (displacement.fvgs.length === 0) {
      return {
        signal: null,
        reason: "位移过程中未形成 FVG",
        details: "",
      };
    }

    const latestFVG = displacement.fvgs[displacement.fvgs.length - 1];

    // 6. 检查价格是否回踩到 FVG 区域
    const currentKline = klines[klines.length - 1];
    const isInFVGZone = this.checkPriceInFVGZone(
      currentKline,
      latestFVG,
      params
    );

    if (!isInFVGZone) {
      return {
        signal: null,
        reason: "价格未回踩到 FVG 入场区域",
        details: `FVG 区域: [${latestFVG.bottom}, ${latestFVG.top}], 当前价格: ${currentKline.close}`,
      };
    }

    // 7. 应用过滤条件
    const filterReason = this.applyFilters(klines, params);
    if (filterReason) {
      return {
        signal: null,
        reason: filterReason,
        details: "",
      };
    }

    // 8. 生成交易信号
    const signal = this.generateSignal(
      symbol,
      latestSweep,
      displacement,
      latestFVG,
      currentKline,
      params
    );

    return {
      signal,
      reason: `检测到 ${signal.direction} 信号: ${signal.reason}`,
      details: this.generateSignalDetails(
        latestSweep,
        displacement,
        latestFVG,
        params
      ),
    };
  }

  /**
   * 识别流动性区域（前高/前低）
   */
  private identifyLiquidityLevels(
    klines: KLineData[],
    params: SMCLiquidityFVGParams
  ): LiquidityLevel[] {
    const levels: LiquidityLevel[] = [];
    const lookback = params.liquidityLookback;

    for (let i = lookback; i < klines.length - lookback; i++) {
      const current = klines[i];
      let isHigh = true;
      let isLow = true;

      // 检查是否为前高
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && klines[j].high > current.high) {
          isHigh = false;
        }
      }

      // 检查是否为前低
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && klines[j].low < current.low) {
          isLow = false;
        }
      }

      if (isHigh) {
        levels.push({
          type: "high",
          price: current.high,
          timestamp: current.timestamp,
          index: i,
        });
      }

      if (isLow) {
        levels.push({
          type: "low",
          price: current.low,
          timestamp: current.timestamp,
          index: i,
        });
      }
    }

    return levels;
  }

  /**
   * 检测流动性扫荡
   */
  private detectLiquiditySweeps(
    klines: KLineData[],
    liquidityLevels: LiquidityLevel[],
    params: SMCLiquidityFVGParams
  ): LiquiditySweep[] {
    const sweeps: LiquiditySweep[] = [];
    const tolerance = 1 + params.liquidityTolerance;

    // 从流动性区域之后开始检测
    for (const liquidity of liquidityLevels) {
      // 检查流动性区域之后是否有K线突破
      for (let i = liquidity.index + 1; i < klines.length; i++) {
        const kline = klines[i];

        // 检查扫高
        if (liquidity.type === "high" && kline.high > liquidity.price * tolerance) {
          // 检查是否是假突破（收盘价未站稳）
          const isFakeBreakout = kline.close < liquidity.price * tolerance;

          sweeps.push({
            type: "bullish", // 扫高，预期看跌
            sweepPrice: kline.high,
            originalLiquidity: liquidity,
            sweepTimestamp: kline.timestamp,
            isConfirmed: isFakeBreakout,
          });
          break;
        }

        // 检查扫低
        if (liquidity.type === "low" && kline.low < liquidity.price / tolerance) {
          // 检查是否是假突破（收盘价未跌破）
          const isFakeBreakout = kline.close > liquidity.price / tolerance;

          sweeps.push({
            type: "bearish", // 扫低，预期看涨
            sweepPrice: kline.low,
            originalLiquidity: liquidity,
            sweepTimestamp: kline.timestamp,
            isConfirmed: isFakeBreakout,
          });
          break;
        }
      }
    }

    return sweeps;
  }

  /**
   * 检测位移
   */
  private detectDisplacement(
    klines: KLineData[],
    sweep: LiquiditySweep,
    params: SMCLiquidityFVGParams
  ): Displacement | null {
    const startIndex = sweep.originalLiquidity.index + 1;
    const atr = this.calculateATR(klines, 14);
    const threshold = atr * params.displacementThreshold;

    // 寻找扫荡之后的大实体或连续同向K线
    for (let i = startIndex; i < klines.length; i++) {
      // 扫高之后预期看跌（bearish displacement）
      if (sweep.type === "bullish") {
        const bearishBars = this.countConsecutiveBars(
          klines,
          i,
          "bearish",
          params.displacementMinBars
        );

        if (bearishBars.length >= params.displacementMinBars) {
          // 检查位移强度
          const strength = this.calculateDisplacementStrength(
            klines,
            bearishBars
          );

          if (strength >= threshold) {
            // 识别位移过程中的 FVG
            const fvgs = this.identifyFVGsInDisplacement(
              klines,
              bearishBars,
              params
            );

            return {
              type: "bearish",
              startTimestamp: klines[bearishBars[0]].timestamp,
              endTimestamp: klines[bearishBars[bearishBars.length - 1]].timestamp,
              strength,
              fvgs,
            };
          }
        }
      }

      // 扫低之后预期看涨（bullish displacement）
      if (sweep.type === "bearish") {
        const bullishBars = this.countConsecutiveBars(
          klines,
          i,
          "bullish",
          params.displacementMinBars
        );

        if (bullishBars.length >= params.displacementMinBars) {
          const strength = this.calculateDisplacementStrength(
            klines,
            bullishBars
          );

          if (strength >= threshold) {
            const fvgs = this.identifyFVGsInDisplacement(
              klines,
              bullishBars,
              params
            );

            return {
              type: "bullish",
              startTimestamp: klines[bullishBars[0]].timestamp,
              endTimestamp: klines[bullishBars[bullishBars.length - 1]].timestamp,
              strength,
              fvgs,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * 统计连续同向K线
   */
  private countConsecutiveBars(
    klines: KLineData[],
    startIndex: number,
    direction: "bullish" | "bearish",
    minBars: number
  ): number[] {
    const indices: number[] = [];
    let consecutiveCount = 0;

    for (let i = startIndex; i < klines.length; i++) {
      const kline = klines[i];
      const isBullish = kline.close > kline.open;
      const isBearish = kline.close < kline.open;

      if (direction === "bullish" && isBullish) {
        indices.push(i);
        consecutiveCount++;
      } else if (direction === "bearish" && isBearish) {
        indices.push(i);
        consecutiveCount++;
      } else {
        if (consecutiveCount >= minBars) {
          break;
        }
        consecutiveCount = 0;
        indices.length = 0;
      }
    }

    return indices.length >= minBars ? indices : [];
  }

  /**
   * 计算位移强度
   */
  private calculateDisplacementStrength(
    klines: KLineData[],
    barIndices: number[]
  ): number {
    if (barIndices.length === 0) return 0;

    const firstBar = klines[barIndices[0]];
    const lastBar = klines[barIndices[barIndices.length - 1]];

    return Math.abs(lastBar.close - firstBar.open);
  }

  /**
   * 识别位移过程中的 FVG
   */
  private identifyFVGsInDisplacement(
    klines: KLineData[],
    barIndices: number[],
    params: SMCLiquidityFVGParams
  ): FVG[] {
    const fvgs: FVG[] = [];

    for (let i = 1; i < barIndices.length; i++) {
      const bar1 = klines[barIndices[i - 1]];
      const bar3 = klines[barIndices[i]];

      // 看涨 FVG：K1 高点 < K3 低点
      if (bar1.high < bar3.low) {
        const top = bar3.low;
        const bottom = bar1.high;
        const size = (top - bottom) / bar1.close;

        if (size >= params.fvgMinSize && size <= params.fvgMaxSize) {
          fvgs.push({
            type: "bullish",
            top,
            bottom,
            middle: (top + bottom) / 2,
            timestamp: bar3.timestamp,
            strength: size,
          });
        }
      }

      // 看跌 FVG：K1 低点 > K3 高点
      if (bar1.low > bar3.high) {
        const top = bar1.low;
        const bottom = bar3.high;
        const size = (top - bottom) / bar1.close;

        if (size >= params.fvgMinSize && size <= params.fvgMaxSize) {
          fvgs.push({
            type: "bearish",
            top,
            bottom,
            middle: (top + bottom) / 2,
            timestamp: bar3.timestamp,
            strength: size,
          });
        }
      }
    }

    return fvgs;
  }

  /**
   * 检查价格是否在 FVG 入场区域
   */
  private checkPriceInFVGZone(
    kline: KLineData,
    fvg: FVG,
    params: SMCLiquidityFVGParams
  ): boolean {
    const entryPrice =
      fvg.bottom + (fvg.top - fvg.bottom) * params.entryFVGPercent;
    const tolerance = entryPrice * 0.002; // 0.2% 容差

    return Math.abs(kline.close - entryPrice) <= tolerance;
  }

  /**
   * 应用过滤条件
   */
  private applyFilters(
    klines: KLineData[],
    params: SMCLiquidityFVGParams
  ): string | null {
    // 成交量过滤
    const recentBars = klines.slice(-10);
    const avgVolume =
      recentBars.reduce((sum, bar) => sum + bar.volume, 0) / recentBars.length;
    const lastBar = klines[klines.length - 1];

    if (lastBar.volume < avgVolume * params.minVolumeRatio) {
      return "成交量不足";
    }

    // 震荡市过滤（使用 ATR 相对于价格的比例）
    if (params.filterSideways) {
      const atr = this.calculateATR(klines, 14);
      const atrPercent = atr / klines[klines.length - 1].close;

      if (atrPercent < 0.002) {
        return "震荡市场，ATR 过小";
      }
    }

    return null;
  }

  /**
   * 生成交易信号
   */
  private generateSignal(
    symbol: string,
    sweep: LiquiditySweep,
    displacement: Displacement,
    fvg: FVG,
    kline: KLineData,
    params: SMCLiquidityFVGParams
  ): Signal {
    const direction = fvg.type === "bullish" ? "long" : "short";
    const entryPrice =
      fvg.bottom + (fvg.top - fvg.bottom) * params.entryFVGPercent;

    let stopLoss: number;
    let takeProfit1: number;
    let takeProfit2: number;

    if (direction === "long") {
      stopLoss = fvg.bottom * (1 - params.stopLossBuffer);
      takeProfit1 = entryPrice * (1 + params.takeProfitTP1 / 100);
      takeProfit2 = entryPrice * (1 + params.takeProfitTP2 / 100);
    } else {
      stopLoss = fvg.top * (1 + params.stopLossBuffer);
      takeProfit1 = entryPrice * (1 - params.takeProfitTP1 / 100);
      takeProfit2 = entryPrice * (1 - params.takeProfitTP2 / 100);
    }

    const reason = `流动性扫荡 + 位移确认，FVG 回踩入场`;
    const confidence = Math.min(
      0.6 + fvg.strength * 10,
      0.95
    );

    return {
      symbol,
      direction,
      time: kline.timestamp,
      reason,
      confidence,
      entryPrice,
    };
  }

  /**
   * 生成信号详情
   */
  private generateSignalDetails(
    sweep: LiquiditySweep,
    displacement: Displacement,
    fvg: FVG,
    params: SMCLiquidityFVGParams
  ): string {
    const details = [
      `流动性类型: ${sweep.originalLiquidity.type}`,
      `扫荡价格: ${sweep.sweepPrice}`,
      `位移类型: ${displacement.type}`,
      `位移强度: ${displacement.strength.toFixed(2)}`,
      `FVG 类型: ${fvg.type}`,
      `FVG 区域: [${fvg.bottom.toFixed(2)}, ${fvg.top.toFixed(2)}]`,
      `FVG 强度: ${(fvg.strength * 100).toFixed(2)}%`,
      `入场位置: ${((fvg.bottom + (fvg.top - fvg.bottom) * params.entryFVGPercent)).toFixed(2)}`,
    ];

    return details.join(" | ");
  }

  /**
   * 计算 ATR（平均真实波幅）
   */
  private calculateATR(klines: KLineData[], period: number): number {
    if (klines.length < period + 1) return 0;

    let sum = 0;
    for (let i = klines.length - period; i < klines.length; i++) {
      const high = klines[i].high;
      const low = klines[i].low;
      const prevClose = i > 0 ? klines[i - 1].close : klines[i].open;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      sum += tr;
    }

    return sum / period;
  }

  // ============ 回测需要的辅助方法 ============

  /**
   * 回测：检查是否触发入场
   */
  public checkBacktestEntry(
    klines: KLineData[],
    index: number,
    signal: Signal,
    params: SMCLiquidityFVGParams
  ): boolean {
    if (index >= klines.length) return false;

    const kline = klines[index];
    const tolerance = signal.entryPrice * 0.002;

    if (signal.direction === "long") {
      return kline.low <= signal.entryPrice + tolerance;
    } else {
      return kline.high >= signal.entryPrice - tolerance;
    }
  }

  /**
   * 回测：计算止盈止损
   */
  public calculateBacktestExit(
    entryPrice: number,
    direction: "long" | "short",
    klines: KLineData[],
    startIndex: number,
    params: SMCLiquidityFVGParams
  ): {
    exitIndex: number;
    exitPrice: number;
    exitType: "stop_loss" | "take_profit" | "timeout";
  } {
    const stopLoss =
      direction === "long"
        ? entryPrice * (1 - params.stopLossBuffer)
        : entryPrice * (1 + params.stopLossBuffer);
    const takeProfit1 =
      direction === "long"
        ? entryPrice * (1 + params.takeProfitTP1 / 100)
        : entryPrice * (1 - params.takeProfitTP1 / 100);

    // 最多持仓 100 根 K 线
    const maxBars = 100;

    for (let i = startIndex; i < Math.min(startIndex + maxBars, klines.length); i++) {
      const kline = klines[i];

      if (direction === "long") {
        if (kline.low <= stopLoss) {
          return {
            exitIndex: i,
            exitPrice: stopLoss,
            exitType: "stop_loss",
          };
        }
        if (kline.high >= takeProfit1) {
          return {
            exitIndex: i,
            exitPrice: takeProfit1,
            exitType: "take_profit",
          };
        }
      } else {
        if (kline.high >= stopLoss) {
          return {
            exitIndex: i,
            exitPrice: stopLoss,
            exitType: "stop_loss",
          };
        }
        if (kline.low <= takeProfit1) {
          return {
            exitIndex: i,
            exitPrice: takeProfit1,
            exitType: "take_profit",
          };
        }
      }
    }

    // 超时退出
    return {
      exitIndex: Math.min(startIndex + maxBars, klines.length) - 1,
      exitPrice: klines[Math.min(startIndex + maxBars, klines.length) - 1].close,
      exitType: "timeout",
    };
  }

  /**
   * 回测：检测历史信号（简化版本）
   */
  public detectHistoricalSignals(
    klines: KLineData[],
    params: SMCLiquidityFVGParams
  ): Array<{ signal: Signal; startIndex: number }> {
    const signals: Array<{ signal: Signal; startIndex: number }> = [];
    const minBars = Math.max(
      params.liquidityLookback + 20,
      params.displacementMinBars + 10
    );

    for (let i = minBars; i < klines.length; i++) {
      const historicalKlines = klines.slice(0, i);
      const result = this.detectSignal("symbol", historicalKlines, params);

      if (result.signal) {
        signals.push({
          signal: result.signal,
          startIndex: i,
        });
      }
    }

    return signals;
  }
}
