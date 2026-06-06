import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "./types";
import { loadDataset, buildLookup, type Aggregation } from "./lib/data";
import Sidebar from "./components/Sidebar";
import DataTable from "./components/DataTable";
import TrendChart from "./components/TrendChart";

type View = "table" | "chart";

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  // フィルタ状態
  const [yearFrom, setYearFrom] = useState<number>(0);
  const [yearTo, setYearTo] = useState<number>(0);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aggregation, setAggregation] = useState<Aggregation>("month");
  const [targetMonth, setTargetMonth] = useState<number>(1);
  const [view, setView] = useState<View>("table");

  useEffect(() => {
    loadDataset()
      .then((d) => {
        setData(d);
        setYearFrom(d.meta.years[0]);
        setYearTo(d.meta.years[d.meta.years.length - 1]);
        setSelectedCategories(new Set(d.meta.categories));
        // 初期選択: 各カテゴリの先頭1指標(最大6本)
        const firstOfEach: string[] = [];
        for (const c of d.meta.categories) {
          const ind = d.indicators.find((i) => i.category === c);
          if (ind) firstOfEach.push(ind.id);
        }
        setSelectedIds(new Set(firstOfEach.slice(0, 6)));
      })
      .catch((e) => setError(e.message));
  }, []);

  const lookup = useMemo(() => (data ? buildLookup(data.series) : new Map()), [data]);

  const years = useMemo(() => {
    if (!data) return [];
    return data.meta.years.filter((y) => y >= yearFrom && y <= yearTo);
  }, [data, yearFrom, yearTo]);

  // 表示対象の指標(カテゴリ絞り込み後、かつ選択中)
  const visibleIndicators = useMemo(() => {
    if (!data) return [];
    return data.indicators.filter(
      (i) => selectedCategories.has(i.category) && selectedIds.has(i.id)
    );
  }, [data, selectedCategories, selectedIds]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center text-red-700">
        <div>
          <p className="text-lg font-bold">データを読み込めませんでした</p>
          <p className="mt-2 text-sm">{error}</p>
          <p className="mt-4 text-xs text-gray-500">
            <code>npm run data:offline</code> で public/data.json を生成してください。
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center text-karatsu-700">
        <p className="animate-pulse text-sm">データを読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header data={data} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar
          data={data}
          yearFrom={yearFrom}
          yearTo={yearTo}
          setYearFrom={setYearFrom}
          setYearTo={setYearTo}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          aggregation={aggregation}
          setAggregation={setAggregation}
          targetMonth={targetMonth}
          setTargetMonth={setTargetMonth}
        />

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <ViewTabs view={view} setView={setView} count={visibleIndicators.length} />

          {visibleIndicators.length === 0 ? (
            <div className="mt-10 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
              左の「指標」から表示したい項目を選択してください。
            </div>
          ) : view === "table" ? (
            <DataTable
              indicators={visibleIndicators}
              years={years}
              lookup={lookup}
              months={data.meta.months}
              aggregation={aggregation}
              targetMonth={targetMonth}
            />
          ) : (
            <TrendChart
              indicators={visibleIndicators}
              years={years}
              lookup={lookup}
              months={data.meta.months}
              aggregation={aggregation}
              targetMonth={targetMonth}
            />
          )}
        </main>
      </div>
      <Footer data={data} />
    </div>
  );
}

function Header({ data }: { data: Dataset }) {
  return (
    <header className="bg-karatsu-800 px-4 py-3 text-white lg:px-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold tracking-wide lg:text-xl">
          唐津市 経済動向ダッシュボード
        </h1>
        <span className="text-xs text-karatsu-100/80">
          {data.meta.years[0]}年〜{data.meta.years[data.meta.years.length - 1]}年 / 月次
        </span>
      </div>
    </header>
  );
}

function ViewTabs({
  view,
  setView,
  count,
}: {
  view: View;
  setView: (v: View) => void;
  count: number;
}) {
  const tab = (v: View, label: string) => (
    <button
      onClick={() => setView(v)}
      className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
        view === v
          ? "bg-white text-karatsu-800 shadow-sm"
          : "bg-transparent text-gray-500 hover:text-karatsu-700"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center justify-between border-b border-gray-200">
      <div className="flex gap-1">
        {tab("table", "テーブル")}
        {tab("chart", "グラフ")}
      </div>
      <span className="pb-2 text-xs text-gray-400">選択中 {count} 指標</span>
    </div>
  );
}

function Footer({ data }: { data: Dataset }) {
  const built = new Date(data.meta.builtAt);
  const builtStr = isNaN(built.getTime())
    ? data.meta.builtAt
    : `${built.getFullYear()}/${built.getMonth() + 1}/${built.getDate()}`;
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 lg:px-6">
      出典:{" "}
      <a
        href={data.meta.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="text-karatsu-600 underline"
      >
        {data.meta.source} 経済動向データ
      </a>
      {" / "}データ生成: {builtStr}
      {" / "}このダッシュボードはシビックテックによる非公式の可視化です。
    </footer>
  );
}
