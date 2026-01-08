import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://fapi.binance.com";
const TESTNET_URL = "https://testnet.binancefuture.com";

function createSignature(queryString: string, apiSecret: string): string {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, apiSecret, testnet = false } = await request.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    const baseUrl = testnet ? TESTNET_URL : BASE_URL;
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, apiSecret);

    const response = await fetch(
      `${baseUrl}/fapi/v2/balance?${queryString}&signature=${signature}`,
      {
        headers: {
          "X-MBX-APIKEY": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
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
