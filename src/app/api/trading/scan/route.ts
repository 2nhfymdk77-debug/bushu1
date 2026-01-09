import { NextRequest, NextResponse } from "next/server";
import { strategyManager } from "@/strategies/StrategyManager";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, apiSecret, strategyId, symbols, params, interval } = body;

    // 验证参数
    if (!strategyId || !symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    // 检查策略是否存在
    const strategy = strategyManager.getStrategy(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: `策略 ${strategyId} 不存在` },
        { status: 400 }
      );
    }

    // 从币安获取K线数据
    const results = [];
    const errors = [];

    for (const symbol of symbols) {
      try {
        const klines = await fetchKlines(symbol, interval);

        if (!klines || klines.length === 0) {
          errors.push({
            symbol,
            error: "获取K线数据失败"
          });
          continue;
        }

        // 检测信号
        const signalResult = strategy.detectSignal(symbol, klines, params);

        if (signalResult.signal) {
          results.push({
            symbol,
            signal: signalResult.signal,
            reason: signalResult.reason,
            details: signalResult.details,
          });
        }
      } catch (error: any) {
        errors.push({
          symbol,
          error: error.message || "扫描失败"
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        errors,
        signalCount: results.length,
      }
    });

  } catch (error: any) {
    console.error("扫描API错误:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}

/**
 * 从币安获取K线数据
 */
async function fetchKlines(symbol: string, interval: string = "15m"): Promise<any[]> {
  try {
    const baseUrl = "https://fapi.binance.com";
    const endpoint = "/fapi/v1/klines";

    // 获取最近200根K线
    const limit = 200;
    const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`币安API错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 转换K线数据格式
    const klines = data.map((kline: any[]) => ({
      timestamp: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }));

    return klines;
  } catch (error: any) {
    console.error(`获取 ${symbol} K线数据失败:`, error);
    throw error;
  }
}
