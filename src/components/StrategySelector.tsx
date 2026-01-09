"use client";

import React, { useState, useEffect } from "react";
import { strategyManager } from "@/utils/strategyManager";
import { StrategyConfigItem, StrategyMeta, BaseStrategyParams } from "@/types/strategy";

interface StrategySelectorProps {
  onStrategyChange: (strategyId: string, params: BaseStrategyParams) => void;
  initialStrategyId?: string;
  disabled?: boolean;
}

export default function StrategySelector({
  onStrategyChange,
  initialStrategyId,
  disabled = false,
}: StrategySelectorProps) {
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(initialStrategyId || "");
  const [params, setParams] = useState<BaseStrategyParams>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["基本参数"]));

  // 加载策略列表
  useEffect(() => {
    const allStrategies = strategyManager.getAllStrategyMetas();
    setStrategies(allStrategies);

    // 如果有初始策略ID，设置它
    if (initialStrategyId) {
      setSelectedStrategyId(initialStrategyId);
      const defaultParams = strategyManager.getDefaultParams(initialStrategyId);
      if (defaultParams) {
        setParams(defaultParams);
      }
    } else if (allStrategies.length > 0) {
      // 否则使用第一个策略
      const firstStrategy = allStrategies[0];
      setSelectedStrategyId(firstStrategy.id);
      const defaultParams = strategyManager.getDefaultParams(firstStrategy.id);
      if (defaultParams) {
        setParams(defaultParams);
      }
    }
  }, [initialStrategyId]);

  // 策略改变时，加载默认参数
  const handleStrategyChange = (strategyId: string) => {
    setSelectedStrategyId(strategyId);
    const defaultParams = strategyManager.getDefaultParams(strategyId);
    if (defaultParams) {
      setParams(defaultParams);
      onStrategyChange(strategyId, defaultParams);
    }
  };

  // 参数改变时，更新并通知父组件
  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onStrategyChange(selectedStrategyId, newParams);
  };

  // 切换分组展开/收起
  const toggleGroup = (category: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedGroups(newExpanded);
  };

  // 获取当前策略
  const currentStrategy = strategies.find((s) => s.id === selectedStrategyId);
  const configItems = currentStrategy
    ? strategyManager.getConfigItems(selectedStrategyId)
    : [];

  // 按分组组织配置项
  const groupedConfigs = configItems.reduce((acc, item) => {
    const category = item.category || "其他";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, StrategyConfigItem[]>);

  // 风险等级颜色
  const riskLevelColors = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-6">
      {/* 策略选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          选择交易策略
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <button
              key={strategy.id}
              onClick={() => !disabled && handleStrategyChange(strategy.id)}
              disabled={disabled}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                selectedStrategyId === strategy.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-700 bg-gray-800 hover:border-gray-600"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">{strategy.name}</h3>
                {selectedStrategyId === strategy.id && (
                  <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                {strategy.description}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className={`px-2 py-1 rounded-full border ${
                  riskLevelColors[strategy.riskLevel]
                }`}>
                  {strategy.riskLevel === "low" ? "低风险" :
                   strategy.riskLevel === "medium" ? "中风险" : "高风险"}
                </span>
                <span className="text-gray-500">{strategy.category}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 当前策略信息 */}
      {currentStrategy && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h4 className="font-semibold mb-2">策略详情</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-400">版本</div>
              <div className="font-medium">{currentStrategy.version}</div>
            </div>
            <div>
              <div className="text-gray-400">作者</div>
              <div className="font-medium">{currentStrategy.author || "未知"}</div>
            </div>
            <div>
              <div className="text-gray-400">分类</div>
              <div className="font-medium">{currentStrategy.category}</div>
            </div>
            <div>
              <div className="text-gray-400">支持周期</div>
              <div className="font-medium">{currentStrategy.timeframe.join(", ")}</div>
            </div>
          </div>
        </div>
      )}

      {/* 策略参数配置 */}
      {Object.keys(groupedConfigs).length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">策略参数</h3>

          {Object.entries(groupedConfigs).map(([category, items]) => (
            <div key={category} className="bg-gray-800 rounded-xl overflow-hidden">
              {/* 分组标题 */}
              <button
                onClick={() => toggleGroup(category)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 transition-colors"
              >
                <h4 className="font-semibold">{category}</h4>
                <svg
                  className={`w-5 h-5 transition-transform ${
                    expandedGroups.has(category) ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 分组内容 */}
              {expandedGroups.has(category) && (
                <div className="p-6 space-y-6 border-t border-gray-700">
                  {items.map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-300">
                          {item.label}
                        </label>
                        {item.type === "checkbox" && (
                          <span className="text-xs text-gray-500">
                            {params[item.key] ? "已启用" : "已禁用"}
                          </span>
                        )}
                      </div>

                      {/* 参数输入 */}
                      {item.type === "number" && (
                        <div className="flex items-center space-x-4">
                          <input
                            type="number"
                            value={params[item.key] ?? item.defaultValue}
                            onChange={(e) => handleParamChange(item.key, parseFloat(e.target.value))}
                            disabled={disabled}
                            min={item.min}
                            max={item.max}
                            step={item.step}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          />
                          <div className="text-xs text-gray-500">
                            {item.min !== undefined && `最小: ${item.min}`}
                            {item.min !== undefined && item.max !== undefined && " | "}
                            {item.max !== undefined && `最大: ${item.max}`}
                          </div>
                        </div>
                      )}

                      {item.type === "select" && (
                        <select
                          value={params[item.key] ?? item.defaultValue}
                          onChange={(e) => handleParamChange(item.key, e.target.value)}
                          disabled={disabled}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {item.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {item.type === "checkbox" && (
                        <button
                          onClick={() => !disabled && handleParamChange(item.key, !params[item.key])}
                          disabled={disabled}
                          className={`w-full p-3 rounded-lg border-2 transition-all ${
                            params[item.key]
                              ? "bg-blue-500/10 border-blue-500 text-blue-400"
                              : "bg-gray-900 border-gray-700 text-gray-400"
                          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {params[item.key] ? "✓ 已启用" : "✗ 已禁用"}
                        </button>
                      )}

                      {item.type === "text" && (
                        <input
                          type="text"
                          value={params[item.key] ?? item.defaultValue}
                          onChange={(e) => handleParamChange(item.key, e.target.value)}
                          disabled={disabled}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                      )}

                      {/* 参数说明 */}
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-2">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 参数验证信息 */}
      {selectedStrategyId && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h4 className="font-semibold mb-3">参数验证</h4>
          <div className="text-sm text-gray-400">
            {(() => {
              const validation = strategyManager.validateParams(selectedStrategyId, params);
              if (validation.valid) {
                return (
                  <div className="flex items-center text-green-400">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    参数配置有效
                  </div>
                );
              } else {
                return (
                  <div className="space-y-1">
                    <div className="flex items-center text-red-400">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      参数配置错误
                    </div>
                    <ul className="list-disc list-inside text-red-400 ml-7">
                      {validation.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
