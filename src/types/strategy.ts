/**
 * 策略系统类型定义
 * 用于统一管理不同的交易策略
 */

// K线数据结构
export interface KLineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 交易信号结构
export interface Signal {
  symbol: string;
  direction: "long" | "short";
  time: number;
  reason: string;
  confidence: number;
  entryPrice: number;
  executed?: boolean;
  notExecutedReason?: string;
}

// 交易信号检测结果
export interface SignalDetectionResult {
  signal: Signal | null;
  reason: string;
  details: string;
}

// 策略参数接口（所有策略的基类）
export interface BaseStrategyParams {
  [key: string]: any;
}

// 策略元信息
export interface StrategyMeta {
  id: string;                    // 策略唯一标识
  name: string;                  // 策略名称
  description: string;           // 策略描述
  version: string;               // 策略版本
  category: string;              // 策略分类（如"趋势跟踪"、"均值回归"等）
  author?: string;               // 作者
  timeframe: string[];            // 支持的时间周期
  riskLevel: "low" | "medium" | "high";  // 风险等级
}

// 策略配置项（用于UI渲染）
export interface StrategyConfigItem {
  key: string;                   // 参数键名
  label: string;                 // 显示标签
  type: "number" | "select" | "checkbox" | "text";  // 输入类型
  defaultValue: any;             // 默认值
  min?: number;                  // 最小值（数字类型）
  max?: number;                  // 最大值（数字类型）
  step?: number;                 // 步进值（数字类型）
  options?: { value: any; label: string }[];  // 选项（select类型）
  description?: string;         // 参数说明
  category?: string;             // 配置分组
}

// 策略接口（所有策略必须实现）
export interface TradingStrategy<T extends BaseStrategyParams = BaseStrategyParams> {
  // 策略元信息
  readonly meta: StrategyMeta;

  // 获取默认参数
  getDefaultParams(): T;

  // 获取配置项列表（用于UI渲染）
  getConfigItems(): StrategyConfigItem[];

  // 检测交易信号
  // 返回：检测到的信号或null，以及原因和详细信息
  detectSignal(
    symbol: string,
    klines: KLineData[],
    params: T
  ): SignalDetectionResult;

  // 验证参数（可选）
  validateParams?(params: T): { valid: boolean; errors: string[] };
}

// 策略注册表类型
export type StrategyRegistry = Map<string, TradingStrategy>;
