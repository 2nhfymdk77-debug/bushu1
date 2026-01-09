import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://fapi.binance.com";

function createSignature(queryString: string, apiSecret: string): string {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

/**
 * 扫描多个交易对的信号
 */
export async function POST(request: NextRequest) {
  try {
    const {
      apiKey,
      apiSecret,
      strategyId,
      symbols,
      params,
      interval = "15m",
    } = await request.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, error: "API密钥不能为空" },
        { status: 400 }
      );
    }

    if (!strategyId || !symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数: strategyId, symbols" },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // 遍历所有交易对
    for (const symbol of symbols) {
      try {
        // 1. 获取K线数据
        const timestamp = Date.now();
        const klineQueryString = new URLSearchParams({
          symbol: symbol.toUpperCase(),
          interval,
          limit: "200",
        }).toString();
        const klineSignature = createSignature(klineQueryString, apiSecret);

        const klineResponse = await fetch(
          `${BASE_URL}/fapi/v1/klines?${klineQueryString}&signature=${klineSignature}&timestamp=${timestamp}`,
          {
            headers: {
              "X-MBX-APIKEY": apiKey,
            },
          }
        );

        if (!klineResponse.ok) {
          throw new Error(`获取K线数据失败: ${klineResponse.statusText}`);
        }

        const klineData = await klineResponse.json();
        const klines = klineData.map((k: any[]) => ({
          timestamp: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));

        // 2. 调用策略检测信号
        const detectResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5000"}/api/strategy/detect`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              strategyId,
              symbol: symbol.toUpperCase(),
              klines,
              params,
            }),
          }
        );

        if (!detectResponse.ok) {
          throw new Error(`策略检测失败: ${detectResponse.statusText}`);
        }

        const detectResult = await detectResponse.json();

        results.push({
          symbol: symbol.toUpperCase(),
          success: true,
          signal: detectResult.data.signal,
          reason: detectResult.data.reason,
          details: detectResult.data.details,
        });
      } catch (error: any) {
        errors.push({
          symbol: symbol.toUpperCase(),
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        errors,
        totalSymbols: symbols.length,
        successCount: results.length,
        errorCount: errors.length,
        signalCount: results.filter(r => r.signal !== null).length,
      },
    });
  } catch (error: any) {
    console.error("Scan symbols error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "扫描失败",
      },
      { status: 500 }
    );
  }
}
