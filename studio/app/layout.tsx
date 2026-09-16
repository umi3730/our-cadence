import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Our Cadence · 角色音乐工作室",
  description: "为原创角色创作主题旋律，试听日常、回忆与战斗编曲。",
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
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
