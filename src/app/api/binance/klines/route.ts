import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") || "15m";
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: "缺少symbol参数" },
        { status: 400 }
      );
    }

    // 从localStorage获取API密钥
    const apiKey = request.headers.get("x-api-key");
    const secretKey = request.headers.get("x-secret-key");

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { success: false, error: "缺少API密钥" },
        { status: 401 }
      );
    }

    // 调用币安API获取K线数据
    const timestamp = Date.now();
    const queryString = new URLSearchParams({
      symbol,
      interval,
      limit: limit.toString(),
    }).toString();

    // 生成签名
    const crypto = require("crypto");
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(queryString)
      .digest("hex");

    const url = `https://fapi.binance.com/fapi/v1/klines?${queryString}&signature=${signature}&timestamp=${timestamp}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.msg || "获取K线数据失败" },
        { status: response.status }
      );
    }

    // 转换K线数据格式
    const klines = data.map((k: any[]) => ({
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    return NextResponse.json({
      success: true,
      data: klines,
    });
  } catch (error) {
    console.error("Get klines error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}
