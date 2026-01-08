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
    const { apiKey, apiSecret } = await request.json();

    console.log('[Balance API] Request received', { apiKey: apiKey ? '***' : 'missing', apiSecret: apiSecret ? '***' : 'missing' });

    if (!apiKey || !apiSecret) {
      console.error('[Balance API] Missing credentials');
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, apiSecret);

    console.log('[Balance API] Fetching from', BASE_URL);

    const response = await fetch(
      `${BASE_URL}/fapi/v2/balance?${queryString}&signature=${signature}`,
      {
        headers: {
          "X-MBX-APIKEY": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Balance API] Binance API error', error);
      return NextResponse.json(
        { error: error.msg || "Failed to fetch balance" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 过滤USDT资产
    const usdtBalance = data.find((b: any) => b.asset === "USDT");

    return NextResponse.json({
      available: parseFloat(usdtBalance?.availableBalance || "0"),
      wallet: parseFloat(usdtBalance?.walletBalance || "0"),
      unrealizedPnl: parseFloat(usdtBalance?.crossUnPnl || "0"),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
