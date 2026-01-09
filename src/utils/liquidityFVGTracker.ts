/**
 * 流动性跟踪和 FVG 监控器
 * 用于持续跟踪流动性状态和 FVG 情况
 */

import { KLineData } from "../types/strategy";

/**
 * 流动性水平结构
 */
export interface LiquidityLevel {
  type: "high" | "low";
  price: number;
  timestamp: number;
  index: number;
  active: boolean;       // 是否未被扫荡
  sweptAt?: number;      // 被扫荡的时间戳
  sweepPrice?: number;   // 扫荡价格
  confirmed?: boolean;   // 是否确认假突破
}

/**
 * FVG 结构
 */
export interface FVG {
  id: string;
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  middle: number;
  timestamp: number;
  startIndex: number;
  endIndex: number;
  strength: number;
  filled: boolean;        // 是否被回补
  filledAt?: number;      // 回补时间戳
  targetPrice?: number;   // 目标价格（流动性位置）
}

/**
 * 流动性扫荡事件
 */
export interface LiquiditySweep {
  type: "bullish" | "bearish";
  sweepPrice: number;
  originalLiquidity: LiquidityLevel;
  sweepTimestamp: number;
  confirmed: boolean;
  relatedFVGs: FVG[];
}

/**
 * 位移事件
 */
export interface Displacement {
  type: "bullish" | "bearish";
  startTimestamp: number;
  endTimestamp: number;
  startIndex: number;
  endIndex: number;
  strength: number;
  fvgs: FVG[];
}

/**
 * 流动性和 FVG 跟踪器
 */
export class LiquidityFVGTracker {
  private liquidityLevels: Map<number, LiquidityLevel[]>; // 按时间戳索引的流动性
  private activeFVGs: Map<string, FVG>; // 活跃的 FVG
  private sweeps: LiquiditySweep[];
  private displacements: Displacement[];
  private lastProcessedIndex: number;

  constructor() {
    this.liquidityLevels = new Map();
    this.activeFVGs = new Map();
    this.sweeps = [];
    this.displacements = [];
    this.lastProcessedIndex = -1;
  }

  /**
   * 处理新的K线数据
   *
   * @param klines K线数据
   * @param lookback 识别流动性时的回看周期
   * @param tolerance 流动性容差（百分比）
   */
  public process(klines: KLineData[], lookback: number, tolerance: number): void {
    // 只处理新的K线
    for (let i = this.lastProcessedIndex + 1; i < klines.length; i++) {
      this.processBar(klines, i, lookback, tolerance);
    }
    this.lastProcessedIndex = klines.length - 1;

    // 检查 FVG 是否被回补
    this.checkFVGsFilled(klines);
  }

  /**
   * 处理单个K线
   */
  private processBar(
    klines: KLineData[],
    index: number,
    lookback: number,
    tolerance: number
  ): void {
    if (index < lookback) return;

    const kline = klines[index];

    // 1. 识别新的流动性水平
    this.identifyLiquidityLevels(klines, index, lookback);

    // 2. 检查流动性是否被扫荡
    this.checkLiquiditySweeps(klines, index, tolerance);

    // 3. 识别新的 FVG
    this.identifyFVG(klines, index);

    // 4. 检测位移
    this.detectDisplacement(klines, index);
  }

  /**
   * 识别流动性水平
   */
  private identifyLiquidityLevels(
    klines: KLineData[],
    index: number,
    lookback: number
  ): void {
    const current = klines[index];
    let isHigh = true;
    let isLow = true;

    // 检查是否为前高
    for (let j = Math.max(0, index - lookback); j <= Math.min(klines.length - 1, index + lookback); j++) {
      if (j !== index && klines[j].high > current.high) {
        isHigh = false;
      }
    }

    // 检查是否为前低
    for (let j = Math.max(0, index - lookback); j <= Math.min(klines.length - 1, index + lookback); j++) {
      if (j !== index && klines[j].low < current.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      const level: LiquidityLevel = {
        type: "high",
        price: current.high,
        timestamp: current.timestamp,
        index,
        active: true,
      };
      this.addLiquidityLevel(current.timestamp, level);
    }

    if (isLow) {
      const level: LiquidityLevel = {
        type: "low",
        price: current.low,
        timestamp: current.timestamp,
        index,
        active: true,
      };
      this.addLiquidityLevel(current.timestamp, level);
    }
  }

  /**
   * 添加流动性水平
   */
  private addLiquidityLevel(timestamp: number, level: LiquidityLevel): void {
    if (!this.liquidityLevels.has(timestamp)) {
      this.liquidityLevels.set(timestamp, []);
    }
    this.liquidityLevels.get(timestamp)!.push(level);
  }

  /**
   * 检查流动性扫荡
   */
  private checkLiquiditySweeps(
    klines: KLineData[],
    currentIndex: number,
    tolerance: number
  ): void {
    const current = klines[currentIndex];
    const toleranceMultiplier = 1 + tolerance;

    // 获取所有活跃的流动性
    const allLevels = Array.from(this.liquidityLevels.values()).flat();
    const activeLevels = allLevels.filter(l => l.active);

    for (const level of activeLevels) {
      // 扫高
      if (level.type === "high" && current.high > level.price * toleranceMultiplier) {
        level.active = false;
        level.sweptAt = current.timestamp;
        level.sweepPrice = current.high;

        // 检查是否是假突破（收盘价未站稳）
        const isFakeBreakout = current.close < level.price * toleranceMultiplier;
        level.confirmed = isFakeBreakout;

        this.sweeps.push({
          type: "bullish",
          sweepPrice: current.high,
          originalLiquidity: level,
          sweepTimestamp: current.timestamp,
          confirmed: isFakeBreakout,
          relatedFVGs: [],
        });
      }

      // 扫低
      if (level.type === "low" && current.low < level.price / toleranceMultiplier) {
        level.active = false;
        level.sweptAt = current.timestamp;
        level.sweepPrice = current.low;

        // 检查是否是假突破（收盘价未跌破）
        const isFakeBreakout = current.close > level.price / toleranceMultiplier;
        level.confirmed = isFakeBreakout;

        this.sweeps.push({
          type: "bearish",
          sweepPrice: current.low,
          originalLiquidity: level,
          sweepTimestamp: current.timestamp,
          confirmed: isFakeBreakout,
          relatedFVGs: [],
        });
      }
    }
  }

  /**
   * 识别 FVG
   */
  private identifyFVG(klines: KLineData[], index: number): void {
    if (index < 2) return;

    const k1 = klines[index - 2];
    const k2 = klines[index - 1];
    const k3 = klines[index];

    // 看涨 FVG：K1 高点 < K3 低点
    if (k1.high < k3.low) {
      const top = k3.low;
      const bottom = k1.high;
      const strength = (top - bottom) / k1.close;

      const fvg: FVG = {
        id: `${k3.timestamp}_bullish`,
        type: "bullish",
        top,
        bottom,
        middle: (top + bottom) / 2,
        timestamp: k3.timestamp,
        startIndex: index - 2,
        endIndex: index,
        strength,
        filled: false,
      };

      this.activeFVGs.set(fvg.id, fvg);
    }

    // 看跌 FVG：K1 低点 > K3 高点
    if (k1.low > k3.high) {
      const top = k1.low;
      const bottom = k3.high;
      const strength = (top - bottom) / k1.close;

      const fvg: FVG = {
        id: `${k3.timestamp}_bearish`,
        type: "bearish",
        top,
        bottom,
        middle: (top + bottom) / 2,
        timestamp: k3.timestamp,
        startIndex: index - 2,
        endIndex: index,
        strength,
        filled: false,
      };

      this.activeFVGs.set(fvg.id, fvg);
    }
  }

  /**
   * 检测位移
   */
  private detectDisplacement(klines: KLineData[], index: number): void {
    if (this.sweeps.length === 0) return;

    const latestSweep = this.sweeps[this.sweeps.length - 1];
    if (!latestSweep.confirmed) return;

    // 检查扫荡之后是否有位移
    const startIndex = latestSweep.originalLiquidity.index + 1;
    if (index < startIndex + 3) return;

    // 计算ATR
    const atr = this.calculateATR(klines, 14, index);
    const threshold = atr * 1.5;

    // 检查连续同向K线
    const direction = latestSweep.type === "bullish" ? "bearish" : "bullish";
    const consecutiveBars = this.findConsecutiveBars(
      klines,
      startIndex,
      index,
      direction,
      3
    );

    if (consecutiveBars.length >= 3) {
      const firstBar = klines[consecutiveBars[0]];
      const lastBar = klines[consecutiveBars[consecutiveBars.length - 1]];
      const strength = Math.abs(lastBar.close - firstBar.open);

      if (strength >= threshold) {
        // 查找相关的FVG
        const relatedFVGs = Array.from(this.activeFVGs.values()).filter(
          fvg =>
            fvg.startIndex >= startIndex &&
            fvg.endIndex <= index &&
            fvg.type === direction
        );

        const displacement: Displacement = {
          type: direction,
          startTimestamp: firstBar.timestamp,
          endTimestamp: lastBar.timestamp,
          startIndex: consecutiveBars[0],
          endIndex: consecutiveBars[consecutiveBars.length - 1],
          strength,
          fvgs: relatedFVGs,
        };

        // 更新最近的扫荡事件的FVG
        latestSweep.relatedFVGs = relatedFVGs;
        this.displacements.push(displacement);
      }
    }
  }

  /**
   * 查找连续同向K线
   */
  private findConsecutiveBars(
    klines: KLineData[],
    startSearch: number,
    endIndex: number,
    direction: "bullish" | "bearish",
    minBars: number
  ): number[] {
    const indices: number[] = [];
    let consecutiveCount = 0;

    for (let i = startSearch; i <= endIndex; i++) {
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
   * 检查 FVG 是否被回补
   */
  private checkFVGsFilled(klines: KLineData[]): void {
    const lastKline = klines[klines.length - 1];

    for (const fvg of this.activeFVGs.values()) {
      if (fvg.filled) continue;

      // 看涨 FVG 被回补：价格跌到 FVG 下方
      if (fvg.type === "bullish" && lastKline.low <= fvg.bottom) {
        fvg.filled = true;
        fvg.filledAt = lastKline.timestamp;
      }

      // 看跌 FVG 被回补：价格涨到 FVG 上方
      if (fvg.type === "bearish" && lastKline.high >= fvg.top) {
        fvg.filled = true;
        fvg.filledAt = lastKline.timestamp;
      }
    }

    // 移除已回补且超过一定时间的 FVG
    const now = Date.now();
    for (const [id, fvg] of this.activeFVGs.entries()) {
      if (fvg.filled && fvg.filledAt && now - fvg.filledAt > 24 * 60 * 60 * 1000) {
        this.activeFVGs.delete(id);
      }
    }
  }

  /**
   * 计算 ATR
   */
  private calculateATR(klines: KLineData[], period: number, endIndex: number): number {
    if (endIndex < period) return 0;

    let sum = 0;
    for (let i = endIndex - period + 1; i <= endIndex; i++) {
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

  /**
   * 获取所有活跃的流动性
   */
  public getActiveLiquidityLevels(): LiquidityLevel[] {
    return Array.from(this.liquidityLevels.values())
      .flat()
      .filter(l => l.active);
  }

  /**
   * 获取所有活跃的 FVG
   */
  public getActiveFVGs(): FVG[] {
    return Array.from(this.activeFVGs.values()).filter(fvg => !fvg.filled);
  }

  /**
   * 获取最近的扫荡事件
   */
  public getRecentSweeps(count: number = 5): LiquiditySweep[] {
    return this.sweeps.slice(-count);
  }

  /**
   * 获取最近的位移事件
   */
  public getRecentDisplacements(count: number = 5): Displacement[] {
    return this.displacements.slice(-count);
  }

  /**
   * 检查价格是否在某个 FVG 的入场区域
   */
  public checkPriceInFVGZone(
    price: number,
    fvgMinSize: number,
    fvgMaxSize: number,
    entryPercent: number = 0.5,
    tolerance: number = 0.002
  ): FVG | null {
    const activeFVGs = this.getActiveFVGs();

    for (const fvg of activeFVGs) {
      const size = (fvg.top - fvg.bottom) / fvg.bottom;

      // 过滤FVG大小
      if (size < fvgMinSize || size > fvgMaxSize) continue;

      const entryPrice = fvg.bottom + (fvg.top - fvg.bottom) * entryPercent;

      // 检查是否在入场区域
      if (Math.abs(price - entryPrice) <= entryPrice * tolerance) {
        return fvg;
      }
    }

    return null;
  }

  /**
   * 获取与特定价格相关的 FVG
   */
  public getFVGsNearPrice(
    price: number,
    tolerancePercent: number = 0.1
  ): FVG[] {
    const activeFVGs = this.getActiveFVGs();
    const tolerance = price * tolerancePercent;

    return activeFVGs.filter(
      fvg =>
        price >= fvg.bottom - tolerance &&
        price <= fvg.top + tolerance
    );
  }

  /**
   * 清空所有数据
   */
  public clear(): void {
    this.liquidityLevels.clear();
    this.activeFVGs.clear();
    this.sweeps = [];
    this.displacements = [];
    this.lastProcessedIndex = -1;
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    const activeLiquidity = this.getActiveLiquidityLevels();
    const activeFVGs = this.getActiveFVGs();
    const recentSweeps = this.getRecentSweeps(10);
    const recentDisplacements = this.getRecentDisplacements(10);

    return {
      totalLiquidity: Array.from(this.liquidityLevels.values()).flat().length,
      activeLiquidityCount: activeLiquidity.length,
      activeFVGsCount: activeFVGs.length,
      totalSweeps: this.sweeps.length,
      confirmedSweeps: this.sweeps.filter(s => s.confirmed).length,
      totalDisplacements: this.displacements.length,
      recentSweeps,
      recentDisplacements,
    };
  }
}
