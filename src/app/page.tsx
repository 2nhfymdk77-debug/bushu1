"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// 定义页面类型
type PageType = "dashboard" | "backtest" | "trading" | "records" | "settings";

// 导航配置
const NAVIGATION = [
  { id: "dashboard" as PageType, label: "仪表盘", icon: "📊", desc: "系统概览" },
  { id: "backtest" as PageType, label: "策略回测", icon: "🧪", desc: "测试策略" },
  { id: "trading" as PageType, label: "自动交易", icon: "⚡", desc: "实时监控" },
  { id: "records" as PageType, label: "交易记录", icon: "📝", desc: "历史数据" },
  { id: "settings" as PageType, label: "系统设置", icon: "⚙️", desc: "配置管理" },
];

export default function Home() {
  const router = useRouter();
  const [activePage, setActivePage] = useState<PageType>("dashboard");
  const [isMobile, setIsMobile] = useState(false);
  const [apiKey, setApiKey] = useState("");

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 从localStorage加载API配置
  useEffect(() => {
    const config = localStorage.getItem("binance_config");
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setApiKey(parsed.apiKey || "");
      } catch (e) {
        console.error("Failed to parse config:", e);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 桌面端：顶部导航栏 */}
      <header className="hidden md:block bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-xl font-bold">
                AT
              </div>
              <div>
                <h1 className="text-lg font-bold">自动交易系统</h1>
                <p className="text-xs text-gray-400">Cloud-Based Trading Platform</p>
              </div>
            </div>

            {/* 导航菜单 */}
            <nav className="flex items-center space-x-1">
              {NAVIGATION.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activePage === item.id
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </nav>

            {/* 用户信息 */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-300">
                  {apiKey ? `API: ${apiKey.slice(0, 8)}...` : "未配置"}
                </div>
                <div className="text-xs text-gray-500">主网交易模式</div>
              </div>
              <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-lg">👤</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 移动端：顶部标题栏 */}
      <header className="md:hidden bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">
                AT
              </div>
              <span className="font-bold">自动交易系统</span>
            </div>
            <button
              onClick={() => router.push("/settings")}
              className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center"
            >
              <span>⚙️</span>
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* 仪表盘页面 */}
        {activePage === "dashboard" && (
          <DashboardPage isMobile={isMobile} setActivePage={setActivePage} />
        )}

        {/* 策略回测页面 */}
        {activePage === "backtest" && (
          <div className="animate-fadeIn">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">策略回测</h2>
              <p className="text-gray-400">选择策略并进行历史数据回测</p>
            </div>
            <BacktestPage isMobile={isMobile} />
          </div>
        )}

        {/* 自动交易页面 */}
        {activePage === "trading" && (
          <div className="animate-fadeIn">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">自动交易</h2>
              <p className="text-gray-400">实时监控和管理自动交易任务</p>
            </div>
            <TradingPage isMobile={isMobile} />
          </div>
        )}

        {/* 交易记录页面 */}
        {activePage === "records" && (
          <div className="animate-fadeIn">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">交易记录</h2>
              <p className="text-gray-400">查看历史交易和统计信息</p>
            </div>
            <RecordsPage isMobile={isMobile} />
          </div>
        )}

        {/* 系统设置页面 */}
        {activePage === "settings" && (
          <div className="animate-fadeIn">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">系统设置</h2>
              <p className="text-gray-400">配置API密钥和系统参数</p>
            </div>
            <SettingsPage isMobile={isMobile} />
          </div>
        )}
      </main>

      {/* 移动端：底部固定导航栏 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-2 py-1 z-50">
        <div className="flex justify-around">
          {NAVIGATION.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex flex-col items-center py-2 px-2 rounded-lg transition-all ${
                activePage === item.id
                  ? "text-blue-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// 仪表盘页面组件
function DashboardPage({
  isMobile,
  setActivePage,
}: {
  isMobile: boolean;
  setActivePage: (page: PageType) => void;
}) {
  return (
    <div className="animate-fadeIn">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="运行中任务"
          value="2"
          icon="⚡"
          color="blue"
          isMobile={isMobile}
        />
        <StatCard
          title="今日信号"
          value="15"
          icon="📊"
          color="green"
          isMobile={isMobile}
        />
        <StatCard
          title="今日收益"
          value="+$1,234"
          icon="💰"
          color="yellow"
          isMobile={isMobile}
        />
        <StatCard
          title="胜率"
          value="65%"
          icon="🎯"
          color="purple"
          isMobile={isMobile}
        />
      </div>

      {/* 快速操作 */}
      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4">快速操作</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionCard
            title="新建回测"
            icon="🧪"
            onClick={() => setActivePage("backtest")}
            color="blue"
          />
          <QuickActionCard
            title="启动交易"
            icon="⚡"
            onClick={() => setActivePage("trading")}
            color="green"
          />
          <QuickActionCard
            title="查看记录"
            icon="📝"
            onClick={() => setActivePage("records")}
            color="yellow"
          />
          <QuickActionCard
            title="系统设置"
            icon="⚙️"
            onClick={() => setActivePage("settings")}
            color="gray"
          />
        </div>
      </div>

      {/* 最近活动 */}
      <div>
        <h3 className="text-lg font-bold mb-4">最近活动</h3>
        <div className="bg-gray-800 rounded-xl p-6">
          <ActivityList isMobile={isMobile} />
        </div>
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({
  title,
  value,
  icon,
  color,
  isMobile,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: "blue" | "green" | "yellow" | "purple" | "red";
  isMobile: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-green-500/20 text-green-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    purple: "bg-purple-500/20 text-purple-400",
    red: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <span className={`w-10 h-10 md:w-12 md:h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center text-xl md:text-2xl`}>
          {icon}
        </span>
      </div>
      <div className={`text-lg md:text-2xl font-bold mb-1 ${isMobile ? "text-xl" : "text-2xl"}`}>
        {value}
      </div>
      <div className="text-xs md:text-sm text-gray-400">{title}</div>
    </div>
  );
}

// 快速操作卡片组件
function QuickActionCard({
  title,
  icon,
  onClick,
  color,
}: {
  title: string;
  icon: string;
  onClick: () => void;
  color: "blue" | "green" | "yellow" | "gray";
}) {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700",
    green: "bg-green-600 hover:bg-green-700",
    yellow: "bg-yellow-600 hover:bg-yellow-700",
    gray: "bg-gray-700 hover:bg-gray-600",
  };

  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color]} rounded-xl p-6 flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95`}
    >
      <span className="text-4xl mb-2">{icon}</span>
      <span className="font-medium">{title}</span>
    </button>
  );
}

// 活动列表组件
function ActivityList({ isMobile }: { isMobile: boolean }) {
  const activities = [
    { time: "10:30", type: "signal", message: "BTCUSDT 产生做多信号", status: "success" },
    { time: "10:25", type: "trade", message: "ETHUSDT 平仓盈利 +$50.23", status: "success" },
    { time: "10:20", type: "system", message: "任务 BTC自动交易 已启动", status: "info" },
    { time: "10:15", type: "signal", message: "ETHUSDT 产生做空信号", status: "success" },
    { time: "10:10", type: "error", message: "API请求失败，重试中...", status: "error" },
  ];

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div
          key={index}
          className="flex items-center space-x-4 py-2 border-b border-gray-700 last:border-0"
        >
          <div className="text-xs text-gray-500 w-12">{activity.time}</div>
          <div className={`w-2 h-2 rounded-full ${
            activity.status === "success" ? "bg-green-500" :
            activity.status === "error" ? "bg-red-500" :
            "bg-blue-500"
          }`} />
          <div className={`flex-1 ${isMobile ? "text-sm" : "text-base"}`}>{activity.message}</div>
        </div>
      ))}
    </div>
  );
}

// 占位组件（待实现）
function BacktestPage({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="bg-gray-800 rounded-xl p-8 text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h3 className="text-xl font-bold mb-2">功能开发中</h3>
      <p className="text-gray-400">策略回测功能正在开发中，敬请期待...</p>
    </div>
  );
}

function TradingPage({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="bg-gray-800 rounded-xl p-8 text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h3 className="text-xl font-bold mb-2">功能开发中</h3>
      <p className="text-gray-400">自动交易功能正在开发中，敬请期待...</p>
    </div>
  );
}

function RecordsPage({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="bg-gray-800 rounded-xl p-8 text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h3 className="text-xl font-bold mb-2">功能开发中</h3>
      <p className="text-gray-400">交易记录功能正在开发中，敬请期待...</p>
    </div>
  );
}

function SettingsPage({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="bg-gray-800 rounded-xl p-8 text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h3 className="text-xl font-bold mb-2">功能开发中</h3>
      <p className="text-gray-400">系统设置功能正在开发中，敬请期待...</p>
    </div>
  );
}
