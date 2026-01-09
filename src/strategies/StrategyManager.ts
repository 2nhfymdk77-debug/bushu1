import {
  TradingStrategy,
  StrategyMeta,
  BaseStrategyParams,
  SignalDetectionResult,
  KLineData,
} from "../types/strategy";
import { SMCLiquidityFVGStrategy } from "./SMCLiquidityFVGStrategy";

/**
 * 策略管理器（单例）
 * 负责策略的注册、查询、切换和调用
 */
export class StrategyManager {
  private static instance: StrategyManager;
  private strategies: Map<string, TradingStrategy<any>>;

  private constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): StrategyManager {
    if (!StrategyManager.instance) {
      StrategyManager.instance = new StrategyManager();
    }
    return StrategyManager.instance;
  }

  /**
   * 注册默认策略
   */
  private registerDefaultStrategies(): void {
    this.register("smc_liquidity_fvg", new SMCLiquidityFVGStrategy());
  }

  /**
   * 注册策略
   * @param id 策略ID
   * @param strategy 策略实例
   */
  public register<T extends BaseStrategyParams>(
    id: string,
    strategy: TradingStrategy<T>
  ): void {
    this.strategies.set(id, strategy);
  }

  /**
   * 获取策略
   * @param id 策略ID
   * @returns 策略实例，如果不存在则返回null
   */
  public getStrategy<T extends BaseStrategyParams>(
    id: string
  ): TradingStrategy<T> | null {
    const strategy = this.strategies.get(id);
    return strategy as TradingStrategy<T> || null;
  }

  /**
   * 获取所有策略的元信息
   * @returns 策略元信息列表
   */
  public getAllStrategies(): StrategyMeta[] {
    const metas: StrategyMeta[] = [];
    for (const [id, strategy] of this.strategies) {
      metas.push(strategy.meta);
    }
    return metas;
  }

  /**
   * 检查策略是否存在
   * @param id 策略ID
   * @returns 是否存在
   */
  public hasStrategy(id: string): boolean {
    return this.strategies.has(id);
  }

  /**
   * 获取策略列表
   * @returns 策略ID列表
   */
  public getStrategyIds(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 注销策略
   * @param id 策略ID
   */
  public unregister(id: string): void {
    this.strategies.delete(id);
  }

  /**
   * 清空所有策略（主要用于测试）
   */
  public clear(): void {
    this.strategies.clear();
  }
}

// 导出单例实例
export const strategyManager = StrategyManager.getInstance();
