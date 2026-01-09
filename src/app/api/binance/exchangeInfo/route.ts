import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://fapi.binance.com";

export async function GET(request: NextRequest) {
  try {
    console.log('[ExchangeInfo API] Fetching exchange info...');

    const response = await fetch(
      `${BASE_URL}/fapi/v1/exchangeInfo?productType=UM`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // 添加超时控制
        signal: AbortSignal.timeout(10000), // 10秒超时
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ msg: "Unknown error" }));
      console.error('[ExchangeInfo API] Binance API error', {
        status: response.status,
        error: error.msg || error,
      });
      return NextResponse.json(
        { error: error.msg || "Failed to fetch exchange info" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[ExchangeInfo API] Success', {
      totalSymbols: data.symbols?.length || 0,
      tradingSymbols: data.symbols?.filter((s: any) => s.status === "TRADING")?.length || 0,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[ExchangeInfo API] Internal error', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
