# 国家予算まる見え（marumie-jp）

> 日本の国家予算をサンキー図で一目瞭然に可視化する Web アプリです。

## 概要

「どこにいくら使われているのか」が複雑でわかりにくい国家予算を、インタラクティブなサンキー図（フロー図）で視覚的に表現します。
一般会計・所管別・東京都予算など複数のデータセットを収録し、2024・2025 年度の比較も可能です。

## 機能

- **サンキー図**: 省庁 → 費目 → 主要事業 のお金の流れをひと目で把握
- **省庁パネル**: 各省庁の予算総額・前年比・主要事業をカード形式で表示
- **税収内訳パネル**: 所得税・法人税・消費税などの歳入構造を可視化
- **トレンドパネル**: 年度推移グラフで予算変化を追跡
- **指標パネル**: GDP 比・国債依存度などのマクロ指標を一覧表示
- **2024 / 2025 年度対応**: 一般会計・所管・対等・東京都のデータを収録
- **他国比較パネル**: 日本・米・独・英・仏・韓・中の政府支出/歳入/債務残高（対GDP比）を IMF データで比較

## 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| 可視化 | D3.js / カスタム Sankey チャート |
| スタイル | Tailwind CSS |
| データ形式 | CSV（`data/seed/`） |

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/woodstockv999/government-spending.git
cd government-spending

# 依存パッケージをインストール
npm install

# フロー データをビルド
npm run build:flows

# 開発サーバーを起動
npm run dev
```

## スクリプト

```bash
npm run dev          # 開発サーバー起動 (http://localhost:3000)
npm run build        # 本番ビルド
npm run build:flows  # CSV からフローデータを生成
npm run start        # 本番サーバー起動
```

## データについて

`data/seed/` ディレクトリに CSV 形式で予算データを格納しています。

| ファイル | 内容 |
|----------|------|
| `ippan_kaikei_2024/2025.csv` | 一般会計（国） |
| `shokan_2024.csv` | 所管別予算 |
| `taito_2024.csv` | 対等予算 |
| `tokyo_2024/2025.csv` | 東京都予算 |

データは e-Stat（政府統計の総合窓口）等の公開情報を元に作成しています。

### 他国比較データ（`data/seed/intl_gov_finance.json` → `public/data/intl.json`）

日本・米・独・英・仏・韓・中の政府支出／歳入／債務残高（いずれも対GDP比）を、
IMF DataMapper API（`https://www.imf.org/external/datamapper/api/v1/`）から取得した
`exp` / `rev`（Public Finances in Modern History Database）・`GGXWDG_NGDP`（World Economic
Outlook）の3系列で構成しています（2019〜2024年）。取得済みの生データは
`data/seed/intl_gov_finance.json`（`retrievedAt` に取得日を記録）に seed として保存し、
`npm run build:flows`（内部で `scripts/build_intl.ts` も実行）で `public/data/intl.json`
に書き出します（`/api/intl` が返す JSON）。
日本の「一般会計」は国のみの集計のため、IMF側の「一般政府」（国・地方・社会保障基金を含む）とは
集計範囲が異なります。単純な数値比較ではなく対GDP比の目安として扱ってください（`intl.json` の
`caveat` にも同旨を明記）。データ更新時は IMF DataMapper API を再取得し、
`data/seed/intl_gov_finance.json` の値・`retrievedAt`・出典を書き換えてください。

## ライセンス

MIT
