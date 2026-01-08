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

    // 清理API密钥和Secret
    const cleanApiKey = apiKey?.trim();
    const cleanApiSecret = apiSecret?.trim();

    console.log('[Positions API] Request received', {
      apiKey: cleanApiKey ? `${cleanApiKey.slice(0, 8)}...` : 'missing',
      apiSecret: cleanApiSecret ? `${cleanApiSecret.slice(0, 8)}...` : 'missing'
    });

    if (!cleanApiKey || !cleanApiSecret) {
      console.error('[Positions API] Missing credentials');
      return NextResponse.json(
        { error: "API Key and Secret are required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, cleanApiSecret);

    console.log('[Positions API] Request details', {
      timestamp,
      localTime: new Date(timestamp).toISOString(),
      signatureLength: signature.length
    });

    const response = await fetch(
      `${BASE_URL}/fapi/v2/positionRisk?${queryString}&signature=${signature}`,
      {
        headers: {
          "X-MBX-APIKEY": cleanApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Positions API] Binance API error', {
        code: error.code,
        msg: error.msg,
        timestamp,
        serverTimeDiff: error.serverTime ? (error.serverTime - timestamp) : 'unknown'
      });
      return NextResponse.json(
        { error: error.msg || "Failed to fetch positions", code: error.code },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 过滤有持仓的合约
    const activePositions = data
      .filter((p: any) => parseFloat(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: p.symbol,
        positionSide: p.positionSide,
        positionAmt: parseFloat(p.positionAmt),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        unRealizedProfit: parseFloat(p.unRealizedProfit),
        leverage: parseFloat(p.leverage),
        notional: parseFloat(p.notional),
      }));

    console.log('[Positions API] Positions fetched', activePositions.length);
    return NextResponse.json(activePositions);
  } catch (error: any) {
    console.error('[Positions API] Internal error', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
