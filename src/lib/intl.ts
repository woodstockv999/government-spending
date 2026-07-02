// 他国の政府財政（対GDP比）データの型定義。
// データ出典: IMF DataMapper API（Public Finances in Modern History Database /
// World Economic Outlook）。public/data/intl.json 参照。

export type IntlIndicatorId = "exp" | "rev" | "debt";

export interface IntlIndicatorInfo {
  label: string;
  imfDataset: string;
  imfIndicator: string;
  imfSource: string;
}

export interface IntlCountry {
  code: string;
  name: string;
  values: Record<IntlIndicatorId, Record<string, number>>;
}

export interface IntlDoc {
  retrievedAt: string;
  years: string[];
  defaultYear: string;
  unit: string;
  basis: string;
  caveat: string;
  indicators: Record<IntlIndicatorId, IntlIndicatorInfo>;
  source: string;
  sourceUrl: string;
  license: string;
  countries: IntlCountry[];
}
