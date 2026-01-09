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
 * 执行开仓/平仓订单
 */
export async function POST(request: NextRequest) {
  try {
    const {
      apiKey,
      apiSecret,
      symbol,
      side, // "BUY" or "SELL"
      positionSide, // "LONG" or "SHORT"
      quantity,
      type = "MARKET",
      leverage = 1,
    } = await request.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, error: "API密钥不能为空" },
        { status: 400 }
      );
    }

    if (!symbol || !side || !quantity) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数: symbol, side, quantity" },
        { status: 400 }
      );
    }

    // 1. 设置杠杆
    const timestamp = Date.now();
    const leverageQueryString = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      leverage: leverage.toString(),
      timestamp: timestamp.toString(),
    }).toString();
    const leverageSignature = createSignature(leverageQueryString, apiSecret);

    try {
      await fetch(`${BASE_URL}/fapi/v1/leverage?${leverageQueryString}&signature=${leverageSignature}`, {
        method: "POST",
        headers: {
          "X-MBX-APIKEY": apiKey,
        },
      });
    } catch (error) {
      console.error("Set leverage error:", error);
      // 继续执行下单
    }

    // 2. 下单
    const orderTimestamp = Date.now();
    const orderParams = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: quantity.toString(),
      positionSide: positionSide?.toUpperCase(),
      timestamp: orderTimestamp.toString(),
    };

    const orderQueryString = new URLSearchParams(orderParams).toString();
    const orderSignature = createSignature(orderQueryString, apiSecret);

    const response = await fetch(
      `${BASE_URL}/fapi/v1/order?${orderQueryString}&signature=${orderSignature}`,
      {
        method: "POST",
        headers: {
          "X-MBX-APIKEY": apiKey,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.msg || "下单失败", code: data.code },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: data.orderId,
        symbol: data.symbol,
        side: data.side,
        type: data.type,
        quantity: parseFloat(data.origQty),
        price: parseFloat(data.price) || 0,
        status: data.status,
        transactTime: data.transactTime,
      },
    });
  } catch (error: any) {
    console.error("Execute order error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "执行订单失败",
      },
      { status: 500 }
    );
  }
}
