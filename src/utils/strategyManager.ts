/**
 * 策略管理器
 * 负责策略的注册、查询、切换和调用
 */

import {
  TradingStrategy,
  StrategyRegistry,
  BaseStrategyParams,
  StrategyMeta
} from "../types/strategy";

import { SMCLiquidityFVGStrategy } from "../strategies/SMCLiquidityFVGStrategy";

/**
 * 策略管理器类
 */
class StrategyManager {
  private static instance: StrategyManager;
  private registry: StrategyRegistry = new Map();

  // 私有构造函数，实现单例模式
  private constructor() {
    // 注册内置策略
    this.registerStrategy(new SMCLiquidityFVGStrategy());
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
   * 注册策略
   */
  public registerStrategy(strategy: TradingStrategy): void {
    const { id } = strategy.meta;

    if (this.registry.has(id)) {
      console.warn(`策略 [${id}] 已存在，将被覆盖`);
    }

    this.registry.set(id, strategy);
    console.log(`策略 [${id}] 已注册: ${strategy.meta.name}`);
  }

  /**
   * 获取策略
   */
  public getStrategy(id: string): TradingStrategy | undefined {
    return this.registry.get(id);
  }

  /**
   * 获取所有策略
   */
  public getAllStrategies(): TradingStrategy[] {
    return Array.from(this.registry.values());
  }

  /**
   * 获取所有策略的元信息
   */
  public getAllStrategyMetas(): StrategyMeta[] {
    return Array.from(this.registry.values()).map(s => s.meta);
  }

  /**
   * 检查策略是否存在
   */
  public hasStrategy(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * 执行策略信号检测
   */
  public detectSignal<T extends BaseStrategyParams>(
    strategyId: string,
    symbol: string,
    klines: any[],
    params: T
  ) {
    const strategy = this.getStrategy(strategyId);

    if (!strategy) {
      throw new Error(`策略 [${strategyId}] 不存在`);
    }

    return strategy.detectSignal(symbol, klines, params);
  }

  /**
   * 获取策略的默认参数
   */
  public getDefaultParams<T extends BaseStrategyParams>(
    strategyId: string
  ): T | undefined {
    const strategy = this.getStrategy(strategyId);

    if (!strategy) {
      console.warn(`策略 [${strategyId}] 不存在`);
      return undefined;
    }

    return strategy.getDefaultParams() as T;
  }

  /**
   * 获取策略的配置项
   */
  public getConfigItems(strategyId: string) {
    const strategy = this.getStrategy(strategyId);

    if (!strategy) {
      console.warn(`策略 [${strategyId}] 不存在`);
      return [];
    }

    return strategy.getConfigItems();
  }

  /**
   * 验证策略参数
   */
  public validateParams<T extends BaseStrategyParams>(
    strategyId: string,
    params: T
  ): { valid: boolean; errors: string[] } {
    const strategy = this.getStrategy(strategyId);

    if (!strategy) {
      return {
        valid: false,
        errors: [`策略 [${strategyId}] 不存在`]
      };
    }

    if (strategy.validateParams) {
      return strategy.validateParams(params);
    }

    return { valid: true, errors: [] };
  }
}

// 导出单例实例
export const strategyManager = StrategyManager.getInstance();

// 导出类（用于测试或特殊情况）
export { StrategyManager };
