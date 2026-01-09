/**
 * 多时间框架数据对齐工具
 * 用于将不同周期的K线数据对齐到同一时间轴
 */

import { KLineData } from "../types/strategy";

export interface AlignedTimeframe {
  mainIndex: number;     // 主周期数据索引
  midIndex: number;      // 中周期数据索引
  lowIndex: number;      // 低周期数据索引
  timestamp: number;     // 对齐的时间戳
}

/**
 * 时间周期到毫秒的映射
 */
export const TIMEFRAME_TO_MS: Record<string, number> = {
  "1m": 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

/**
 * 计算两个时间周期的倍数关系
 */
export function getTimeframeRatio(
  largerTimeframe: string,
  smallerTimeframe: string
): number {
  const largerMs = TIMEFRAME_TO_MS[largerTimeframe];
  const smallerMs = TIMEFRAME_TO_MS[smallerTimeframe];

  if (!largerMs || !smallerMs) {
    throw new Error(`Invalid timeframe: ${largerTimeframe} or ${smallerTimeframe}`);
  }

  return largerMs / smallerMs;
}

/**
 * 获取K线数据所属的周期开始时间戳
 * 例如：对于 5m 周期，返回最近一个5分钟整点的时间戳
 */
export function getBarStartTime(timestamp: number, timeframe: string): number {
  const ms = TIMEFRAME_TO_MS[timeframe];
  if (!ms) {
    throw new Error(`Invalid timeframe: ${timeframe}`);
  }

  return Math.floor(timestamp / ms) * ms;
}

/**
 * 生成对齐的多时间框架索引映射
 *
 * @param mainKlines 主周期K线数据
 * @param midKlines 中周期K线数据
 * @param lowKlines 低周期K线数据
 * @param mainTimeframe 主周期名称
 * @param midTimeframe 中周期名称
 * @param lowTimeframe 低周期名称
 * @returns 对齐后的索引数组
 */
export function alignTimeframes(
  mainKlines: KLineData[],
  midKlines: KLineData[],
  lowKlines: KLineData[],
  mainTimeframe: string,
  midTimeframe: string,
  lowTimeframe: string
): AlignedTimeframe[] {
  const aligned: AlignedTimeframe[] = [];

  // 以低周期数据为基础进行对齐（最小时间单位）
  const mainRatio = getTimeframeRatio(mainTimeframe, lowTimeframe);
  const midRatio = getTimeframeRatio(midTimeframe, lowTimeframe);

  // 为每个低周期K线找到对应的中周期和主周期K线
  for (let lowIndex = 0; lowIndex < lowKlines.length; lowIndex++) {
    const lowKline = lowKlines[lowIndex];
    const lowTimestamp = getBarStartTime(lowKline.timestamp, lowTimeframe);

    // 找到对应的中周期K线索引
    let midIndex = -1;
    for (let i = 0; i < midKlines.length; i++) {
      const midTimestamp = getBarStartTime(midKlines[i].timestamp, midTimeframe);
      if (Math.abs(midTimestamp - lowTimestamp) < TIMEFRAME_TO_MS[midTimeframe] / 2) {
        midIndex = i;
        break;
      }
    }

    // 找到对应的主周期K线索引
    let mainIndex = -1;
    for (let i = 0; i < mainKlines.length; i++) {
      const mainTimestamp = getBarStartTime(mainKlines[i].timestamp, mainTimeframe);
      if (Math.abs(mainTimestamp - lowTimestamp) < TIMEFRAME_TO_MS[mainTimeframe] / 2) {
        mainIndex = i;
        break;
      }
    }

    aligned.push({
      mainIndex,
      midIndex,
      lowIndex,
      timestamp: lowTimestamp,
    });
  }

  return aligned;
}

/**
 * 从对齐的时间框架中提取特定时间窗口的数据
 *
 * @param aligned 对齐的时间框架数组
 * @param startIndex 开始索引（低周期索引）
 * @param lookback 回看数量（低周期K线数量）
 * @returns 时间窗口内的对齐数据
 */
export function getTimeWindow(
  aligned: AlignedTimeframe[],
  startIndex: number,
  lookback: number
): AlignedTimeframe[] {
  const window = [];
  for (let i = Math.max(0, startIndex - lookback + 1); i <= startIndex; i++) {
    if (i < aligned.length) {
      window.push(aligned[i]);
    }
  }
  return window;
}

/**
 * 检查主周期K线是否更新（新的主周期K线开始）
 *
 * @param aligned 对齐的时间框架数组
 * @param currentIndex 当前索引
 * @returns 是否主周期K线更新
 */
export function isMainBarUpdated(
  aligned: AlignedTimeframe[],
  currentIndex: number
): boolean {
  if (currentIndex === 0) return true;
  const prev = aligned[currentIndex - 1];
  const curr = aligned[currentIndex];
  return prev.mainIndex !== curr.mainIndex;
}

/**
 * 检查中周期K线是否更新
 *
 * @param aligned 对齐的时间框架数组
 * @param currentIndex 当前索引
 * @returns 是否中周期K线更新
 */
export function isMidBarUpdated(
  aligned: AlignedTimeframe[],
  currentIndex: number
): boolean {
  if (currentIndex === 0) return true;
  const prev = aligned[currentIndex - 1];
  const curr = aligned[currentIndex];
  return prev.midIndex !== curr.midIndex;
}

/**
 * 获取当前主周期K线及其历史数据
 *
 * @param aligned 对齐的时间框架数组
 * @param currentIndex 当前索引
 * @param mainKlines 主周期K线数据
 * @param lookback 回看数量
 * @returns 主周期K线切片
 */
export function getMainBars(
  aligned: AlignedTimeframe[],
  currentIndex: number,
  mainKlines: KLineData[],
  lookback: number
): KLineData[] {
  const mainIndex = aligned[currentIndex].mainIndex;
  if (mainIndex < 0) return [];

  const startIndex = Math.max(0, mainIndex - lookback + 1);
  return mainKlines.slice(startIndex, mainIndex + 1);
}

/**
 * 获取当前中周期K线及其历史数据
 *
 * @param aligned 对齐的时间框架数组
 * @param currentIndex 当前索引
 * @param midKlines 中周期K线数据
 * @param lookback 回看数量
 * @returns 中周期K线切片
 */
export function getMidBars(
  aligned: AlignedTimeframe[],
  currentIndex: number,
  midKlines: KLineData[],
  lookback: number
): KLineData[] {
  const midIndex = aligned[currentIndex].midIndex;
  if (midIndex < 0) return [];

  const startIndex = Math.max(0, midIndex - lookback + 1);
  return midKlines.slice(startIndex, midIndex + 1);
}

/**
 * 获取当前低周期K线及其历史数据
 *
 * @param aligned 对齐的时间框架数组
 * @param currentIndex 当前索引
 * @param lowKlines 低周期K线数据
 * @param lookback 回看数量
 * @returns 低周期K线切片
 */
export function getLowBars(
  aligned: AlignedTimeframe[],
  currentIndex: number,
  lowKlines: KLineData[],
  lookback: number
): KLineData[] {
  const lowIndex = aligned[currentIndex].lowIndex;
  if (lowIndex < 0) return [];

  const startIndex = Math.max(0, lowIndex - lookback + 1);
  return lowKlines.slice(startIndex, lowIndex + 1);
}

/**
 * 从对齐数据中获取所有有效的时间戳（低周期）
 *
 * @param aligned 对齐的时间框架数组
 * @returns 时间戳数组
 */
export function getTimestamps(aligned: AlignedTimeframe[]): number[] {
  return aligned.map(a => a.timestamp);
}

/**
 * 计算低周期K线距离主周期K线开始的进度（0-1）
 *
 * @param aligned 对齐的时间框架数组
 * @param currentIndex 当前索引
 * @param lowTimeframe 低周期名称
 * @param mainTimeframe 主周期名称
 * @returns 进度（0-1）
 */
export function getMainBarProgress(
  aligned: AlignedTimeframe[],
  currentIndex: number,
  lowTimeframe: string,
  mainTimeframe: string
): number {
  if (currentIndex === 0) return 0;

  const lowMs = TIMEFRAME_TO_MS[lowTimeframe];
  const mainMs = TIMEFRAME_TO_MS[mainTimeframe];
  const ratio = mainMs / lowMs;

  const current = aligned[currentIndex];
  const prevMainStart = aligned
    .slice(0, currentIndex)
    .reverse()
    .find(a => a.mainIndex !== current.mainIndex);

  if (!prevMainStart) {
    // 第一个主周期K线
    return (current.lowIndex + 1) / ratio;
  }

  const barsSinceMainStart = current.lowIndex - prevMainStart.lowIndex;
  return barsSinceMainStart / ratio;
}

/**
 * 将低周期索引转换为主周期索引
 *
 * @param lowIndex 低周期索引
 * @param mainTimeframe 主周期名称
 * @param lowTimeframe 低周期名称
 * @returns 主周期索引
 */
export function lowIndexToMainIndex(
  lowIndex: number,
  mainTimeframe: string,
  lowTimeframe: string
): number {
  const ratio = getTimeframeRatio(mainTimeframe, lowTimeframe);
  return Math.floor(lowIndex / ratio);
}

/**
 * 将低周期索引转换为中周期索引
 *
 * @param lowIndex 低周期索引
 * @param midTimeframe 中周期名称
 * @param lowTimeframe 低周期名称
 * @returns 中周期索引
 */
export function lowIndexToMidIndex(
  lowIndex: number,
  midTimeframe: string,
  lowTimeframe: string
): number {
  const ratio = getTimeframeRatio(midTimeframe, lowTimeframe);
  return Math.floor(lowIndex / ratio);
}
