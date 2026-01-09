import { NextRequest, NextResponse } from "next/server";

// 任务类型
type TaskStatus = "idle" | "running" | "paused" | "stopped" | "error";

interface Task {
  id: string;
  name: string;
  strategyId: string;
  strategyParams: Record<string, any>;
  symbols: string[];
  status: TaskStatus;
  totalSignals: number;
  executedTrades: number;
  skippedTrades: number;
  failedTrades: number;
  netProfit: number;
  winRate: number;
  riskStatus: "normal" | "warning" | "critical";
  createdAt: number;
  updatedAt: number;
}

// 内存存储（生产环境应使用数据库）
let tasks: Task[] = [];

// GET - 获取所有任务
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// POST - 创建新任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.strategyId || !body.symbols || !body.strategyParams) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少必要参数: name, strategyId, symbols, strategyParams",
        },
        { status: 400 }
      );
    }

    const newTask: Task = {
      id: `task_${Date.now()}`,
      name: body.name,
      strategyId: body.strategyId,
      strategyParams: body.strategyParams,
      symbols: body.symbols,
      status: "idle",
      totalSignals: 0,
      executedTrades: 0,
      skippedTrades: 0,
      failedTrades: 0,
      netProfit: 0,
      winRate: 0,
      riskStatus: "normal",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tasks.push(newTask);

    return NextResponse.json({
      success: true,
      data: newTask,
    });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// PUT - 更新任务
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "缺少任务ID" },
        { status: 400 }
      );
    }

    const taskIndex = tasks.findIndex((t) => t.id === body.id);

    if (taskIndex === -1) {
      return NextResponse.json(
        { success: false, error: "任务不存在" },
        { status: 404 }
      );
    }

    // 更新任务
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...body,
      updatedAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      data: tasks[taskIndex],
    });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除任务
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "缺少任务ID" },
        { status: 400 }
      );
    }

    const taskIndex = tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      return NextResponse.json(
        { success: false, error: "任务不存在" },
        { status: 404 }
      );
    }

    tasks.splice(taskIndex, 1);

    return NextResponse.json({
      success: true,
      data: { message: "任务已删除" },
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}
