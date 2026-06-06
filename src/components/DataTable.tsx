import { useMemo, useState } from "react";
import type { Indicator } from "../types";
import {
  aggregateYear,
  categoryColor,
  formatNumber,
  wareki,
  type Aggregation,
} from "../lib/data";

interface Props {
  indicators: Indicator[];
  years: number[];
  lookup: Map<string, number>;
  months: number[];
  aggregation: Aggregation;
  targetMonth: number;
}

interface Row {
  ind: Indicator;
  values: (number | null)[]; // years と対応
  max: number | null;
  min: number | null;
  // 直近2点(取得できた最後の2年)の変化率(%)
  change: number | null;
}

type SortKey = "name" | "unit" | "max" | "min" | "change" | number; // number=年

export default function DataTable({
  indicators,
  years,
  lookup,
  months,
  aggregation,
  targetMonth,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);

  const rows = useMemo<Row[]>(() => {
    return indicators.map((ind) => {
      const values = years.map((y) =>
        aggregateYear(lookup, ind.id, y, months, aggregation, targetMonth)
      );
      const nums = values.filter((v): v is number => v !== null);
      const max = nums.length ? Math.max(...nums) : null;
      const min = nums.length ? Math.min(...nums) : null;
      // 直近変化率
      const present = values.filter((v): v is number => v !== null);
      let change: number | null = null;
      if (present.length >= 2) {
        const last = present[present.length - 1];
        const prev = present[present.length - 2];
        if (prev !== 0) change = ((last - prev) / Math.abs(prev)) * 100;
      }
      return { ind, values, max, min, change };
    });
  }, [indicators, years, lookup, months, aggregation, targetMonth]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    const dir = asc ? 1 : -1;
    copy.sort((a, b) => {
      let av: number | string | null;
      let bv: number | string | null;
      if (sortKey === "name") {
        av = a.ind.name;
        bv = b.ind.name;
      } else if (sortKey === "unit") {
        av = a.ind.unit ?? "";
        bv = b.ind.unit ?? "";
      } else if (sortKey === "max") {
        av = a.max;
        bv = b.max;
      } else if (sortKey === "min") {
        av = a.min;
        bv = b.min;
      } else if (sortKey === "change") {
        av = a.change;
        bv = b.change;
      } else {
        const idx = years.indexOf(sortKey);
        av = a.values[idx];
        bv = b.values[idx];
      }
      // null は常に末尾
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv, "ja") * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
    return copy;
  }, [rows, sortKey, asc, years]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setAsc(!asc);
    } else {
      setSortKey(key);
      // 数値列は降順から始めると見やすい
      setAsc(typeof key === "string" && (key === "name" || key === "unit"));
    }
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (asc ? " ▲" : " ▼") : "";

  const downloadCsv = () => {
    const header = ["カテゴリ", "指標", "単位", ...years.map((y) => `${y}`), "最大", "最小"];
    const lines = [header.join(",")];
    for (const r of sorted) {
      const cells = [
        r.ind.category,
        `"${r.ind.name}"`,
        r.ind.unit ?? "",
        ...r.values.map((v) => (v === null ? "" : v)),
        r.max ?? "",
        r.min ?? "",
      ];
      lines.push(cells.join(","));
    }
    const label =
      aggregation === "month" ? `${targetMonth}月` : aggregation === "avg" ? "年平均" : "年合計";
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `唐津市経済動向_${label}_${years[0]}-${years[years.length - 1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const aggLabel =
    aggregation === "month" ? `各年 ${targetMonth}月` : aggregation === "avg" ? "年平均" : "年合計";

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          表示値: <span className="font-medium text-gray-700">{aggLabel}</span>
          {"　"}列見出しをクリックで並べ替え
        </p>
        <button
          onClick={downloadCsv}
          className="rounded border border-karatsu-600 px-3 py-1 text-xs font-medium text-karatsu-700 hover:bg-karatsu-50"
        >
          CSVダウンロード
        </button>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="tabular min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-karatsu-50 text-karatsu-800">
              <Th sticky onClick={() => onSort("name")} className="text-left">
                指標{arrow("name")}
              </Th>
              <Th onClick={() => onSort("unit")} className="text-left">
                単位{arrow("unit")}
              </Th>
              {years.map((y) => (
                <Th key={y} onClick={() => onSort(y)} className="text-right">
                  <span className="block leading-none">{y}</span>
                  <span className="block text-[10px] font-normal text-gray-400">
                    {wareki(y)}
                  </span>
                  {arrow(y)}
                </Th>
              ))}
              <Th onClick={() => onSort("max")} className="text-right">
                最大{arrow("max")}
              </Th>
              <Th onClick={() => onSort("min")} className="text-right">
                最小{arrow("min")}
              </Th>
              <Th onClick={() => onSort("change")} className="text-right">
                直近増減{arrow("change")}
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.ind.id} className="border-t border-gray-100 hover:bg-karatsu-50/40">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[16rem] bg-white px-3 py-1.5 text-left font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColor(r.ind.category) }}
                      title={r.ind.category}
                    />
                    <span className="truncate" title={r.ind.name}>
                      {r.ind.name}
                    </span>
                    {r.ind.notes.length > 0 && (
                      <span title={r.ind.notes.join("\n")} className="text-amber-500">
                        ※
                      </span>
                    )}
                  </span>
                </th>
                <td className="px-3 py-1.5 text-left text-gray-500">{r.ind.unit ?? "–"}</td>
                {r.values.map((v, i) => (
                  <td
                    key={i}
                    className={`px-3 py-1.5 text-right ${
                      v === null ? "text-gray-300" : "text-gray-800"
                    } ${v !== null && v === r.max ? "font-semibold text-karatsu-700" : ""}`}
                  >
                    {formatNumber(v)}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right text-gray-600">{formatNumber(r.max)}</td>
                <td className="px-3 py-1.5 text-right text-gray-600">{formatNumber(r.min)}</td>
                <td
                  className={`px-3 py-1.5 text-right ${
                    r.change === null
                      ? "text-gray-300"
                      : r.change >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                  }`}
                >
                  {r.change === null
                    ? "–"
                    : `${r.change >= 0 ? "+" : ""}${r.change.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  className = "",
  sticky = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-semibold hover:bg-karatsu-100 ${
        sticky ? "sticky left-0 z-20 bg-karatsu-50" : ""
      } ${className}`}
    >
      {children}
    </th>
  );
}
