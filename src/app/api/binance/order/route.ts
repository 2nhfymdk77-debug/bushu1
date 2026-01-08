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

    // 只有STOP类型订单才需要stopPrice
    if ((type === "STOP" || type === "STOP_MARKET" || type === "STOP_LIMIT") && stopLoss) {
      params.stopPrice = stopLoss.toString();
    }

    // STOP_LIMIT类型需要stopLimitPrice
    if (type === "STOP_LIMIT" && stopLoss) {
      params.stopLimitPrice = stopLoss.toString();
      params.stopLimitTimeInForce = "GTC";
    }

    // TAKE_PROFIT类型订单需要takeProfitPrice
    if ((type === "TAKE_PROFIT" || type === "TAKE_PROFIT_MARKET") && takeProfit) {
      params.takeProfitPrice = takeProfit.toString();
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
