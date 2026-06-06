export interface Indicator {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  notes: string[];
}

export interface SeriesPoint {
  indicatorId: string;
  year: number;
  month: number;
  value: number;
}

export interface NoteRecord {
  label: string;
  text: string;
}

export interface Dataset {
  meta: {
    title: string;
    source: string;
    sourceUrl: string;
    builtAt: string;
    years: number[];
    months: number[];
    categories: string[];
  };
  notes: NoteRecord[];
  indicators: Indicator[];
  series: SeriesPoint[];
}
