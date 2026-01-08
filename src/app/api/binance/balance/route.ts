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

    // 清理API密钥和Secret（去除前后空格）
    const cleanApiKey = apiKey?.trim();
    const cleanApiSecret = apiSecret?.trim();

    console.log('[Balance API] Request received', {
      apiKey: cleanApiKey ? `${cleanApiKey.slice(0, 8)}...` : 'missing',
      apiSecret: cleanApiSecret ? `${cleanApiSecret.slice(0, 8)}...` : 'missing',
      apiKeyLength: cleanApiKey?.length,
      apiSecretLength: cleanApiSecret?.length
    });

    if (!cleanApiKey || !cleanApiSecret) {
      console.error('[Balance API] Missing credentials');
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, cleanApiSecret);

    console.log('[Balance API] Request details', {
      timestamp,
      localTime: new Date(timestamp).toISOString(),
      queryString,
      signatureLength: signature.length
    });

    console.log('[Balance API] Fetching from', BASE_URL);

    const response = await fetch(
      `${BASE_URL}/fapi/v2/balance?${queryString}&signature=${signature}`,
      {
        headers: {
          "X-MBX-APIKEY": cleanApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Balance API] Binance API error', {
        code: error.code,
        msg: error.msg,
        timestamp,
        serverTimeDiff: error.serverTime ? (error.serverTime - timestamp) : 'unknown'
      });
      return NextResponse.json(
        { error: error.msg || "Failed to fetch balance", code: error.code },
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
