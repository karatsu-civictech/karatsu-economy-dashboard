// 唐津市 経済動向データ ビルドスクリプト
//
// Google スプレッドシートの12タブ(1〜12月)をCSVとして取得し、
// 「指標 × 年 × 月」のロングフォーマットJSON(public/data.json)に整形する。
//
// 使い方:
//   node scripts/build-data.mjs          # ネットから取得(失敗時はraw-data/のキャッシュを使用)
//   node scripts/build-data.mjs --offline # raw-data/のキャッシュのみ使用
//
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SHEET_ID = "1YXK3KHpdkFriPlDIacyMDiqJSeFFwsQVTX5ut1g07KQ";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

// gid → 月 の対応 (htmlview のタブ順から確認済み)
const GID_BY_MONTH = {
  1: "1863988573",
  2: "276322410",
  3: "2107373774",
  4: "1541826017",
  5: "170831417",
  6: "2085896427",
  7: "338818185",
  8: "250303874",
  9: "797778791",
  10: "59570967",
  11: "1073710228",
  12: "1422164049",
};

const OFFLINE = process.argv.includes("--offline");

// --- CSVパーサ (ダブルクオート対応) ---
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// 全角→半角・空白除去などの正規化
function normalizeText(s) {
  if (s == null) return "";
  return s
    .replace(/　/g, " ") // 全角スペース
    .replace(/[﻿]/g, "")
    .trim();
}

// 全角数字を半角に
function zenkakuDigitToHankaku(s) {
  return s.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0)
  );
}

// "6,579 " → 6579 / "0.45" → 0.45 / "" → null
function parseValue(raw) {
  const s = normalizeText(raw).replace(/,/g, "");
  if (s === "" || s === "-" || s === "―") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// 単位として扱う括弧内の語(ホワイトリスト)。これ以外の括弧書きは名前の一部とする。
const UNIT_WHITELIST = new Set([
  "千円",
  "百万円",
  "円",
  "トン",
  "千人",
  "人",
  "台",
  "戸",
  "件",
  "%",
  "㎥",
]);

// 指標名から単位を抽出し、※マーカーを除去したクリーンな名前を返す
function parseIndicatorName(rawName) {
  let name = zenkakuDigitToHankaku(normalizeText(rawName));
  let hasNote = false;
  // ※N / ※ (全角/半角) を除去(番号は月ごとにズレるため使わない)
  name = name.replace(/[※＊]\s*\d*/g, () => {
    hasNote = true;
    return "";
  });
  name = name.trim();
  // 末尾の (単位) を抽出。ホワイトリストにある場合のみ単位として切り出す。
  let unit = null;
  const unitMatch = name.match(/[（(]([^（）()]+)[）)]\s*$/);
  if (unitMatch && UNIT_WHITELIST.has(unitMatch[1].trim())) {
    unit = unitMatch[1].trim();
    name = name.slice(0, unitMatch.index).trim();
  }
  return { name, unit, hasNote };
}

// 注釈ラベル・指標名の照合用キー(全角数字・空白・括弧を無視)
function matchKey(s) {
  return zenkakuDigitToHankaku(normalizeText(s))
    .replace(/\s/g, "")
    .replace(/[（）()]/g, "");
}

async function fetchCsv(gid, month) {
  const cachePath = join(ROOT, "raw-data", `${gid}.csv`);
  if (!OFFLINE) {
    const url = `${SHEET_URL}/export?format=csv&gid=${gid}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await writeFile(cachePath, text, "utf-8");
      return text;
    } catch (e) {
      console.warn(`  [${month}月] 取得失敗(${e.message}) → キャッシュ使用`);
    }
  }
  if (existsSync(cachePath)) {
    return await readFile(cachePath, "utf-8");
  }
  throw new Error(`${month}月のデータが取得できませんでした (gid=${gid})`);
}

async function main() {
  console.log(OFFLINE ? "オフラインモード(キャッシュ使用)" : "スプレッドシートから取得します...");

  const indicatorMap = new Map(); // key(category|name) → indicator
  const series = []; // { indicatorId, year, month, value }
  const noteRecords = []; // { matchKey, label, text }
  let yearList = null;

  for (let month = 1; month <= 12; month++) {
    const gid = GID_BY_MONTH[month];
    const csv = await fetchCsv(gid, month);
    const rows = parseCSV(csv);

    // 年ヘッダ行(2行目: ,,2010年,...)
    const yearRow = rows[1] || [];
    const years = yearRow
      .map((c) => {
        const m = normalizeText(c).match(/(\d{4})年?/);
        return m ? Number(m[1]) : null;
      });
    // 値が入る列インデックス(年が取れた列)
    const yearCols = [];
    years.forEach((y, idx) => {
      if (y && idx >= 2) yearCols.push({ col: idx, year: y });
    });
    if (!yearList) yearList = yearCols.map((y) => y.year);

    let currentCategory = "";
    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      const col0 = normalizeText(row[0] || "");
      const col1 = normalizeText(row[1] || "");

      // 注釈行: ※N が col0 にある → ラベル(col1)とテキスト(col2)を記録
      const noteMatch = zenkakuDigitToHankaku(col0).match(/^[※＊]\s*\d*/);
      if (noteMatch && col1) {
        const text = normalizeText(row[2] || "");
        if (text) noteRecords.push({ matchKey: matchKey(col1), label: col1, text });
        continue;
      }

      // カテゴリの引き継ぎ
      if (col0) currentCategory = col0;
      if (!col1) continue; // 指標名なし(空行)はスキップ

      const { name, unit, hasNote } = parseIndicatorName(col1);
      if (!name) continue;

      const key = `${currentCategory}|${name}${unit ? `|${unit}` : ""}`;
      const id = key;
      if (!indicatorMap.has(key)) {
        indicatorMap.set(key, {
          id,
          name,
          category: currentCategory,
          unit,
          hasNote,
        });
      } else if (hasNote) {
        indicatorMap.get(key).hasNote = true;
      }

      for (const { col, year } of yearCols) {
        const value = parseValue(row[col]);
        if (value === null) continue;
        series.push({ indicatorId: id, year, month, value });
      }
    }
  }

  const indicators = [...indicatorMap.values()];
  const categories = [...new Set(indicators.map((i) => i.category))];

  // 注釈をテキストで重複排除し、ラベルで指標に対応付け
  const uniqueNotes = [];
  const seenText = new Set();
  for (const n of noteRecords) {
    if (seenText.has(n.text)) continue;
    seenText.add(n.text);
    uniqueNotes.push(n);
  }
  // 各指標に該当注釈を付与(指標名 と 注釈ラベル の matchKey 照合)
  const notesByLabel = new Map();
  for (const n of uniqueNotes) {
    if (!notesByLabel.has(n.matchKey)) notesByLabel.set(n.matchKey, []);
    notesByLabel.get(n.matchKey).push(n.text);
  }
  for (const ind of indicators) {
    const mk = matchKey(ind.name);
    // ラベルが指標名を含む/含まれる関係でも拾う
    const texts = [];
    for (const [labelKey, ts] of notesByLabel) {
      if (labelKey === mk || labelKey.includes(mk) || mk.includes(labelKey)) {
        texts.push(...ts);
      }
    }
    ind.notes = [...new Set(texts)];
    delete ind.hasNote;
  }

  const out = {
    meta: {
      title: "唐津市 経済動向",
      source: "唐津市",
      sourceUrl: SHEET_URL,
      builtAt: new Date().toISOString(),
      years: yearList,
      months: Array.from({ length: 12 }, (_, i) => i + 1),
      categories,
    },
    notes: uniqueNotes.map((n) => ({ label: n.label, text: n.text })),
    indicators,
    series,
  };

  await mkdir(join(ROOT, "public"), { recursive: true });
  await writeFile(
    join(ROOT, "public", "data.json"),
    JSON.stringify(out),
    "utf-8"
  );

  console.log("\n=== 完了 ===");
  console.log(`カテゴリ: ${categories.length} (${categories.join(", ")})`);
  console.log(`指標: ${indicators.length}`);
  console.log(`データ点: ${series.length}`);
  console.log(`年: ${yearList[0]}〜${yearList[yearList.length - 1]}`);
  console.log(`注釈: ${uniqueNotes.length}`);
  console.log(`→ public/data.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
