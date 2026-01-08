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
      stopLoss,
      takeProfit,
    } = await request.json();

    if (!apiKey || !apiSecret || !symbol || !side || !type || !quantity) {
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
      timestamp: timestamp.toString(),
    };

    if (price && type === "LIMIT") {
      params.price = price.toString();
    }

    if (stopLoss) {
      params.stopPrice = stopLoss.toString();
      params.stopLimitPrice = stopLoss.toString();
      params.stopLimitTimeInForce = "GTC";
    }

    if (takeProfit) {
      params.takeProfitPrice = takeProfit.toString();
    }

    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const signature = createSignature(queryString, apiSecret);

    const response = await fetch(
      `${BASE_URL}/fapi/v1/order?${queryString}&signature=${signature}`,
      {
        method: "POST",
        headers: {
          "X-MBX-APIKEY": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.msg || "Order failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
