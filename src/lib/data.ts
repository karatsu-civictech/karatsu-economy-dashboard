import type { Dataset, SeriesPoint } from "../types";

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data.json`);
  if (!res.ok) throw new Error(`データの読み込みに失敗しました (HTTP ${res.status})`);
  return (await res.json()) as Dataset;
}

// "indicatorId|year|month" → value の高速参照テーブル
export function buildLookup(series: SeriesPoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of series) {
    m.set(`${p.indicatorId}|${p.year}|${p.month}`, p.value);
  }
  return m;
}

export function getValue(
  lookup: Map<string, number>,
  indicatorId: string,
  year: number,
  month: number
): number | null {
  const v = lookup.get(`${indicatorId}|${year}|${month}`);
  return v === undefined ? null : v;
}

export type Aggregation = "month" | "avg" | "sum";

// 指標×年の集計値を返す。aggregation="month" のときは targetMonth を使用。
export function aggregateYear(
  lookup: Map<string, number>,
  indicatorId: string,
  year: number,
  months: number[],
  aggregation: Aggregation,
  targetMonth: number
): number | null {
  if (aggregation === "month") {
    return getValue(lookup, indicatorId, year, targetMonth);
  }
  const vals: number[] = [];
  for (const mo of months) {
    const v = getValue(lookup, indicatorId, year, mo);
    if (v !== null) vals.push(v);
  }
  if (vals.length === 0) return null;
  if (aggregation === "sum") return vals.reduce((a, b) => a + b, 0);
  // avg
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const NUM_FMT = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

export function formatNumber(v: number | null): string {
  if (v === null || v === undefined) return "–";
  return NUM_FMT.format(v);
}

// カテゴリ別の配色(唐津の海・焼物・自然をイメージ)
export const CATEGORY_COLORS: Record<string, string> = {
  観光: "#1e6fb0",
  企業活動: "#e0792a",
  一次産業: "#2f9e6b",
  雇用: "#9b59b6",
  個人消費: "#d6455d",
  広域交流: "#caa02c",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#64748b";
}

// 複数系列を重ねて描く際の線色パレット
export const LINE_PALETTE = [
  "#1e6fb0",
  "#e0792a",
  "#2f9e6b",
  "#d6455d",
  "#9b59b6",
  "#caa02c",
  "#0f8a8a",
  "#7b5ea7",
  "#c2473c",
  "#3b7dd8",
];

// 令和/平成の和暦補助表示
export function wareki(year: number): string {
  if (year >= 2019) return `R${year - 2018}`;
  return `H${year - 1988}`;
}
