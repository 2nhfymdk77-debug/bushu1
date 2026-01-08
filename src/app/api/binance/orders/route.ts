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
    const { apiKey, apiSecret, symbol, limit = 20 } = await request.json();

    // 清理API密钥和Secret
    const cleanApiKey = apiKey?.trim();
    const cleanApiSecret = apiSecret?.trim();

    console.log('[Orders API] Request received', {
      apiKey: cleanApiKey ? `${cleanApiKey.slice(0, 8)}...` : 'missing',
      apiSecret: cleanApiSecret ? `${cleanApiSecret.slice(0, 8)}...` : 'missing',
      symbol,
      limit
    });

    if (!cleanApiKey || !cleanApiSecret) {
      console.error('[Orders API] Missing credentials');
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();

    // 按字母顺序构建参数：limit, symbol, timestamp
    const params: Record<string, string> = {
      limit: limit.toString(),
      timestamp: timestamp.toString(),
    };

    if (symbol) {
      params.symbol = symbol;
    }

    const queryString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const signature = createSignature(queryString, cleanApiSecret);

    console.log('[Orders API] Request details', {
      timestamp,
      queryString,
      signatureLength: signature.length
    });

    const response = await fetch(
      `${BASE_URL}/fapi/v1/allOrders?${queryString}&signature=${signature}`,
      {
        headers: {
          "X-MBX-APIKEY": cleanApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Orders API] Binance API error', {
        code: error.code,
        msg: error.msg,
        timestamp,
        serverTimeDiff: error.serverTime ? (error.serverTime - timestamp) : 'unknown'
      });
      return NextResponse.json(
        { error: error.msg || "Failed to fetch orders", code: error.code },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 格式化订单数据
    const orders = data.map((order: any) => ({
      symbol: order.symbol,
      orderId: order.orderId,
      side: order.side,
      type: order.type,
      quantity: parseFloat(order.origQty),
      price: parseFloat(order.price || "0"),
      executedQty: parseFloat(order.executedQty),
      status: order.status,
      time: order.time,
      updateTime: order.updateTime,
    }));

    console.log('[Orders API] Orders fetched', orders.length);
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('[Orders API] Internal error', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
