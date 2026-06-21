// Shared data model for the Sankey flow data.
// 歳入ノード群 → general_account（中央ハブ）→ 歳出ノード群 の2段構成。

export type Side = "income" | "hub" | "expense";

export interface FlowNode {
  id: string;
  name: string;
  side: Side;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number; // unit に従う（既定: 百万円）
}

export type BudgetType = "予算" | "決算";

export interface FlowsDoc {
  fiscalYear: string;
  unit: string;
  source: string;
  type: BudgetType;
  /** "当初予算" | "補正後" | "決算（速報）" | "決算（確定）" 等、確報/速報の別を明示 */
  stage: string;
  updatedAt: string;
  /** seed CSV / e-Stat いずれ由来かを明示（検証用） */
  origin: "seed" | "e-stat" | "e-stat+seed";
  totals: { income: number; expense: number };
  nodes: FlowNode[];
  links: FlowLink[];
}

export interface IndexDoc {
  years: string[]; // 降順
  default: string;
  generatedAt: string;
}

export const HUB_ID = "general_account";
export const HUB_NAME = "一般会計";
