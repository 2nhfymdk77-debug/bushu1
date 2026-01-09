import { useState, useEffect } from "react";

export default function SettingsPage({ isMobile }: { isMobile: boolean }) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const storedApiKey = localStorage.getItem("binance_api_key");
    const storedApiSecret = localStorage.getItem("binance_api_secret");
    if (storedApiKey && storedApiSecret) {
      setApiKey(storedApiKey);
      setApiSecret(storedApiSecret);
      checkConnection(storedApiKey, storedApiSecret);
    }
  }, []);

  const checkConnection = async (key: string, secret: string) => {
    try {
      const response = await fetch("/api/binance/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, apiSecret: secret }),
      });
      setIsConnected(response.ok);
    } catch (error) {
      setIsConnected(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      alert("API密钥不能为空");
      return;
    }

    setIsConnecting(true);
    try {
      await checkConnection(apiKey, apiSecret);
      if (isConnected) {
        localStorage.setItem("binance_api_key", apiKey);
        localStorage.setItem("binance_api_secret", apiSecret);
        alert("配置已保存");
      } else {
        alert("API密钥验证失败，请检查后重试");
      }
    } catch (error) {
      alert("连接失败，请检查网络和API密钥");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* API配置 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">API配置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入您的API Key"
              className="w-full bg-gray-700 rounded px-4 py-3 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="输入您的API Secret"
              className="w-full bg-gray-700 rounded px-4 py-3 text-white"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={isConnecting}
            className={`w-full py-3 rounded-lg font-medium transition-all ${
              isConnecting ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isConnecting ? "验证中..." : "保存配置"}
          </button>
          {isConnected && (
            <div className="text-green-400 text-sm">✓ API连接成功</div>
          )}
        </div>
      </div>

      {/* 系统信息 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">系统信息</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">版本</span>
            <span>v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">环境</span>
            <span>主网</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">支持交易所</span>
            <span>币安</span>
          </div>
        </div>
      </div>

      {/* 安全提示 */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-400 mb-2">⚠️ 安全提示</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• API密钥仅存储在浏览器本地</li>
          <li>• 请勿泄露您的API密钥</li>
          <li>• 建议设置IP白名单限制访问</li>
          <li>• 建议禁用提现权限</li>
        </ul>
      </div>
    </div>
  );
}
