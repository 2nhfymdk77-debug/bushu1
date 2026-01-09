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
      positionSide,
      stopPrice, // 触发价格（必需）
      reduceOnly, // 是否只减仓（默认true）
    } = await request.json();

    // 清理API密钥和Secret
    const cleanApiKey = apiKey?.trim();
    const cleanApiSecret = apiSecret?.trim();

    console.log('[Algo Order API] Request received', {
      apiKey: cleanApiKey ? `${cleanApiKey.slice(0, 8)}...` : 'missing',
      apiSecret: cleanApiSecret ? `${cleanApiSecret.slice(0, 8)}...` : 'missing',
      symbol,
      side,
      type,
      quantity,
      stopPrice,
      positionSide
    });

    if (!cleanApiKey || !cleanApiSecret || !symbol || !side || !type || !quantity || !stopPrice) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();

    // 构建查询参数
    const params: Record<string, string> = {
      symbol,
      side,
      type,
      quantity: quantity.toString(),
      stopPrice: stopPrice.toString(),
      timestamp: timestamp.toString(),
    };

    // 添加持仓方向
    if (positionSide) {
      params.positionSide = positionSide;
    }

    // 只减仓（止盈止损订单通常只需要减仓）
    if (reduceOnly !== false) {
      params.reduceOnly = "true";
    }

    // STOP_LOSS_LIMIT和TAKE_PROFIT_LIMIT类型需要timeInForce
    if (type === "STOP_LOSS_LIMIT" || type === "TAKE_PROFIT_LIMIT") {
      if (!price) {
        return NextResponse.json(
          { error: "price is required for limit type algo orders" },
          { status: 400 }
        );
      }
      params.price = price.toString();
      params.timeInForce = "GTC";
    }

    // 按字母顺序排序参数
    const queryString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const signature = createSignature(queryString, cleanApiSecret);

    console.log('[Algo Order API] Sending algo order', {
      type,
      stopPrice,
      queryStringLength: queryString.length
    });

    // 使用币安期货订单API（支持算法订单类型）
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
      console.error('[Algo Order API] Binance API error', {
        code: error.code,
        msg: error.msg,
        fullError: error
      });
      return NextResponse.json(
        { error: error.msg || "Algo order failed", code: error.code },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Algo Order API] Algo order successful', {
      orderId: data.orderId,
      symbol: data.symbol,
      side: data.side,
      type: data.type,
      status: data.status
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Algo Order API] Internal error', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
