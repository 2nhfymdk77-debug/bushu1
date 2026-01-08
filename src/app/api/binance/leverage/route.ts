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

    // 清理API密钥和Secret（去除前后空格）
    const cleanApiKey = apiKey?.trim();
    const cleanApiSecret = apiSecret?.trim();

    console.log('[Leverage API] Request received', {
      apiKey: cleanApiKey ? `${cleanApiKey.slice(0, 8)}...` : 'missing',
      apiSecret: cleanApiSecret ? `${cleanApiSecret.slice(0, 8)}...` : 'missing',
      symbol,
      leverage
    });

    if (!cleanApiKey || !cleanApiSecret) {
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
    // 参数按字母顺序排序：leverage, symbol, timestamp
    const queryString = `leverage=${leverage}&symbol=${symbol}&timestamp=${timestamp}`;
    const signature = createSignature(queryString, cleanApiSecret);

    console.log('[Leverage API] Request details', {
      timestamp,
      queryString,
      signatureLength: signature.length
    });

    console.log('[Leverage API] Setting leverage to', leverageNum, 'for', symbol);

    const response = await fetch(`${BASE_URL}/fapi/v1/leverage?${queryString}&signature=${signature}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": cleanApiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Leverage API] Binance API error', {
        code: error.code,
        msg: error.msg,
        timestamp,
        serverTimeDiff: error.serverTime ? (error.serverTime - timestamp) : 'unknown'
      });
      return NextResponse.json(
        { error: error.msg || "Failed to set leverage", code: error.code },
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
