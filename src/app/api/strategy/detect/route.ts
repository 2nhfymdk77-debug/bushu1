import { NextRequest, NextResponse } from "next/server";
import { strategyManager } from "@/utils/strategyManager";

interface DetectRequest {
  strategyId: string;
  symbol: string;
  klines: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  params: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: DetectRequest = await request.json();

    // 验证请求参数
    if (!body.strategyId || !body.symbol || !body.klines || !body.params) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少必要参数: strategyId, symbol, klines, params",
        },
        { status: 400 }
      );
    }

    // 验证策略是否存在
    if (!strategyManager.hasStrategy(body.strategyId)) {
      return NextResponse.json(
        {
          success: false,
          error: `策略 [${body.strategyId}] 不存在`,
        },
        { status: 404 }
      );
    }

    // 转换K线数据格式
    const klines = body.klines.map((k) => ({
      timestamp: k.timestamp,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }));

    // 调用策略检测信号
    const result = strategyManager.detectSignal(
      body.strategyId,
      body.symbol,
      klines,
      body.params
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Strategy detect error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// 获取所有可用策略列表
export async function GET() {
  try {
    const strategies = strategyManager.getAllStrategyMetas();

    return NextResponse.json({
      success: true,
      data: strategies,
    });
  } catch (error) {
    console.error("Get strategies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}
