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

    const cleanApiKey = apiKey?.trim();
    const cleanApiSecret = apiSecret?.trim();

    if (!cleanApiKey || !cleanApiSecret) {
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, cleanApiSecret);

    // 获取账户信息（包含保证金余额）
    const response = await fetch(
      `${BASE_URL}/fapi/v2/account?${queryString}&signature=${signature}`,
      {
        headers: {
          "X-MBX-APIKEY": cleanApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.msg || "Failed to fetch account info", code: error.code },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 计算总可用余额（余额 + 未实现盈亏）
    const totalWalletBalance = parseFloat(data.totalWalletBalance || "0");
    const totalAvailableBalance = parseFloat(data.availableBalance || "0");

    // 获取USDT资产余额（与balance API保持一致）
    const usdtBalance = data.assets?.find((b: any) => b.asset === "USDT");

    return NextResponse.json({
      available: totalAvailableBalance, // 可用保证金（扣除持仓后）
      wallet: totalWalletBalance, // 总钱包余额（包含未实现盈亏）
      unrealizedPnl: parseFloat(data.totalUnrealizedProfit || "0"),
      // 额外的账户信息
      totalPositionMargin: parseFloat(data.totalPositionInitialMargin || "0"),
      totalMaintMargin: parseFloat(data.totalMaintMargin || "0"),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
