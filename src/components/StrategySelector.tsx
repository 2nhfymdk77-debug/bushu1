/**
 * 策略选择和配置组件
 * 用于选择交易策略和配置策略参数
 */

import React, { useState, useEffect } from "react";
import {
  StrategyMeta,
  StrategyConfigItem,
  BaseStrategyParams
} from "../types/strategy";
import { strategyManager } from "../utils/strategyManager";

interface StrategySelectorProps {
  onStrategyChange: (strategyId: string, params: BaseStrategyParams) => void;
}

export default function StrategySelector({ onStrategyChange }: StrategySelectorProps) {
  // 当前选中的策略ID
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");

  // 当前策略的参数
  const [strategyParams, setStrategyParams] = useState<BaseStrategyParams>({});

  // 策略列表
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);

  // 当前策略的配置项
  const [configItems, setConfigItems] = useState<StrategyConfigItem[]>([]);

  // 参数验证错误
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 初始化加载策略列表
  useEffect(() => {
    const allStrategies = strategyManager.getAllStrategyMetas();
    setStrategies(allStrategies);

    // 默认选择第一个策略
    if (allStrategies.length > 0 && !selectedStrategyId) {
      const defaultStrategy = allStrategies[0];
      setSelectedStrategyId(defaultStrategy.id);
    }
  }, []);

  // 加载选中的策略配置
  useEffect(() => {
    if (!selectedStrategyId) return;

    // 获取默认参数
    const defaultParams = strategyManager.getDefaultParams(selectedStrategyId);
    if (defaultParams) {
      setStrategyParams(defaultParams);
    }

    // 获取配置项
    const items = strategyManager.getConfigItems(selectedStrategyId);
    setConfigItems(items);
  }, [selectedStrategyId]);

  // 当策略或参数变化时，通知父组件
  useEffect(() => {
    if (selectedStrategyId && Object.keys(strategyParams).length > 0) {
      onStrategyChange(selectedStrategyId, strategyParams);
    }
  }, [selectedStrategyId, strategyParams, onStrategyChange]);

  // 验证参数
  useEffect(() => {
    if (!selectedStrategyId) return;

    const validation = strategyManager.validateParams(selectedStrategyId, strategyParams);
    setValidationErrors(validation.errors);
  }, [selectedStrategyId, strategyParams]);

  // 更新参数
  const updateParam = (key: string, value: any) => {
    setStrategyParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 按分组分类配置项
  const groupedConfigItems = configItems.reduce((acc, item) => {
    const category = item.category || "其他";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, StrategyConfigItem[]>);

  // 渲染配置项
  const renderConfigItem = (item: StrategyConfigItem) => {
    const value = strategyParams[item.key] ?? item.defaultValue;

    switch (item.type) {
      case "number":
        return (
          <div key={item.key} className="bg-gray-700/30 rounded-lg p-4">
            <label className="block text-sm text-gray-400 mb-2">
              {item.label}
              {item.description && (
                <span className="text-xs text-gray-500 ml-2">
                  ({item.description})
                </span>
              )}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => {
                const numValue = Number(e.target.value);
                if (
                  (item.min === undefined || numValue >= item.min) &&
                  (item.max === undefined || numValue <= item.max)
                ) {
                  updateParam(item.key, numValue);
                }
              }}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
              step={item.step || 0.01}
              min={item.min}
              max={item.max}
            />
            {item.min !== undefined && item.max !== undefined && (
              <div className="text-xs text-gray-500 mt-1">
                范围: {item.min} - {item.max}
              </div>
            )}
          </div>
        );

      case "checkbox":
        return (
          <label key={item.key} className="flex items-center gap-3 cursor-pointer bg-gray-700/30 rounded-lg p-4">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => updateParam(item.key, e.target.checked)}
              className="w-5 h-5"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{item.label}</div>
              {item.description && (
                <div className="text-xs text-gray-400 mt-1">{item.description}</div>
              )}
            </div>
          </label>
        );

      case "select":
        return (
          <div key={item.key} className="bg-gray-700/30 rounded-lg p-4">
            <label className="block text-sm text-gray-400 mb-2">
              {item.label}
            </label>
            <select
              value={value}
              onChange={(e) => updateParam(item.key, e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            >
              {item.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case "text":
        return (
          <div key={item.key} className="bg-gray-700/30 rounded-lg p-4">
            <label className="block text-sm text-gray-400 mb-2">
              {item.label}
            </label>
            <input
              type="text"
              value={value || ""}
              onChange={(e) => updateParam(item.key, e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // 风险等级颜色
  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "low":
        return "text-green-400";
      case "medium":
        return "text-yellow-400";
      case "high":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* 策略选择 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">选择交易策略</h2>

        <div className="space-y-3">
          {strategies.map((strategy) => {
            const isSelected = selectedStrategyId === strategy.id;
            return (
              <div
                key={strategy.id}
                onClick={() => setSelectedStrategyId(strategy.id)}
                className={`p-4 rounded-lg cursor-pointer transition ${
                  isSelected
                    ? "bg-blue-900/30 border-2 border-blue-500"
                    : "bg-gray-700/50 border-2 border-transparent hover:bg-gray-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{strategy.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${getRiskLevelColor(strategy.riskLevel)}`}>
                        {strategy.riskLevel === "low" && "低风险"}
                        {strategy.riskLevel === "medium" && "中风险"}
                        {strategy.riskLevel === "high" && "高风险"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{strategy.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>版本: {strategy.version}</span>
                      <span>分类: {strategy.category}</span>
                      <span>支持周期: {strategy.timeframe.join(", ")}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="text-2xl text-blue-500">✓</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 策略参数配置 */}
      {selectedStrategyId && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">策略参数配置</h2>

            {/* 参数验证状态 */}
            {validationErrors.length > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <span>⚠️</span>
                <span className="text-sm">{validationErrors.length} 个参数错误</span>
              </div>
            )}
          </div>

          {/* 参数验证错误列表 */}
          {validationErrors.length > 0 && (
            <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-red-400 mb-2">参数验证错误</h4>
              <ul className="text-xs text-red-300 space-y-1 list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 按分组显示配置项 */}
          {Object.entries(groupedConfigItems).map(([category, items]) => (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(renderConfigItem)}
              </div>
            </div>
          ))}

          {/* 重置参数按钮 */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <button
              onClick={() => {
                const defaultParams = strategyManager.getDefaultParams(selectedStrategyId);
                if (defaultParams) {
                  setStrategyParams(defaultParams);
                }
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition"
            >
              重置为默认参数
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
