/**
 * 币安期货交易所实现
 * 实现 Exchange 接口
 */

import crypto from "crypto";
import {
  Exchange,
  ExchangeInfo,
  AccountInfo,
  Position,
  PlaceOrderParams,
  Order,
  OrderSide,
  OrderType,
  Ticker24hr,
  SymbolInfo
} from "../types/exchange";

const BASE_URL = "https://fapi.binance.com";
const WS_BASE_URL = "wss://fstream.binance.com/ws";

// 币安API响应类型
interface BinanceAccountResponse {
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  totalMaintMargin: string;
  accountEquity: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: Array<{
    asset: string;
    walletBalance: string;
    crossWalletBalance: string;
    balanceChange: string;
  }>;
  positions: any[];
}

interface BinancePositionResponse {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  liquidationPrice: string;
  leverage: number;
  maxNotionalValue: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string;
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

interface BinanceOrderResponse {
  symbol: string;
  orderId: number;
  orderListId?: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origOrderType: string;
  positionSide?: string;
  closePosition?: boolean;
  activatePrice?: string;
  priceRate?: string;
}

interface BinanceTicker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

/**
 * 币安交易所类
 */
export class BinanceExchange implements Exchange {
  private apiKey: string;
  private apiSecret: string;
  private connected: boolean = false;
  private wsConnections: Map<string, WebSocket> = new Map();

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
    this.connected = true;
  }

  /**
   * 创建签名
   */
  private createSignature(queryString: string): string {
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  /**
   * 发送私有API请求
   */
  private async requestPrivate(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    params?: Record<string, any>
  ): Promise<any> {
    const timestamp = Date.now();
    const queryParams: Record<string, string> = {
      ...params,
      timestamp: timestamp.toString(),
    };

    // 按字母顺序排序参数
    const queryString = Object.entries(queryParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const signature = this.createSignature(queryString);

    const url = `${BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method,
      headers: {
        "X-MBX-APIKEY": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.msg || `API request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 发送公开API请求
   */
  private async requestPublic(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<any> {
    const queryString = Object.entries(params || {})
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const url = `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 获取交易所信息
   */
  async getExchangeInfo(): Promise<ExchangeInfo> {
    const data = await this.requestPublic("/fapi/v1/exchangeInfo");
    return data;
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo(): Promise<AccountInfo> {
    const data: BinanceAccountResponse = await this.requestPrivate("/fapi/v2/account");

    return {
      totalWalletBalance: parseFloat(data.totalWalletBalance),
      totalUnrealizedProfit: parseFloat(data.totalUnrealizedProfit),
      totalMarginBalance: parseFloat(data.totalMarginBalance),
      totalPositionInitialMargin: parseFloat(data.totalPositionInitialMargin),
      totalOpenOrderInitialMargin: parseFloat(data.totalOpenOrderInitialMargin),
      totalMaintMargin: parseFloat(data.totalMaintMargin),
      accountEquity: parseFloat(data.accountEquity),
      availableBalance: parseFloat(data.availableBalance),
      maxWithdrawAmount: parseFloat(data.maxWithdrawAmount),
    };
  }

  /**
   * 获取持仓
   */
  async getPositions(symbol?: string): Promise<Position[]> {
    const data = await this.requestPrivate("/fapi/v2/positionRisk");

    let positions = data.filter((p: BinancePositionResponse) =>
      parseFloat(p.positionAmt) !== 0
    );

    if (symbol) {
      positions = positions.filter((p: BinancePositionResponse) => p.symbol === symbol);
    }

    return positions.map((p: BinancePositionResponse) => ({
      symbol: p.symbol,
      positionSide: p.positionSide as "LONG" | "SHORT",
      positionAmt: parseFloat(p.positionAmt),
      entryPrice: parseFloat(p.entryPrice),
      markPrice: parseFloat(p.markPrice),
      unrealizedProfit: parseFloat(p.unrealizedProfit),
      liquidationPrice: parseFloat(p.liquidationPrice),
      leverage: p.leverage,
      maxNotionalValue: parseFloat(p.maxNotionalValue),
      marginType: p.marginType as "isolated" | "cross",
      isolatedMargin: parseFloat(p.isolatedMargin),
      isAutoAddMargin: p.isAutoAddMargin === "true",
      notional: parseFloat(p.notional),
      isolatedWallet: parseFloat(p.isolatedWallet),
      updateTime: p.updateTime,
    }));
  }

  /**
   * 下单
   */
  async placeOrder(params: PlaceOrderParams): Promise<Order> {
    const orderParams: Record<string, any> = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity?.toString(),
    };

    if (params.positionSide) {
      orderParams.positionSide = params.positionSide;
    }

    if (params.price) {
      orderParams.price = params.price.toString();
    }

    if (params.stopPrice) {
      orderParams.stopPrice = params.stopPrice.toString();
    }

    if (params.timeInForce) {
      orderParams.timeInForce = params.timeInForce;
    }

    if (params.reduceOnly) {
      orderParams.reduceOnly = params.reduceOnly;
    }

    if (params.closePosition) {
      orderParams.closePosition = params.closePosition;
    }

    if (params.newClientOrderId) {
      orderParams.newClientOrderId = params.newClientOrderId;
    }

    const data: BinanceOrderResponse = await this.requestPrivate("/fapi/v1/order", "POST", orderParams);

    return {
      symbol: data.symbol,
      orderId: data.orderId,
      orderListId: data.orderListId,
      clientOrderId: data.clientOrderId,
      price: parseFloat(data.price),
      origQty: parseFloat(data.origQty),
      executedQty: parseFloat(data.executedQty),
      cumQuote: parseFloat(data.cumQuote),
      status: data.status as any,
      timeInForce: data.timeInForce as any,
      type: data.type as any,
      side: data.side as any,
      stopPrice: data.stopPrice ? parseFloat(data.stopPrice) : undefined,
      icebergQty: data.icebergQty ? parseFloat(data.icebergQty) : undefined,
      time: data.time,
      updateTime: data.updateTime,
      isWorking: data.isWorking,
      origOrderType: data.origOrderType,
      positionSide: data.positionSide as any,
      closePosition: data.closePosition,
      activatePrice: data.activatePrice ? parseFloat(data.activatePrice) : undefined,
      priceRate: data.priceRate ? parseFloat(data.priceRate) : undefined,
    };
  }

  /**
   * 取消订单
   */
  async cancelOrder(
    symbol: string,
    orderId: number,
    origClientOrderId?: string
  ): Promise<Order> {
    const params: Record<string, any> = {
      symbol,
      orderId,
    };

    if (origClientOrderId) {
      params.origClientOrderId = origClientOrderId;
    }

    const data: BinanceOrderResponse = await this.requestPrivate("/fapi/v1/order", "DELETE", params);

    return {
      symbol: data.symbol,
      orderId: data.orderId,
      orderListId: data.orderListId,
      clientOrderId: data.clientOrderId,
      price: parseFloat(data.price),
      origQty: parseFloat(data.origQty),
      executedQty: parseFloat(data.executedQty),
      cumQuote: parseFloat(data.cumQuote),
      status: data.status as any,
      timeInForce: data.timeInForce as any,
      type: data.type as any,
      side: data.side as any,
      stopPrice: data.stopPrice ? parseFloat(data.stopPrice) : undefined,
      icebergQty: data.icebergQty ? parseFloat(data.icebergQty) : undefined,
      time: data.time,
      updateTime: data.updateTime,
      isWorking: data.isWorking,
      origOrderType: data.origOrderType,
      positionSide: data.positionSide as any,
      closePosition: data.closePosition,
      activatePrice: data.activatePrice ? parseFloat(data.activatePrice) : undefined,
      priceRate: data.priceRate ? parseFloat(data.priceRate) : undefined,
    };
  }

  /**
   * 获取订单
   */
  async getOrder(
    symbol: string,
    orderId: number,
    origClientOrderId?: string
  ): Promise<Order> {
    const params: Record<string, any> = {
      symbol,
      orderId,
    };

    if (origClientOrderId) {
      params.origClientOrderId = origClientOrderId;
    }

    const data: BinanceOrderResponse = await this.requestPrivate("/fapi/v1/order", "GET", params);

    return {
      symbol: data.symbol,
      orderId: data.orderId,
      orderListId: data.orderListId,
      clientOrderId: data.clientOrderId,
      price: parseFloat(data.price),
      origQty: parseFloat(data.origQty),
      executedQty: parseFloat(data.executedQty),
      cumQuote: parseFloat(data.cumQuote),
      status: data.status as any,
      timeInForce: data.timeInForce as any,
      type: data.type as any,
      side: data.side as any,
      stopPrice: data.stopPrice ? parseFloat(data.stopPrice) : undefined,
      icebergQty: data.icebergQty ? parseFloat(data.icebergQty) : undefined,
      time: data.time,
      updateTime: data.updateTime,
      isWorking: data.isWorking,
      origOrderType: data.origOrderType,
      positionSide: data.positionSide as any,
      closePosition: data.closePosition,
      activatePrice: data.activatePrice ? parseFloat(data.activatePrice) : undefined,
      priceRate: data.priceRate ? parseFloat(data.priceRate) : undefined,
    };
  }

  /**
   * 获取当前挂单
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const params = symbol ? { symbol } : undefined;
    const data: BinanceOrderResponse[] = await this.requestPrivate("/fapi/v1/openOrders", "GET", params);

    return data.map((o: BinanceOrderResponse) => ({
      symbol: o.symbol,
      orderId: o.orderId,
      orderListId: o.orderListId,
      clientOrderId: o.clientOrderId,
      price: parseFloat(o.price),
      origQty: parseFloat(o.origQty),
      executedQty: parseFloat(o.executedQty),
      cumQuote: parseFloat(o.cumQuote),
      status: o.status as any,
      timeInForce: o.timeInForce as any,
      type: o.type as any,
      side: o.side as any,
      stopPrice: o.stopPrice ? parseFloat(o.stopPrice) : undefined,
      icebergQty: o.icebergQty ? parseFloat(o.icebergQty) : undefined,
      time: o.time,
      updateTime: o.updateTime,
      isWorking: o.isWorking,
      origOrderType: o.origOrderType,
      positionSide: o.positionSide as any,
      closePosition: o.closePosition,
      activatePrice: o.activatePrice ? parseFloat(o.activatePrice) : undefined,
      priceRate: o.priceRate ? parseFloat(o.priceRate) : undefined,
    }));
  }

  /**
   * 获取所有订单
   */
  async getAllOrders(
    symbol: string,
    orderId?: number,
    limit?: number
  ): Promise<Order[]> {
    const params: Record<string, any> = { symbol };

    if (orderId) {
      params.orderId = orderId;
    }

    if (limit) {
      params.limit = limit;
    }

    const data: BinanceOrderResponse[] = await this.requestPrivate("/fapi/v1/allOrders", "GET", params);

    return data.map((o: BinanceOrderResponse) => ({
      symbol: o.symbol,
      orderId: o.orderId,
      orderListId: o.orderListId,
      clientOrderId: o.clientOrderId,
      price: parseFloat(o.price),
      origQty: parseFloat(o.origQty),
      executedQty: parseFloat(o.executedQty),
      cumQuote: parseFloat(o.cumQuote),
      status: o.status as any,
      timeInForce: o.timeInForce as any,
      type: o.type as any,
      side: o.side as any,
      stopPrice: o.stopPrice ? parseFloat(o.stopPrice) : undefined,
      icebergQty: o.icebergQty ? parseFloat(o.icebergQty) : undefined,
      time: o.time,
      updateTime: o.updateTime,
      isWorking: o.isWorking,
      origOrderType: o.origOrderType,
      positionSide: o.positionSide as any,
      closePosition: o.closePosition,
      activatePrice: o.activatePrice ? parseFloat(o.activatePrice) : undefined,
      priceRate: o.priceRate ? parseFloat(o.priceRate) : undefined,
    }));
  }

  /**
   * 获取24小时统计
   */
  async get24hrTicker(symbol?: string): Promise<Ticker24hr | Ticker24hr[]> {
    const endpoint = "/fapi/v1/ticker/24hr";
    const params = symbol ? { symbol } : undefined;

    const data = symbol
      ? [await this.requestPublic(endpoint, params)]
      : await this.requestPublic(endpoint, params);

    return data.map((t: BinanceTicker24hr) => ({
      symbol: t.symbol,
      priceChange: parseFloat(t.priceChange),
      priceChangePercent: parseFloat(t.priceChangePercent),
      weightedAvgPrice: parseFloat(t.weightedAvgPrice),
      prevClosePrice: parseFloat(t.prevClosePrice),
      lastPrice: parseFloat(t.lastPrice),
      lastQty: parseFloat(t.lastQty),
      bidPrice: parseFloat(t.bidPrice),
      bidQty: parseFloat(t.bidQty),
      askPrice: parseFloat(t.askPrice),
      askQty: parseFloat(t.askQty),
      openPrice: parseFloat(t.openPrice),
      highPrice: parseFloat(t.highPrice),
      lowPrice: parseFloat(t.lowPrice),
      volume: parseFloat(t.volume),
      quoteVolume: parseFloat(t.quoteVolume),
      openTime: t.openTime,
      closeTime: t.closeTime,
      firstId: t.firstId,
      lastId: t.lastId,
      count: t.count,
    }));
  }

  /**
   * 调整杠杆
   */
  async changeLeverage(
    symbol: string,
    leverage: number
  ): Promise<{ leverage: number; maxNotionalValue: number; symbol: string }> {
    const data = await this.requestPrivate("/fapi/v1/leverage", "POST", {
      symbol,
      leverage,
    });

    return data;
  }

  /**
   * 获取K线数据
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit?: number,
    startTime?: number,
    endTime?: number
  ): Promise<any[]> {
    const params: Record<string, any> = { symbol, interval };

    if (limit) {
      params.limit = limit;
    }

    if (startTime) {
      params.startTime = startTime;
    }

    if (endTime) {
      params.endTime = endTime;
    }

    return await this.requestPublic("/fapi/v1/klines", params);
  }

  /**
   * 订阅K线WebSocket
   */
  subscribeKlines(
    symbol: string,
    interval: string,
    callback: (data: any) => void
  ): Promise<() => void> {
    return new Promise((resolve) => {
      const stream = `${symbol.toLowerCase()}@kline_${interval}`;
      const ws = new WebSocket(`${WS_BASE_URL}/${stream}`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        callback(data);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${stream}:`, error);
      };

      this.wsConnections.set(stream, ws);

      // 返回取消订阅函数
      const unsubscribe = () => {
        ws.close();
        this.wsConnections.delete(stream);
      };

      resolve(unsubscribe);
    });
  }

  /**
   * 订阅账户更新WebSocket
   */
  subscribeAccountUpdate(
    callback: (data: any) => void
  ): Promise<() => void> {
    return new Promise((resolve) => {
      const listenKey = this.getListenKey();
      const ws = new WebSocket(`${WS_BASE_URL}/${listenKey}`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        callback(data);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for account updates:`, error);
      };

      this.wsConnections.set("account", ws);

      // 返回取消订阅函数
      const unsubscribe = () => {
        ws.close();
        this.wsConnections.delete("account");
      };

      resolve(unsubscribe);
    });
  }

  /**
   * 获取监听密钥（用于账户WebSocket）
   */
  private async getListenKey(): Promise<string> {
    const data = await this.requestPrivate("/fapi/v1/listenKey", "POST", {});
    return data.listenKey;
  }

  /**
   * 获取交易所标识
   */
  getExchangeId(): string {
    return "binance";
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 断开所有WebSocket连接
   */
  disconnect(): void {
    this.wsConnections.forEach((ws) => ws.close());
    this.wsConnections.clear();
    this.connected = false;
  }
}
