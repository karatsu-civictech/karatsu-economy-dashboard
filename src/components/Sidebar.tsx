import { useMemo, useState } from "react";
import type { Dataset } from "../types";
import { type Aggregation, categoryColor } from "../lib/data";

interface Props {
  data: Dataset;
  yearFrom: number;
  yearTo: number;
  setYearFrom: (y: number) => void;
  setYearTo: (y: number) => void;
  selectedCategories: Set<string>;
  setSelectedCategories: (s: Set<string>) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  aggregation: Aggregation;
  setAggregation: (a: Aggregation) => void;
  targetMonth: number;
  setTargetMonth: (m: number) => void;
}

export default function Sidebar(props: Props) {
  const {
    data,
    yearFrom,
    yearTo,
    setYearFrom,
    setYearTo,
    selectedCategories,
    setSelectedCategories,
    selectedIds,
    setSelectedIds,
    aggregation,
    setAggregation,
    targetMonth,
    setTargetMonth,
  } = props;

  const [search, setSearch] = useState("");

  const toggleCategory = (c: string) => {
    const next = new Set(selectedCategories);
    next.has(c) ? next.delete(c) : next.add(c);
    setSelectedCategories(next);
  };

  const toggleIndicator = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  // 検索＆カテゴリでフィルタした指標を、カテゴリごとにまとめる
  const grouped = useMemo(() => {
    const q = search.trim();
    const map = new Map<string, typeof data.indicators>();
    for (const ind of data.indicators) {
      if (!selectedCategories.has(ind.category)) continue;
      if (q && !ind.name.includes(q)) continue;
      if (!map.has(ind.category)) map.set(ind.category, []);
      map.get(ind.category)!.push(ind);
    }
    return map;
  }, [data.indicators, selectedCategories, search]);

  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const list of grouped.values()) for (const i of list) ids.push(i.id);
    return ids;
  }, [grouped]);

  const selectAllVisible = () => {
    const next = new Set(selectedIds);
    for (const id of visibleIds) next.add(id);
    setSelectedIds(next);
  };
  const clearAllVisible = () => {
    const next = new Set(selectedIds);
    for (const id of visibleIds) next.delete(id);
    setSelectedIds(next);
  };

  return (
    <aside className="w-full shrink-0 border-b border-gray-200 bg-white lg:w-80 lg:border-b-0 lg:border-r">
      <div className="space-y-5 p-4">
        {/* 期間 */}
        <Section title="期間">
          <div className="flex items-center gap-2">
            <YearSelect
              value={yearFrom}
              years={data.meta.years.filter((y) => y <= yearTo)}
              onChange={setYearFrom}
            />
            <span className="text-gray-400">〜</span>
            <YearSelect
              value={yearTo}
              years={data.meta.years.filter((y) => y >= yearFrom)}
              onChange={setYearTo}
            />
          </div>
        </Section>

        {/* 集計方法 */}
        <Section title="集計方法">
          <div className="flex gap-1">
            <Seg active={aggregation === "month"} onClick={() => setAggregation("month")}>
              単月
            </Seg>
            <Seg active={aggregation === "avg"} onClick={() => setAggregation("avg")}>
              年平均
            </Seg>
            <Seg active={aggregation === "sum"} onClick={() => setAggregation("sum")}>
              年合計
            </Seg>
          </div>
          {aggregation === "month" ? (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-gray-500">対象月</span>
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-1"
              >
                {data.meta.months.map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-400">
              ※ 欠測月を除いて{aggregation === "avg" ? "平均" : "合計"}します
            </p>
          )}
        </Section>

        {/* カテゴリ */}
        <Section title="カテゴリ">
          <div className="flex flex-wrap gap-1.5">
            {data.meta.categories.map((c) => {
              const on = selectedCategories.has(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    on
                      ? "border-transparent text-white"
                      : "border-gray-300 bg-white text-gray-500"
                  }`}
                  style={on ? { backgroundColor: categoryColor(c) } : undefined}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 指標 */}
        <Section title="指標">
          <input
            type="search"
            placeholder="指標を検索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="mb-2 flex gap-3 text-xs">
            <button onClick={selectAllVisible} className="text-karatsu-600 hover:underline">
              表示中をすべて選択
            </button>
            <button onClick={clearAllVisible} className="text-gray-500 hover:underline">
              選択解除
            </button>
          </div>
          <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-26rem)]">
            {[...grouped.entries()].map(([cat, list]) => (
              <div key={cat}>
                <div
                  className="mb-1 text-xs font-semibold"
                  style={{ color: categoryColor(cat) }}
                >
                  {cat}
                </div>
                <ul className="space-y-0.5">
                  {list.map((ind) => (
                    <li key={ind.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ind.id)}
                          onChange={() => toggleIndicator(ind.id)}
                          className="mt-0.5"
                        />
                        <span className="leading-tight">
                          {ind.name}
                          {ind.unit && (
                            <span className="text-gray-400"> ({ind.unit})</span>
                          )}
                          {ind.notes.length > 0 && (
                            <span title={ind.notes.join("\n")} className="ml-1 text-amber-500">
                              ※
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {visibleIds.length === 0 && (
              <p className="text-xs text-gray-400">該当する指標がありません。</p>
            )}
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function YearSelect({
  value,
  years,
  onChange,
}: {
  value: number;
  years: number[];
  onChange: (y: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}年
        </option>
      ))}
    </select>
  );
}

function Seg({
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
      className={`flex-1 rounded border px-2 py-1 text-sm transition ${
        active
          ? "border-karatsu-600 bg-karatsu-600 text-white"
          : "border-gray-300 bg-white text-gray-600 hover:border-karatsu-300"
      }`}
    >
      {children}
    </button>
  );
}
