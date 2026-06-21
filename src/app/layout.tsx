import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "国家予算まる見え | marumie-jp",
  description:
    "日本国の一般会計（歳入→歳出）の流れをサンキー図で可視化。データは財務省公表値 / e-Stat を出典とする。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
