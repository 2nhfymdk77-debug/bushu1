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

    console.log('[Orders API] Request received', { apiKey: apiKey ? '***' : 'missing', apiSecret: apiSecret ? '***' : 'missing', symbol, limit });

    if (!apiKey || !apiSecret) {
      console.error('[Orders API] Missing credentials');
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}&limit=${limit}${symbol ? `&symbol=${symbol}` : ""}`;
    const signature = createSignature(queryString, apiSecret);

    console.log('[Orders API] Fetching from', BASE_URL);

    const response = await fetch(
      `${BASE_URL}/fapi/v1/allOrders?${queryString}&signature=${signature}`,
      {
        headers: {
          "X-MBX-APIKEY": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Orders API] Binance API error', error);
      return NextResponse.json(
        { error: error.msg || "Failed to fetch orders" },
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

    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
