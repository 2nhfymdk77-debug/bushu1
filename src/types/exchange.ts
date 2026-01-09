/**
 * 交易所接口定义
 * 支持模块化设计，可扩展多个交易所（币安、OKX等）
 */

// 订单类型
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_MARKET" | "TAKE_PROFIT" | "TAKE_PROFIT_MARKET";

// 订单方向
export type OrderSide = "BUY" | "SELL";

// 仓位方向
export type PositionSide = "LONG" | "SHORT";

// 订单状态
export type OrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "PENDING_CANCEL" | "REJECTED" | "EXPIRED";

// 持仓信息
export interface Position {
  symbol: string;
  positionSide: PositionSide;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  liquidationPrice: number;
  leverage: number;
  maxNotionalValue: number;
  marginType: "isolated" | "cross";
  isolatedMargin: number;
  isAutoAddMargin: boolean;
  positionSide: string;
  notional: number;
  isolatedWallet: number;
  updateTime: number;
}

// 账户余额
export interface AccountBalance {
  asset: string;
  walletBalance: number;
  crossWalletBalance: number;
  balanceChange: number;
}

// 账户信息
export interface AccountInfo {
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  totalMarginBalance: number;
  totalPositionInitialMargin: number;
  totalOpenOrderInitialMargin: number;
  totalMaintMargin: number;
  accountEquity: number;
  availableBalance: number;
  maxWithdrawAmount: number;
}

// 订单信息
export interface Order {
  symbol: string;
  orderId: number;
  orderListId?: number;
  clientOrderId?: string;
  price: number;
  origQty: number;
  executedQty: number;
  cumQuote: number;
  status: OrderStatus;
  timeInForce: "GTC" | "IOC" | "FOK" | "GTX";
  type: OrderType;
  side: OrderSide;
  stopPrice?: number;
  icebergQty?: number;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origOrderType: string;
  positionSide?: PositionSide;
  closePosition?: boolean;
  activatePrice?: number;
  priceRate?: number;
}

// 下单参数
export interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  positionSide?: PositionSide;
  quantity?: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: "GTC" | "IOC" | "FOK" | "GTX";
  reduceOnly?: boolean;
  closePosition?: boolean;
  newClientOrderId?: string;
}

// 24小时价格变动统计
export interface Ticker24hr {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  prevClosePrice: number;
  lastPrice: number;
  lastQty: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

// 交易所信息
export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  futuresType: "U_MARGINED" | "COIN_MARGINED";
  rateLimits: any[];
  exchangeFilters: any[];
  assets: any[];
  symbols: SymbolInfo[];
}

// 交易对信息
export interface SymbolInfo {
  symbol: string;
  status: string;
  contractType: string;
  deliveryDate: number;
  onboardDate: number;
  contractSize: number;
  positionAmt: number;
  quotePrecision: number;
  basePrecision: number;
  marginType: string;
  pricePrecision: number;
  quantityPrecision: number;
  minQuantity: number;
  maxQuantity: number;
  tickSize: number;
  stepSize: number;
  makerFeeRate: number;
  takerFeeRate: number;
}

// 交易所接口（所有交易所必须实现）
export interface Exchange {
  // 获取交易所信息
  getExchangeInfo(): Promise<ExchangeInfo>;

  // 获取账户信息
  getAccountInfo(): Promise<AccountInfo>;

  // 获取持仓
  getPositions(symbol?: string): Promise<Position[]>;

  // 下单
  placeOrder(params: PlaceOrderParams): Promise<Order>;

  // 取消订单
  cancelOrder(symbol: string, orderId: number, origClientOrderId?: string): Promise<Order>;

  // 获取订单
  getOrder(symbol: string, orderId: number, origClientOrderId?: string): Promise<Order>;

  // 获取当前挂单
  getOpenOrders(symbol?: string): Promise<Order[]>;

  // 获取所有订单（包括历史）
  getAllOrders(symbol: string, orderId?: number, limit?: number): Promise<Order[]>;

  // 获取24小时统计
  get24hrTicker(symbol?: string): Promise<Ticker24hr | Ticker24hr[]>;

  // 调整杠杆
  changeLeverage(symbol: string, leverage: number): Promise<{ leverage: number; maxNotionalValue: number; symbol: string }>;

  // 获取K线数据
  getKlines(symbol: string, interval: string, limit?: number, startTime?: number, endTime?: number): Promise<any[]>;

  // 订阅K线WebSocket
  subscribeKlines(symbol: string, interval: string, callback: (data: any) => void): Promise<() => void>;

  // 订阅账户更新WebSocket
  subscribeAccountUpdate(callback: (data: any) => void): Promise<() => void>;

  // 获取交易所标识
  getExchangeId(): string;

  // 检查连接状态
  isConnected(): boolean;
}
