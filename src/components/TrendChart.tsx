import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Indicator } from "../types";
import {
  aggregateYear,
  formatNumber,
  getValue,
  LINE_PALETTE,
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

type Granularity = "year" | "month";

export default function TrendChart({
  indicators,
  years,
  lookup,
  months,
  aggregation,
  targetMonth,
}: Props) {
  const [granularity, setGranularity] = useState<Granularity>("year");
  const [indexMode, setIndexMode] = useState(false);

  const units = useMemo(
    () => [...new Set(indicators.map((i) => i.unit ?? "(単位なし)"))],
    [indicators]
  );
  const mixedUnits = units.length > 1;

  // チャートデータ生成
  const { chartData, xKey } = useMemo(() => {
    type Point = Record<string, number | string | null>;
    const points: Point[] = [];

    if (granularity === "year") {
      for (const y of years) {
        const p: Point = { x: `${y}` };
        for (const ind of indicators) {
          p[ind.id] = aggregateYear(lookup, ind.id, y, months, aggregation, targetMonth);
        }
        points.push(p);
      }
    } else {
      for (const y of years) {
        for (const mo of months) {
          const p: Point = { x: `${y}/${mo}` };
          let any = false;
          for (const ind of indicators) {
            const v = getValue(lookup, ind.id, y, mo);
            p[ind.id] = v;
            if (v !== null) any = true;
          }
          if (any) points.push(p);
        }
      }
    }

    // 指数化(各指標の最初の有効値=100)
    if (indexMode) {
      const base: Record<string, number | undefined> = {};
      for (const ind of indicators) {
        for (const p of points) {
          const v = p[ind.id];
          if (typeof v === "number") {
            base[ind.id] = v;
            break;
          }
        }
      }
      for (const p of points) {
        for (const ind of indicators) {
          const v = p[ind.id];
          const b = base[ind.id];
          p[ind.id] = typeof v === "number" && b ? (v / b) * 100 : null;
        }
      }
    }

    return { chartData: points, xKey: "x" };
  }, [indicators, years, lookup, months, aggregation, targetMonth, granularity, indexMode]);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      {/* コントロール */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex gap-1">
          <Toggle active={granularity === "year"} onClick={() => setGranularity("year")}>
            年次
          </Toggle>
          <Toggle active={granularity === "month"} onClick={() => setGranularity("month")}>
            月次
          </Toggle>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-gray-600">
          <input
            type="checkbox"
            checked={indexMode}
            onChange={(e) => setIndexMode(e.target.checked)}
          />
          指数化(基準=100)
        </label>
        {granularity === "year" && (
          <span className="text-xs text-gray-400">
            {aggregation === "month"
              ? `各年 ${targetMonth}月の値`
              : aggregation === "avg"
                ? "年平均"
                : "年合計"}
          </span>
        )}
        {mixedUnits && !indexMode && (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            単位が混在しています（{units.join(" / ")}）。比較には「指数化」がおすすめです。
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={460}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
          {/* コロナ期(2020-2021)を薄く強調 */}
          {granularity === "year" &&
            years.includes(2020) &&
            years.includes(2021) && (
              <ReferenceArea
                x1="2020"
                x2="2021"
                fill="#f1c40f"
                fillOpacity={0.08}
                ifOverflow="extendDomain"
              />
            )}
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11 }}
            interval={granularity === "month" ? "preserveStartEnd" : 0}
            minTickGap={granularity === "month" ? 24 : 4}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={56}
            tickFormatter={(v) => formatNumber(Number(v))}
            domain={indexMode ? ["auto", "auto"] : [0, "auto"]}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const ind = indicators.find((i) => i.id === name);
              const unit = indexMode ? "(指数)" : ind?.unit ? ` ${ind.unit}` : "";
              return [`${formatNumber(value)}${unit}`, ind?.name ?? name];
            }}
            labelFormatter={(l) => (granularity === "year" ? `${l}年` : l)}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) =>
              indicators.find((i) => i.id === value)?.name ?? value
            }
          />
          {indicators.map((ind, i) => (
            <Line
              key={ind.id}
              type="monotone"
              dataKey={ind.id}
              stroke={LINE_PALETTE[i % LINE_PALETTE.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-gray-400">
        ※ 黄色の帯は新型コロナ影響期(2020〜2021年)の目安です。線が途切れている箇所は欠測です。
      </p>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-3 py-1 transition ${
        active
          ? "border-karatsu-600 bg-karatsu-600 text-white"
          : "border-gray-300 bg-white text-gray-600 hover:border-karatsu-300"
      }`}
    >
      {children}
    </button>
  );
}
