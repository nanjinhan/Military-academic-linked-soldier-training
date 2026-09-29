import type { Metadata } from "next";
import "./globals.css";
import "./design.css";

export const metadata: Metadata = {
  title: "MILIPASS FITNESS · 나의 체력, 나의 페이스",
  description: "군학연계 체력관리 · 목표부터 수행 인증, 다음 루틴과 성장까지. 가상 데이터 시제품.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
