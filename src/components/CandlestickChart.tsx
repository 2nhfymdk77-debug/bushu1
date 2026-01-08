"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ColorType,
  LineData,
  CandlestickData,
  Time,
} from "lightweight-charts";

interface CandlestickChartProps {
  klines: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  emaShort?: number[];
  emaLong?: number[];
  trades?: Array<{
    entryTime: number;
    exitTime: number;
    direction: "long" | "short";
    entryPrice: number;
    exitPrice: number;
    pnl: number;
  }>;
  height?: number;
}

export default function CandlestickChart({
  klines,
  emaShort,
  emaLong,
  trades = [],
  height = 400,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const emaShortSeriesRef = useRef<any>(null);
  const emaLongSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1f2937" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#374151" },
        horzLines: { color: "#374151" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "#4b5563",
          width: 1,
          style: 2,
          labelBackgroundColor: "#1f2937",
        },
        horzLine: {
          color: "#4b5563",
          width: 1,
          style: 2,
          labelBackgroundColor: "#1f2937",
        },
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      timeScale: {
        borderColor: "#374151",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height,
    });

    // Add candlestick series
    candlestickSeriesRef.current = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // Add EMA short series
    emaShortSeriesRef.current = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 1,
      title: "EMA" + (emaShort?.length || 20),
    });

    // Add EMA long series
    emaLongSeriesRef.current = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1,
      title: "EMA" + (emaLong?.length || 60),
    });

    // Add volume series
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: "#6b7280",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    // Apply options to volume series
    volumeSeriesRef.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || klines.length === 0) return;

    const candlestickData: CandlestickData[] = klines.map((k) => ({
      time: (Math.floor(k.timestamp / 1000) as Time),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }));

    candlestickSeriesRef.current.setData(candlestickData);
  }, [klines]);

  useEffect(() => {
    if (!emaShortSeriesRef.current || !emaShort || emaShort.length === 0) return;

    const emaShortData: LineData[] = klines.map((k, i) => ({
      time: (Math.floor(k.timestamp / 1000) as Time),
      value: emaShort[i] || k.close,
    }));

    emaShortSeriesRef.current.setData(emaShortData);
  }, [emaShort, klines]);

  useEffect(() => {
    if (!emaLongSeriesRef.current || !emaLong || emaLong.length === 0) return;

    const emaLongData: LineData[] = klines.map((k, i) => ({
      time: (Math.floor(k.timestamp / 1000) as Time),
      value: emaLong[i] || k.close,
    }));

    emaLongSeriesRef.current.setData(emaLongData);
  }, [emaLong, klines]);

  useEffect(() => {
    if (!volumeSeriesRef.current || klines.length === 0) return;

    const volumeData = klines.map((k) => ({
      time: (Math.floor(k.timestamp / 1000) as Time),
      value: k.volume,
      color: k.close >= k.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
    }));

    volumeSeriesRef.current.setData(volumeData);
  }, [klines]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || trades.length === 0) return;

    const markers = trades.flatMap((trade) => {
      const entryTime = Math.floor(trade.entryTime / 1000) as Time;
      const exitTime = Math.floor(trade.exitTime / 1000) as Time;

      return [
        {
          time: entryTime,
          position: trade.direction === "long" ? "belowBar" : "aboveBar" as const,
          color: trade.direction === "long" ? "#22c55e" : "#ef4444",
          shape: trade.direction === "long" ? "arrowUp" : "arrowDown" as const,
          text: trade.direction === "long" ? "多" : "空",
        },
        {
          time: exitTime,
          position: trade.direction === "long" ? "aboveBar" : "belowBar" as const,
          color: trade.pnl >= 0 ? "#22c55e" : "#ef4444",
          shape: "circle" as const,
          text: trade.pnl >= 0 ? "盈" : "亏",
        },
      ];
    });

    candlestickSeriesRef.current.setMarkers(markers);
  }, [trades]);

  return (
    <div className="w-full">
      <div ref={chartContainerRef} style={{ height }} />
    </div>
  );
}
