import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://fapi.binance.com";

function createSignature(queryString: string, apiSecret: string): string {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const {
      apiKey,
      apiSecret,
      symbol,
      side,
      type,
      quantity,
      price,
      positionSide, // 新增持仓方向参数
      stopLoss,
      takeProfit,
      triggerPrice, // 统一的触发价格（用于止损和止盈）
    } = await request.json();

    // 清理API密钥和Secret
    const cleanApiKey = apiKey?.trim();
    const cleanApiSecret = apiSecret?.trim();

    console.log('[Order API] Request received', {
      apiKey: cleanApiKey ? `${cleanApiKey.slice(0, 8)}...` : 'missing',
      apiSecret: cleanApiSecret ? `${cleanApiSecret.slice(0, 8)}...` : 'missing',
      symbol,
      side,
      type,
      quantity
    });

    if (!cleanApiKey || !cleanApiSecret || !symbol || !side || !type || !quantity) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();

    // 构建查询参数（确保按字母顺序排序）
    const params: Record<string, string> = {
      quantity: quantity.toString(),
      side,
      symbol,
      timestamp: timestamp.toString(),
      type,
    };

    // 添加持仓方向（币安期货必需）
    if (positionSide) {
      params.positionSide = positionSide;
    }

    // LIMIT订单需要价格
    if (price && type === "LIMIT") {
      params.price = price.toString();
    }

    // 条件订单类型（止损、止盈）
    const stopOrderTypes = ["STOP", "STOP_MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT"];
    const takeProfitOrderTypes = ["TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TAKE_PROFIT_LIMIT"];

    // 对于条件订单，stopPrice是必需参数
    if (stopOrderTypes.includes(type) || takeProfitOrderTypes.includes(type)) {
      if (!triggerPrice && !stopLoss && !takeProfit) {
        return NextResponse.json(
          { error: `stopPrice is required for ${type} order` },
          { status: 400 }
        );
      }
      // 优先使用triggerPrice，其次是stopLoss或takeProfit
      const stopPrice = triggerPrice || stopLoss || takeProfit;
      params.stopPrice = stopPrice.toString();
    }

    // STOP_LOSS_LIMIT和TAKE_PROFIT_LIMIT类型需要timeInForce
    if (type === "STOP_LOSS_LIMIT" || type === "TAKE_PROFIT_LIMIT") {
      params.timeInForce = "GTC";
    }

    // 按字母顺序排序参数
    const queryString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const signature = createSignature(queryString, cleanApiSecret);

    console.log('[Order API] Sending order', {
      timestamp,
      queryStringLength: queryString.length,
      signatureLength: signature.length
    });

    const response = await fetch(
      `${BASE_URL}/fapi/v1/order?${queryString}&signature=${signature}`,
      {
        method: "POST",
        headers: {
          "X-MBX-APIKEY": cleanApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Order API] Binance API error', {
        code: error.code,
        msg: error.msg,
        timestamp,
        serverTimeDiff: error.serverTime ? (error.serverTime - timestamp) : 'unknown'
      });
      return NextResponse.json(
        { error: error.msg || "Order failed", code: error.code },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Order API] Order successful', {
      orderId: data.orderId,
      symbol: data.symbol,
      side: data.side,
      status: data.status
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Order API] Internal error', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
