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
    const { apiKey, apiSecret, symbol, leverage } = await request.json();

    console.log('[Leverage API] Request received', {
      apiKey: apiKey ? '***' : 'missing',
      apiSecret: apiSecret ? '***' : 'missing',
      symbol,
      leverage
    });

    if (!apiKey || !apiSecret) {
      console.error('[Leverage API] Missing credentials');
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    if (!symbol || !leverage) {
      console.error('[Leverage API] Missing symbol or leverage');
      return NextResponse.json(
        { error: "Symbol and leverage are required" },
        { status: 400 }
      );
    }

    // 验证杠杆范围（币安支持1-125倍）
    const leverageNum = parseInt(leverage, 10);
    if (isNaN(leverageNum) || leverageNum < 1 || leverageNum > 125) {
      return NextResponse.json(
        { error: "Leverage must be between 1 and 125" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&leverage=${leverage}&timestamp=${timestamp}`;
    const signature = createSignature(queryString, apiSecret);

    console.log('[Leverage API] Setting leverage to', leverageNum, 'for', symbol);

    const response = await fetch(`${BASE_URL}/fapi/v1/leverage?${queryString}&signature=${signature}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Leverage API] Binance API error', error);
      return NextResponse.json(
        { error: error.msg || "Failed to set leverage" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Leverage API] Leverage set successfully', data);

    return NextResponse.json({
      success: true,
      symbol: data.symbol,
      leverage: data.leverage,
      maxNotionalValue: data.maxNotionalValue,
    });
  } catch (error: any) {
    console.error('[Leverage API] Internal error', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
