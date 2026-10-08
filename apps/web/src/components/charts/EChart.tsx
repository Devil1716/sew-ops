"use client";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

/** Light wrapper so pages don't import echarts directly. */
export function EChart({ option, height = 240 }: { option: EChartsOption; height?: number }) {
  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  );
}
